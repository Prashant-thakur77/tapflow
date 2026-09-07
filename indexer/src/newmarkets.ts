// Windows straight from chain — the fallback for when the upstream indexer is
// down (it times out often enough that we measured it). The BinaryMarketsModule
// emits MarketCreated for every window; pools are recycled per series, so a
// pool we have seen before tells us the asset and cadence of the new window,
// and getMarketOnchain gives everything else without touching the indexer.
//
// Event signature from @somnia-chain/markets-sdk dist/eventsAbi (binaryModuleEventsAbi).

import { createPublicClient, defineChain, http, parseAbiItem, type Hex } from "viem";
import { CHAIN_ID, RPC_URL, VENUE_ID } from "./config.js";
import { db, getMeta, setMeta, upsertMarket } from "./db.js";
import { client } from "./chain.js";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const chain = defineChain({ id: CHAIN_ID, name: "Somnia Shannon", nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } });
const pc = createPublicClient({ chain, transport: http(RPC_URL) });

export const BINARY_MODULE = (process.env.BINARY_MODULE ?? "0x3ecC694Cef705358864a646142ac17A90E29e388") as Hex;
const EV_CREATED = parseAbiItem(
  "event MarketCreated(bytes32 indexed marketId, address indexed market, address indexed pool, uint256 oracleQuestionId, uint32 operatorId, bytes32 venueId, address creator, address collateral, uint256 yesId, uint256 noId, uint64 nonce)",
);
const CHUNK = 1000;
const MAX_CHUNKS = Number(process.env.NEWMARKETS_MAX_CHUNKS ?? 40);
/** First run: look back this many blocks (~1h at Somnia's pace) instead of the whole chain. */
const LOOKBACK = Number(process.env.NEWMARKETS_LOOKBACK ?? 40_000);

const st = {
  seriesOfPool: db.prepare(`SELECT asset, intervalSec FROM markets WHERE pool = ? ORDER BY expiry DESC LIMIT 1`),
  known: db.prepare(`SELECT 1 FROM markets WHERE marketId = ?`),
  live: db.prepare(`SELECT marketId, pool, asset, intervalSec, tradingStart, expiry FROM markets WHERE expiry > ? AND status != 'Finalized' ORDER BY expiry`),
  finalize: db.prepare(`UPDATE markets SET status = 'Finalized', updatedAt = ? WHERE marketId = ?`),
};

export let marketsCursor = Number(getMeta("newmarkets_cursor") ?? 0);

/** Scan MarketCreated on the module and add windows the upstream indexer hasn't told us about. */
export async function syncMarketsFromChain(): Promise<number> {
  const head = Number(await pc.getBlockNumber());
  if (!marketsCursor) marketsCursor = Math.max(0, head - LOOKBACK);
  let from = marketsCursor;
  let chunks = 0;
  let added = 0;
  while (from <= head && chunks < MAX_CHUNKS) {
    const to = Math.min(from + CHUNK - 1, head);
    const logs = await pc.getLogs({ address: BINARY_MODULE, event: EV_CREATED, fromBlock: BigInt(from), toBlock: BigInt(to) });
    for (const l of logs) {
      const a = l.args as { marketId: Hex; pool: Hex; venueId: Hex };
      if (a.venueId.toLowerCase() !== VENUE_ID.toLowerCase()) continue;
      if (st.known.get(a.marketId.toLowerCase())) continue;
      const series = st.seriesOfPool.get(a.pool.toLowerCase()) as { asset: string; intervalSec: number } | undefined;
      if (!series) continue; // a pool we have never seen: no way to name the series without the indexer
      try {
        const oc = await client.getMarketOnchain(a.marketId);
        const b = await pc.getBlock({ blockNumber: l.blockNumber! });
        upsertMarket({ marketId: a.marketId, pool: a.pool, asset: series.asset, intervalSec: series.intervalSec, tradingStart: Number(b.timestamp), expiry: Number(oc.expiry), status: oc.finalized ? "Finalized" : "Trading" });
        added++;
      } catch (e) {
        log(`newmarkets: ${a.marketId.slice(-6)} read failed: ${String(e).slice(0, 100)}`);
      }
    }
    from = to + 1;
    chunks++;
  }
  marketsCursor = from;
  setMeta("newmarkets_cursor", String(from));
  if (added) log(`newmarkets: +${added} windows from chain logs (cursor ${from})`);
  return added;
}

export interface ChainWindow {
  marketId: string;
  pool: string;
  marketAddress: string;
  asset: string;
  intervalSec: number;
  tradingStart: number;
  expiry: number;
  outcomeToken: string;
  yesId: string;
  noId: string;
  collateral: string;
  status: number;
}

let cache: { at: number; rows: ChainWindow[] } = { at: 0, rows: [] };

/** Every window we know that is Trading on-chain right now — verified per row, cached 5s. */
export async function liveWindowsFromChain(): Promise<ChainWindow[]> {
  if (Date.now() - cache.at < 5_000) return cache.rows;
  const now = Math.floor(Date.now() / 1000);
  const rows = st.live.all(now) as { marketId: string; pool: string; asset: string; intervalSec: number; tradingStart: number; expiry: number }[];
  const out: ChainWindow[] = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        const oc = await client.getMarketOnchain(r.marketId as Hex);
        if (oc.finalized) {
          st.finalize.run(Date.now(), r.marketId);
          return;
        }
        if (oc.status !== 1) return; // 1 = Trading
        out.push({
          marketId: r.marketId,
          pool: oc.pool,
          marketAddress: oc.marketAddress,
          asset: r.asset,
          intervalSec: r.intervalSec,
          tradingStart: r.tradingStart,
          expiry: Number(oc.expiry),
          outcomeToken: oc.outcomeToken,
          yesId: oc.yesId.toString(),
          noId: oc.noId.toString(),
          collateral: oc.collateral,
          status: oc.status,
        });
      } catch {
        /* skip this row this time */
      }
    }),
  );
  out.sort((a, b) => a.expiry - b.expiry);
  cache = { at: Date.now(), rows: out };
  return out;
}
