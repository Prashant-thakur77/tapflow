// Pulls DreamDEX Event Contract fills off Somnia Shannon (read-only) into SQLite.
//
// Sources, in order of trust: the market's on-chain resolution (getMarketOnchain),
// the Somnia markets indexer for market rows and the fill tape. Pools are
// recycled across windows, so every fill is keyed by the bytes32 marketId the
// row carries, never by pool.

import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, type BinaryMarket } from "@somnia-chain/markets-sdk";
import { defineChain } from "viem";
import { BACKFILL, CHAIN_ID, INDEXER_URL, ONE, RPC_URL, VENUE_ID, WS_RPC_URL } from "./config.js";
import { applyResult, getMarket, getMeta, insertFills, markFillsDone, setMeta, upsertMarket, type MarketResult, type Side } from "./db.js";
import { resolvePendingFromChain, syncMarketsFromChain } from "./newmarkets.js";
import { syncMirrors } from "./mirrors.js";
import { syncChainFills } from "./chainfills.js";

const chain = defineChain({
  id: CHAIN_ID,
  name: "Somnia Shannon",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL], webSocket: [WS_RPC_URL] } },
});

export const exchange = new SomniaMarkets({ chain, addresses: SOMNIA_TESTNET_ADDRESSES, wsRpcUrl: WS_RPC_URL, indexerUrl: INDEXER_URL });
export const client = exchange.client;

export const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

interface Target {
  marketId: string;
  pool: string;
  asset: string;
  intervalSec: number;
  tradingStart: number;
  expiry: number;
}

const toTarget = (m: BinaryMarket): Target => ({
  marketId: m.marketId,
  pool: m.poolAddress,
  asset: m.asset,
  intervalSec: Number(m.intervalSec ?? m.interval ?? 0),
  tradingStart: Number(m.tradingStart),
  expiry: Number(m.expiry),
});

/** Every taker BUY on one market's window, paged from the indexer tape. */
async function fetchTaps(t: Target) {
  const rows: Parameters<typeof insertFills>[0] = [];
  const PAGE = 200;
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const page = await client.getFills(t.pool, { since: t.tradingStart, until: t.expiry + 120, limit: PAGE, offset });
    for (const f of page) {
      if ((f.market ?? "").toLowerCase() !== t.marketId.toLowerCase()) continue;
      const side = f.takerOrder?.side ?? f.takerSide;
      if (side !== "BUY_YES" && side !== "BUY_NO") continue;
      const taker = f.takerOrder?.owner ?? f.taker;
      if (!taker) continue;
      const yesPx = Number(f.fillPrice) / ONE;
      const s: Side = side === "BUY_YES" ? "UP" : "DOWN";
      const price = s === "UP" ? yesPx : 1 - yesPx;
      const qty = Number(f.quantity) / ONE;
      rows.push({ id: f.id, marketId: t.marketId, pool: t.pool, txHash: f.txHash, ts: Number(f.timestamp), taker, side: s, qty, price, cost: qty * price });
    }
    if (page.length < PAGE) break;
  }
  return rows;
}

async function resolve(t: Target, row?: BinaryMarket): Promise<MarketResult | null> {
  try {
    const oc = await client.getMarketOnchain(t.marketId as `0x${string}`);
    if (oc.isVoided) return "VOID";
    if (oc.isResolved) return oc.winningOutcome === 0 ? "UP" : "DOWN";
  } catch (e) {
    log(`getMarketOnchain(${t.marketId.slice(-6)}) failed: ${String(e).slice(0, 120)}`);
  }
  // indexer row as a fallback (lags the chain by seconds, fine for settled rows)
  if (row?.voided) return "VOID";
  if (row?.winningOutcome === 0 || row?.winningOutcome === 1) return row.winningOutcome === 0 ? "UP" : "DOWN";
  return null;
}

/** The oracle's opening and closing answers for a settled window (2-dp integers on the feed today). */
async function oraclePrices(marketId: string): Promise<{ open: number | null; close: number | null }> {
  try {
    const r = await client.getMarketResolution(marketId as `0x${string}`);
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v) / 100);
    return { open: num(r.openingAnswer?.numericValue), close: num(r.closingAnswer?.numericValue) };
  } catch {
    return { open: null, close: null };
  }
}

let running = false;
let runningSince = 0;
const SYNC_WATCHDOG_MS = 4 * 60_000;
export let lastSync = { at: 0, live: 0, settled: 0, newFills: 0, error: "" };

/** Reject after `ms` — an upstream call hung for hours once and froze the loop. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function syncOnce(): Promise<void> {
  if (running) {
    if (Date.now() - runningSince > SYNC_WATCHDOG_MS) {
      log(`watchdog: sync stuck for ${Math.round((Date.now() - runningSince) / 1000)}s — releasing the lock`);
      running = false;
    } else return;
  }
  running = true;
  runningSince = Date.now();
  const t0 = Date.now();
  let upstreamError = "";
  let liveCount = 0;
  let pastCount = 0;
  let newFills = 0;
  let resolved = 0;
  try {
    const first = !getMeta("backfilled");
    const [live, past] = await withTimeout(
      Promise.all([
        client.listLiveBinaryMarkets({ venueId: VENUE_ID, limit: 60 }),
        client.listPastBinaryMarkets({ venueId: VENUE_ID, status: "Finalized", limit: first ? BACKFILL : 40 }),
      ]),
      45_000,
      "upstream markets",
    );
    liveCount = live.length;
    pastCount = past.length;
    for (const m of [...live, ...past]) {
      upsertMarket({ ...toTarget(m), status: String(m.status) });
    }

    // Fills: every live window each pass; settled windows until their tape is captured post-settlement.
    const targets = [...live.map((m) => ({ m, t: toTarget(m), settled: false })), ...past.map((m) => ({ m, t: toTarget(m), settled: true }))].filter(
      ({ t, settled }) => !settled || !getMarket(t.marketId)?.fillsDone,
    );
    await mapLimit(targets, 4, async ({ t }) => {
      try {
        newFills += insertFills(await fetchTaps(t));
      } catch (e) {
        log(`getFills(${t.asset} ${t.intervalSec}s ${t.marketId.slice(-6)}) failed: ${String(e).slice(0, 120)}`);
      }
    });

    // Results: settled markets without one yet (plus the oracle's open/close prices).
    await mapLimit(
      past.filter((m) => !getMarket(m.marketId)?.result),
      4,
      async (m) => {
        const r = await resolve(toTarget(m), m);
        if (r) {
          applyResult(m.marketId, r, await oraclePrices(m.marketId));
          markFillsDone(m.marketId);
          resolved++;
        }
      },
    );
    if (first) setMeta("backfilled", String(Date.now()));
  } catch (e) {
    // The upstream indexer is the flaky part. Everything below reads chain only and must still run.
    upstreamError = String(e).slice(0, 200);
    log(`upstream sync failed: ${upstreamError}`);
  }
  // Chain-only scanners: new windows from MarketCreated, reactive mirrors, taker fills.
  for (const [name, fn] of [
    ["new markets", syncMarketsFromChain],
    ["results", resolvePendingFromChain],
    ["mirrors", syncMirrors],
    ["chain fills", syncChainFills],
  ] as const) {
    try {
      await withTimeout(fn(), 120_000, name);
    } catch (e) {
      log(`${name} sync failed: ${String(e).slice(0, 160)}`);
    }
  }
  lastSync = { at: Date.now(), live: liveCount, settled: pastCount, newFills, error: upstreamError };
  log(`sync: ${liveCount} live, ${pastCount} settled, +${newFills} fills, ${resolved} resolved, ${Date.now() - t0}ms${upstreamError ? " (upstream down, chain scanners ran)" : ""}`);
  running = false;
}
