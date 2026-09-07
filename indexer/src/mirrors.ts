// Indexes the copy-trading contracts' events straight from Somnia logs:
//   Router.PositionOpened   — a leader broadcast
//   CopyHandler.Mirrored    — the reactive mirror (same block, synthetic tx)
//   MirrorVault.FollowerFilled — the follower's escrow
// Pairing a Mirrored log with the PositionOpened in the same block is the
// same-block proof the /proof page and the leaderboard's "copies" column show.
// Somnia caps eth_getLogs at 1000 blocks per call, so this walks a cursor.

import fs from "node:fs";
import { createPublicClient, defineChain, http, parseAbi, parseAbiItem, type Hex } from "viem";
import { CHAIN_ID, RPC_URL } from "./config.js";
import { db, getMeta, setCopiesSource, setMeta } from "./db.js";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

interface Deployments {
  router: Hex;
  mirrorVault: Hex;
  copyHandler: Hex;
  subscriptions: { copyHandler: string; riskGuard: string };
}
function loadDeployments(): Deployments | null {
  for (const p of [new URL("../../contracts/deployments.json", import.meta.url), new URL("../deployments.json", import.meta.url)]) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")) as Deployments;
    } catch {
      /* try next */
    }
  }
  return null;
}
export const deployments = loadDeployments();
setCopiesSource(() => copiesByLeader());

/** Every CopyHandler that ever mirrored (v1 escrowed DOWN wrong; kept for the record). */
const HANDLERS: Hex[] = [...new Set([deployments?.copyHandler, "0x2Fff45dFE73aE60f4Fd24fE25B7C93482DBeF43d" as Hex, "0x63Ed0a4242FD11A9A9296F8D8bDCd39D2E90c9c1" as Hex].filter(Boolean) as Hex[])];
const VAULTS: Hex[] = [...new Set([deployments?.mirrorVault, "0x4d5F238420452D360D98AF0fA08A33048964a5A5" as Hex, "0xF5fc089748604722ADa350599a8afBAFb0A6aB0A" as Hex].filter(Boolean) as Hex[])];
const START_BLOCK = Number(process.env.MIRRORS_START_BLOCK ?? 482_310_000);
const CHUNK = 1000n;
const MAX_CHUNKS_PER_SYNC = Number(process.env.MIRRORS_MAX_CHUNKS ?? 40);

const MIRRORED = parseAbiItem("event Mirrored(address indexed follower,address indexed leader,bytes32 indexed marketId,uint8 side,uint256 qty,bool success)");
const OPENED = parseAbiItem("event PositionOpened(address indexed leader,bytes32 indexed marketId,address pool,uint8 side,uint256 qty,uint256 price,uint64 expiryNs)");
const FILLED = parseAbiItem("event FollowerFilled(address indexed follower,address indexed leader,bytes32 indexed marketId,uint8 side,uint256 qty,uint256 cost,uint256 spent,uint256 maxLoss)");

import { client } from "./chain.js";
const chain = defineChain({ id: CHAIN_ID, name: "Somnia Shannon", nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } });
const pc = createPublicClient({ chain, transport: http(RPC_URL) });

db.exec(`
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY, block INTEGER NOT NULL, txHash TEXT NOT NULL, leader TEXT NOT NULL, marketId TEXT NOT NULL,
  side TEXT NOT NULL, qty REAL NOT NULL, price REAL NOT NULL, ts INTEGER
);
CREATE INDEX IF NOT EXISTS broadcasts_block ON broadcasts(block);
CREATE TABLE IF NOT EXISTS mirrors (
  id TEXT PRIMARY KEY, block INTEGER NOT NULL, txHash TEXT NOT NULL, handler TEXT NOT NULL, follower TEXT NOT NULL, leader TEXT NOT NULL,
  marketId TEXT NOT NULL, side TEXT NOT NULL, qty REAL NOT NULL, success INTEGER NOT NULL, cost REAL, ts INTEGER
);
CREATE INDEX IF NOT EXISTS mirrors_leader ON mirrors(leader);
CREATE INDEX IF NOT EXISTS mirrors_block ON mirrors(block);
`);

const st = {
  insB: db.prepare(`INSERT OR IGNORE INTO broadcasts (id,block,txHash,leader,marketId,side,qty,price,ts) VALUES (@id,@block,@txHash,@leader,@marketId,@side,@qty,@price,@ts)`),
  insM: db.prepare(`INSERT OR IGNORE INTO mirrors (id,block,txHash,handler,follower,leader,marketId,side,qty,success,cost,ts) VALUES (@id,@block,@txHash,@handler,@follower,@leader,@marketId,@side,@qty,@success,@cost,@ts)`),
  setCost: db.prepare(`UPDATE mirrors SET cost = ? WHERE block = ? AND follower = ? AND marketId = ? AND cost IS NULL`),
  list: db.prepare(`SELECT m.*, b.txHash AS broadcastTx, b.price AS broadcastPrice FROM mirrors m
    LEFT JOIN broadcasts b ON b.block = m.block AND b.leader = m.leader AND b.marketId = m.marketId
    ORDER BY m.block DESC, m.id DESC LIMIT ?`),
  copies: db.prepare(`SELECT leader, COUNT(*) AS n FROM mirrors WHERE success = 1 GROUP BY leader`),
  followerMarkets: db.prepare(`SELECT m.marketId, m.side, SUM(m.qty) AS qty, k.asset, k.intervalSec, k.expiry, k.result
    FROM mirrors m LEFT JOIN markets k ON k.marketId = m.marketId
    WHERE m.follower = ? AND m.success = 1 GROUP BY m.marketId, m.side ORDER BY k.expiry DESC LIMIT 60`),
  counts: db.prepare(`SELECT COUNT(*) AS mirrors, SUM(success) AS ok,
    SUM(CASE WHEN EXISTS (SELECT 1 FROM broadcasts b WHERE b.block = m.block AND b.leader = m.leader AND b.marketId = m.marketId) THEN 1 ELSE 0 END) AS sameBlock,
    COUNT(DISTINCT follower) AS followers, COUNT(DISTINCT leader) AS leaders FROM mirrors m`),
  broadcasts: db.prepare(`SELECT COUNT(*) AS n FROM broadcasts`),
};

const ONE = 1e6;
const sideOf = (s: number) => (s === 0 ? "UP" : "DOWN");

export async function syncMirrors(): Promise<void> {
  if (!deployments) return;
  const head = Number(await pc.getBlockNumber());
  let from = Number(getMeta("mirrors_cursor") ?? START_BLOCK);
  let chunks = 0;
  let added = 0;
  while (from <= head && chunks < MAX_CHUNKS_PER_SYNC) {
    const to = Math.min(from + Number(CHUNK) - 1, head);
    const [opened, mirrored, filled] = await Promise.all([
      pc.getLogs({ address: deployments.router, event: OPENED, fromBlock: BigInt(from), toBlock: BigInt(to) }),
      pc.getLogs({ address: HANDLERS, event: MIRRORED, fromBlock: BigInt(from), toBlock: BigInt(to) }),
      pc.getLogs({ address: VAULTS, event: FILLED, fromBlock: BigInt(from), toBlock: BigInt(to) }),
    ]);
    const tx = db.transaction(() => {
      for (const l of opened) {
        added += st.insB.run({
          id: `${l.transactionHash}-${l.logIndex}`, block: Number(l.blockNumber), txHash: l.transactionHash, leader: l.args.leader!.toLowerCase(), marketId: l.args.marketId!.toLowerCase(),
          side: sideOf(Number(l.args.side)), qty: Number(l.args.qty) / ONE, price: Number(l.args.price) / ONE, ts: null,
        }).changes;
      }
      for (const l of mirrored) {
        added += st.insM.run({
          id: `${l.transactionHash}-${l.logIndex}`, block: Number(l.blockNumber), txHash: l.transactionHash, handler: l.address.toLowerCase(), follower: l.args.follower!.toLowerCase(),
          leader: l.args.leader!.toLowerCase(), marketId: l.args.marketId!.toLowerCase(), side: sideOf(Number(l.args.side)), qty: Number(l.args.qty) / ONE, success: l.args.success ? 1 : 0, cost: null, ts: null,
        }).changes;
      }
      for (const l of filled) {
        st.setCost.run(Number(l.args.cost) / ONE, Number(l.blockNumber), l.args.follower!.toLowerCase(), l.args.marketId!.toLowerCase());
      }
    });
    tx();
    from = to + 1;
    chunks++;
  }
  setMeta("mirrors_cursor", String(from));
  if (added) log(`mirrors: +${added} events, cursor ${from}/${head}`);
}

export function listMirrors(limit = 30) {
  return (st.list.all(limit) as (Record<string, unknown> & { block: number; txHash: string; broadcastTx: string | null; success: number })[]).map((r) => ({
    block: r.block,
    reactiveTx: r.txHash,
    broadcastTx: r.broadcastTx,
    sameBlock: !!r.broadcastTx,
    handler: r.handler,
    follower: r.follower,
    leader: r.leader,
    marketId: r.marketId,
    side: r.side,
    qty: r.qty,
    cost: r.cost,
    success: !!r.success,
    broadcastPrice: r.broadcastPrice,
  }));
}

export function copiesByLeader(): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of st.copies.all() as { leader: string; n: number }[]) m.set(r.leader, r.n);
  return m;
}

export function proofSummary() {
  const c = st.counts.get() as { mirrors: number; ok: number; sameBlock: number; followers: number; leaders: number };
  const b = st.broadcasts.get() as { n: number };
  return {
    deployments,
    cursor: Number(getMeta("mirrors_cursor") ?? START_BLOCK),
    broadcasts: b.n,
    mirrors: c.mirrors,
    successful: c.ok ?? 0,
    sameBlock: c.sameBlock ?? 0,
    followers: c.followers,
    leaders: c.leaders,
    latest: listMirrors(12),
  };
}

const VAULT_READ_ABI = parseAbi(["function shares(address follower, bytes32 marketId, uint8 outcomeIdx) view returns (uint256)"]);

export interface FollowerClaimable {
  marketId: string;
  outcomeIdx: 0 | 1;
  shares: number;
  estPayoutUsdc: number;
  result: "UP" | "DOWN" | "VOID";
  asset: string | null;
  intervalSec: number | null;
  expiry: number | null;
}

/**
 * Settled windows where the CURRENT MirrorVault still holds winning (or voided)
 * shares for this follower: shares from the vault, results from chain.
 */
export async function followerClaimables(follower: string): Promise<FollowerClaimable[]> {
  const vault = deployments?.mirrorVault;
  if (!vault) return [];
  const rows = st.followerMarkets.all(follower.toLowerCase()) as { marketId: string; side: "UP" | "DOWN"; qty: number; asset: string | null; intervalSec: number | null; expiry: number | null; result: string | null }[];
  const out: FollowerClaimable[] = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        const outcomeIdx: 0 | 1 = r.side === "UP" ? 0 : 1;
        const held = await pc.readContract({ address: vault, abi: VAULT_READ_ABI, functionName: "shares", args: [follower as Hex, r.marketId as Hex, outcomeIdx] });
        if (held === 0n) return;
        let result = r.result as "UP" | "DOWN" | "VOID" | null;
        if (!result) {
          const oc = await client.getMarketOnchain(r.marketId as Hex);
          if (oc.isVoided) result = "VOID";
          else if (oc.isResolved) result = oc.winningOutcome === 0 ? "UP" : "DOWN";
          else return;
        }
        const wins = result === "VOID" || result === r.side;
        if (!wins) return;
        const shares = Number(held) / 1e6;
        out.push({ marketId: r.marketId, outcomeIdx, shares, estPayoutUsdc: result === "VOID" ? shares / 2 : shares, result, asset: r.asset, intervalSec: r.intervalSec, expiry: r.expiry });
      } catch {
        /* skip */
      }
    }),
  );
  return out;
}
