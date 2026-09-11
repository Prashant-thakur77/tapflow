// TapFlow — live Event Contract windows on the DreamDEX venue.
//
// A "window" is one binary market: "will BTC be up at the end of this
// N-minute window?". We read the venue's live rows from the indexer, then gate
// every one on its on-chain status (the indexer lags by seconds and only
// status 1 = Trading accepts orders).

import { apiBase, apiReady } from "../api";
import type { SomniaMarketsClient, MarketOnchain } from "@somnia-chain/markets-sdk";
import type { Address, Hex } from "viem";
import { VENUE_ID } from "./config";

export type Asset = "BTC" | "ETH";
export const ASSETS: readonly Asset[] = ["BTC", "ETH"] as const;

/** On-chain MarketStatus: 0 Listed · 1 Trading · 2 Locked · 3 Settling · 4 Resolved · 5 Voided. */
export const MARKET_STATUS = {
  Listed: 0,
  Trading: 1,
  Locked: 2,
  Settling: 3,
  Resolved: 4,
  Voided: 5,
} as const;

export interface TapWindow {
  marketId: Hex;
  pool: Address;
  marketAddress: Address;
  asset: Asset;
  /** Window length in seconds (300 / 900 / 3600 …). */
  intervalSec: number;
  /** Unix seconds. */
  expiry: number;
  tradingStart: number;
  /** Opening price the window settles against, as reported by the indexer (raw string). */
  strike: string | null;
  question: string;
  outcomeToken: Address;
  yesId: bigint;
  noId: bigint;
  collateral: Address;
  status: number;
  venueId: Hex | null;
  operatorId: number | null;
  /** Cumulative traded collateral this window, human tUSDC (from the indexer row). */
  volumeUsdc: number;
  /** Fills this window. */
  trades: number;
  /** Last traded YES price in (0,1), or null. */
  lastPrice: number | null;
}

function asAsset(a: string): Asset | null {
  return a === "BTC" || a === "ETH" ? a : null;
}

/**
 * A market's on-chain wiring (pool, outcome ids, collateral) never changes for
 * a given marketId — pools are recycled across windows but each window is a
 * new id — so read it once. Status is re-read by {@link refreshStatus} right
 * before a trade; between refreshes the expiry clock is the gate.
 */
const onchainCache = new Map<string, MarketOnchain>();

async function readOnchain(client: SomniaMarketsClient, marketId: Hex): Promise<MarketOnchain | null> {
  const key = marketId.toLowerCase();
  const hit = onchainCache.get(key);
  if (hit) return hit;
  try {
    const oc = await client.getMarketOnchain(marketId);
    onchainCache.set(key, oc);
    return oc;
  } catch (e) {
    console.debug(`[tapflow] getMarketOnchain(${marketId.slice(-6)}) failed: ${String(e).slice(0, 160)}`);
    return null;
  }
}

/** Authoritative on-chain status right now (one RPC read). Only 1 = Trading accepts orders. */
export async function refreshStatus(client: SomniaMarketsClient, marketId: Hex): Promise<number> {
  const oc = await client.getMarketOnchain(marketId);
  onchainCache.set(marketId.toLowerCase(), oc);
  return oc.finalized ? MARKET_STATUS.Resolved : oc.status;
}

const UPSTREAM_TIMEOUT_MS = 9_000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

interface ChainWindowRow {
  marketId: Hex;
  pool: Address;
  marketAddress: Address;
  asset: string;
  intervalSec: number;
  tradingStart: number;
  expiry: number;
  outcomeToken: Address;
  yesId: string;
  noId: string;
  collateral: Address;
  status: number;
  trades?: number;
  volumeUsdc?: number;
}

/** Windows from our own indexer's chain scan (`/api/windows`), already verified Trading on-chain. */
async function listLiveWindowsFallback(opts: { asset?: Asset } = {}): Promise<TapWindow[]> {
  await apiReady;
  const res = await fetch(`${apiBase()}/api/windows`);
  if (!res.ok) throw new Error(`fallback /api/windows → ${res.status}`);
  const rows = (await res.json()) as ChainWindowRow[];
  return rows
    .filter((r) => asAsset(r.asset) && (!opts.asset || r.asset === opts.asset))
    .map((r) => ({
      marketId: r.marketId,
      pool: r.pool,
      marketAddress: r.marketAddress,
      asset: asAsset(r.asset)!,
      intervalSec: r.intervalSec,
      expiry: r.expiry,
      tradingStart: r.tradingStart,
      strike: null,
      question: `${r.asset} above its opening price?`,
      outcomeToken: r.outcomeToken,
      yesId: BigInt(r.yesId),
      noId: BigInt(r.noId),
      collateral: r.collateral,
      status: r.status,
      venueId: VENUE_ID,
      operatorId: null,
      volumeUsdc: r.volumeUsdc ?? 0,
      trades: r.trades ?? 0,
      lastPrice: null,
    }))
    .sort((a, b) => a.expiry - b.expiry);
}

/** Every window on the venue that is Trading on-chain right now, soonest expiry first. */
export async function listLiveWindows(
  client: SomniaMarketsClient,
  opts: { asset?: Asset; limit?: number } = {},
): Promise<TapWindow[]> {
  const t0 = Date.now();
  // Two sources, started together, first useful answer wins.
  //
  // Upstream has richer rows (question, strike, volume) but times out most of
  // the time; our own indexer discovers windows from MarketCreated logs and
  // verifies each one on-chain. Waiting for upstream to time out before even
  // asking ours left the tap screen blank for nine seconds on every cold load.
  // A source that answers with an empty list does not count as an answer, so a
  // fast "nothing" cannot beat a slower real list.
  const nonEmpty = (ws: TapWindow[], who: string) => (ws.length ? ws : Promise.reject(new Error(`${who} empty`)));
  const chain = listLiveWindowsFallback(opts).then((ws) => nonEmpty(ws, "chain"));

  const upstream = (async (): Promise<TapWindow[]> => {
    const rows = await withTimeout(
      client.listLiveBinaryMarkets({ venueId: VENUE_ID, asset: opts.asset, limit: opts.limit ?? 40 }),
      UPSTREAM_TIMEOUT_MS,
    );
    const fresh = rows.filter((r) => !onchainCache.has(r.marketId.toLowerCase())).length;
    console.debug(`[tapflow] indexer: ${rows.length} live rows (${fresh} new) in ${Date.now() - t0}ms`);
    const onchain = await Promise.all(rows.map((r) => readOnchain(client, r.marketId)));
    const out: TapWindow[] = [];
    rows.forEach((r, i) => {
      const oc = onchain[i];
      const asset = asAsset(r.asset);
      if (!oc || !asset) return;
      if (oc.status !== MARKET_STATUS.Trading || oc.finalized) return;
      out.push({
        marketId: r.marketId,
        pool: oc.pool,
        marketAddress: oc.marketAddress,
        asset,
        intervalSec: Number(r.intervalSec ?? r.interval ?? 0),
        expiry: Number(oc.expiry),
        tradingStart: Number(r.tradingStart),
        strike: r.strike ?? null,
        question: r.question,
        outcomeToken: oc.outcomeToken,
        yesId: oc.yesId,
        noId: oc.noId,
        collateral: oc.collateral,
        status: oc.status,
        venueId: r.venueId ?? null,
        operatorId: r.operatorId ?? null,
        volumeUsdc: Number(r.cumulativeQuoteVolume ?? 0) / 10 ** (r.quoteDecimals ?? 6),
        trades: Number(r.tradeCount ?? 0),
        lastPrice: r.lastPrice ? Number(r.lastPrice) / 10 ** (r.quoteDecimals ?? 6) : null,
      });
    });
    return nonEmpty(out, "upstream") as Promise<TapWindow[]>;
  })().catch((e) => {
    console.warn(`[tapflow] upstream indexer failed (${String(e).slice(0, 80)}) — using chain-discovered windows`);
    return Promise.reject(e);
  });

  const out = await Promise.any([upstream, chain]).catch(() => [] as TapWindow[]);
  console.debug(`[tapflow] ${out.length} live window(s) in ${Date.now() - t0}ms`);

  // Upstream is often STALE rather than down: after a window expires its
  // successor can take a minute to be listed. Merge anything chain discovery
  // knows about that is missing, as long as it does not cost real time.
  try {
    const extra = (await withTimeout(chain, 4_000)).filter((w) => !out.some((o) => o.marketId.toLowerCase() === w.marketId.toLowerCase()));
    if (extra.length) {
      console.debug(`[tapflow] +${extra.length} window(s) from chain discovery that upstream has not listed yet`);
      out.push(...extra);
    }
  } catch {
    /* best-effort */
  }
  return out.sort((a, b) => a.expiry - b.expiry);
}

export function secondsLeft(w: Pick<TapWindow, "expiry">, nowMs = Date.now()): number {
  return Math.max(0, w.expiry - nowMs / 1000);
}

/** The window's progress in [0,1]: 0 just opened, 1 expired. */
export function progress(w: Pick<TapWindow, "expiry" | "intervalSec">, nowMs = Date.now()): number {
  if (!w.intervalSec) return 0;
  const left = secondsLeft(w, nowMs);
  return Math.min(1, Math.max(0, 1 - left / w.intervalSec));
}

/**
 * The window to show for an asset + cadence: the soonest one with at least
 * `minLeftSec` to go (so a tap can still land), else the next one in the series.
 */
export function pickWindow(
  windows: TapWindow[],
  asset: Asset,
  intervalSec: number,
  minLeftSec = 15,
  nowMs = Date.now(),
): TapWindow | undefined {
  const series = windows
    .filter((w) => w.asset === asset && w.intervalSec === intervalSec)
    .sort((a, b) => a.expiry - b.expiry);
  return series.find((w) => secondsLeft(w, nowMs) >= minLeftSec) ?? series[0];
}

/** Distinct cadences available for an asset, ascending. */
export function cadences(windows: TapWindow[], asset: Asset): number[] {
  return [...new Set(windows.filter((w) => w.asset === asset).map((w) => w.intervalSec))].sort(
    (a, b) => a - b,
  );
}
