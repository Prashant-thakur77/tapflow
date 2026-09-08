// Fills straight from the pools' logs — no dependency on the upstream tape,
// which we measured lagging by 100 minutes and missing whole wallets.
//
// For an IOC taker the three logs land in ONE transaction:
//   OrderPlaced(orderId, {owner, isBid, price, …})   → who
//   BinaryOrderPlaced(orderId, kind)                  → BUY_YES / BUY_NO / …
//   OrderFilled(takerOrderId, makerOrderId, qty, …, fillPrice) → what
// Pools are recycled across windows, so the fill is mapped to its market by
// the block timestamp falling inside a market's [tradingStart, expiry].

import { createPublicClient, defineChain, http, parseAbiItem, type Hex, type Log } from "viem";
import { CHAIN_ID, ONE, RPC_URL } from "./config.js";
import { db, existsSimilarFill, getMeta, insertFills, setMeta, type Side } from "./db.js";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const chain = defineChain({ id: CHAIN_ID, name: "Somnia Shannon", nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } });
const pc = createPublicClient({ chain, transport: http(RPC_URL) });

// Signatures taken from @somnia-chain/markets-sdk dist/eventsAbi.js (liveEventsAbi + binaryPoolEventsAbi).
const EV_PLACED = parseAbiItem(
  "event OrderPlaced(uint128 indexed orderId, (uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs) placedOrder)",
);
const EV_KIND = parseAbiItem("event BinaryOrderPlaced(uint128 indexed orderId, uint8 kind)");
const EV_FILLED = parseAbiItem(
  "event OrderFilled(uint128 indexed takerOrderId, uint128 indexed makerOrderId, uint256 quantityFilled, uint256 takerRemainingQuantity, uint256 makerRemainingQuantity, uint256 fillPrice)",
);

const START_BLOCK = Number(process.env.CHAINFILLS_START_BLOCK ?? 482_300_000);
const CHUNK = 1000;
const MAX_CHUNKS = Number(process.env.CHAINFILLS_MAX_CHUNKS ?? 30);
/** Chunks fetched at once. Backfilling is round-trip bound, not compute bound:
 *  a fresh host is half a million blocks behind and one chunk at a time takes
 *  a quarter of an hour. The RPC refuses a range wider than 1000 blocks, so
 *  concurrency is the only lever. Applied strictly in order regardless. */
const CONCURRENCY = Number(process.env.CHAINFILLS_CONCURRENCY ?? 12);
/** A pass runs for at most this long, then saves where it got to and returns.
 *  Time-boxing beats a chunk count: it is the same on a fast laptop and a slow
 *  free host, and it can never trip the sync watchdog. */
const PASS_MS = Number(process.env.CHAINFILLS_PASS_MS ?? 100_000);

db.exec(`
CREATE TABLE IF NOT EXISTS pool_orders (
  pool TEXT NOT NULL, orderId TEXT NOT NULL, owner TEXT, isBid INTEGER, kind INTEGER, block INTEGER NOT NULL,
  PRIMARY KEY (pool, orderId)
);
DROP TABLE IF EXISTS orders;
CREATE TABLE IF NOT EXISTS blocks (number INTEGER PRIMARY KEY, ts INTEGER NOT NULL);
`);
const st = {
  upsertOrder: db.prepare(`INSERT INTO pool_orders (pool,orderId,owner,isBid,kind,block) VALUES (@pool,@orderId,@owner,@isBid,@kind,@block)
    ON CONFLICT(pool,orderId) DO UPDATE SET owner=COALESCE(excluded.owner, pool_orders.owner), isBid=COALESCE(excluded.isBid, pool_orders.isBid), kind=COALESCE(excluded.kind, pool_orders.kind)`),
  getOrder: db.prepare(`SELECT owner, isBid, kind FROM pool_orders WHERE pool = ? AND orderId = ?`),
  pools: db.prepare(`SELECT DISTINCT pool FROM markets`),
  marketAt: db.prepare(`SELECT marketId FROM markets WHERE pool = ? AND tradingStart <= ? AND expiry >= ? ORDER BY expiry LIMIT 1`),
  getBlock: db.prepare(`SELECT ts FROM blocks WHERE number = ?`),
  putBlock: db.prepare(`INSERT OR IGNORE INTO blocks (number, ts) VALUES (?, ?)`),
};

async function blockTs(n: number): Promise<number> {
  const hit = st.getBlock.get(n) as { ts: number } | undefined;
  if (hit) return hit.ts;
  const b = await pc.getBlock({ blockNumber: BigInt(n) });
  const ts = Number(b.timestamp);
  st.putBlock.run(n, ts);
  return ts;
}

type Args = Record<string, unknown>;

export let chainFillsCursor = Number(getMeta("chainfills_cursor") ?? START_BLOCK);

export async function syncChainFills(): Promise<void> {
  const pools = (st.pools.all() as { pool: string }[]).map((r) => r.pool as Hex);
  if (pools.length === 0) return;
  const head = Number(await pc.getBlockNumber());
  let from = chainFillsCursor;
  let chunks = 0;
  let added = 0;
  const behind = head - from;
  const deadline = Date.now() + PASS_MS;
  // Caught up: a few chunks is plenty. Far behind (a fresh host): keep going
  // until the time box runs out, saving the cursor as we go.
  const budget = behind > 50_000 ? Number.MAX_SAFE_INTEGER : MAX_CHUNKS;
  while (from <= head && chunks < budget && Date.now() < deadline) {
    // Fetch the next few chunks together, then apply them oldest-first.
    const spans: { from: number; to: number }[] = [];
    for (let i = 0; i < CONCURRENCY && from + i * CHUNK <= head && chunks + i < budget; i++) {
      const f = from + i * CHUNK;
      spans.push({ from: f, to: Math.min(f + CHUNK - 1, head) });
    }
    const batches = await Promise.all(
      spans.map((sp) => pc.getLogs({ address: pools, events: [EV_PLACED, EV_KIND, EV_FILLED], fromBlock: BigInt(sp.from), toBlock: BigInt(sp.to) })),
    );
    for (let bi = 0; bi < spans.length; bi++) {
    const to = spans[bi].to;
    const logs = batches[bi] as (Log & { eventName?: string; args?: Args })[];
    logs.sort((a, b) => Number(a.blockNumber! - b.blockNumber!) || (a.logIndex ?? 0) - (b.logIndex ?? 0));

    // 1) who placed what
    const placed = logs.filter((l) => l.eventName === "OrderPlaced" || l.eventName === "BinaryOrderPlaced");
    db.transaction(() => {
      for (const l of placed) {
        const pool = l.address.toLowerCase();
        if (l.eventName === "OrderPlaced") {
          const o = l.args!.placedOrder as { owner: string; isBid: boolean };
          st.upsertOrder.run({ pool, orderId: String(l.args!.orderId), owner: o.owner.toLowerCase(), isBid: o.isBid ? 1 : 0, kind: null, block: Number(l.blockNumber) });
        } else {
          st.upsertOrder.run({ pool, orderId: String(l.args!.orderId), owner: null, isBid: null, kind: Number(l.args!.kind), block: Number(l.blockNumber) });
        }
      }
    })();

    // 2) taker fills → taps
    const rows: Parameters<typeof insertFills>[0] = [];
    for (const l of logs.filter((x) => x.eventName === "OrderFilled")) {
      const pool = l.address.toLowerCase();
      const takerId = String(l.args!.takerOrderId);
      const o = st.getOrder.get(pool, takerId) as { owner: string | null; isBid: number | null; kind: number | null } | undefined;
      if (!o?.owner || o.kind === null || o.kind === undefined) continue;
      if (o.kind !== 0 && o.kind !== 2) continue; // BUY_YES / BUY_NO only — a tap is a buy
      const side: Side = o.kind === 0 ? "UP" : "DOWN";
      const ts = await blockTs(Number(l.blockNumber));
      const m = st.marketAt.get(pool, ts, ts) as { marketId: string } | undefined;
      if (!m) continue; // window not in our table (older than backfill)
      const yesPx = Number(l.args!.fillPrice) / ONE;
      const price = side === "UP" ? yesPx : 1 - yesPx;
      const qty = Number(l.args!.quantityFilled) / ONE;
      if (existsSimilarFill(l.transactionHash!, o.owner, side, qty)) continue; // already on the tape
      rows.push({ id: `chain:${l.transactionHash}-${l.logIndex}`, marketId: m.marketId, pool, txHash: l.transactionHash!, ts, taker: o.owner, side, qty, price, cost: qty * price });
    }
    if (rows.length) added += insertFills(rows);

    from = to + 1;
    chunks++;
    }
    // Persist after every batch: a timeout or a restart must never lose the work.
    chainFillsCursor = from;
    setMeta("chainfills_cursor", String(from));
  }
  chainFillsCursor = from;
  setMeta("chainfills_cursor", String(from));
  if (added) log(`chain fills: +${added} taker fills, cursor ${from}/${head}`);
}
