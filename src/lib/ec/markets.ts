// TapFlow — live Event Contract windows on the DreamDEX venue.
//
// A "window" is one binary market: "will BTC be up at the end of this
// N-minute window?". We read the venue's live rows from the indexer, then gate
// every one on its on-chain status (the indexer lags by seconds and only
// status 1 = Trading accepts orders).

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
}

function asAsset(a: string): Asset | null {
  return a === "BTC" || a === "ETH" ? a : null;
}

/** Every window on the venue that is Trading on-chain right now, soonest expiry first. */
export async function listLiveWindows(
  client: SomniaMarketsClient,
  opts: { asset?: Asset; limit?: number } = {},
): Promise<TapWindow[]> {
  const t0 = Date.now();
  const rows = await client.listLiveBinaryMarkets({
    venueId: VENUE_ID,
    asset: opts.asset,
    limit: opts.limit ?? 40,
  });
  console.debug(`[tapflow] indexer: ${rows.length} live rows in ${Date.now() - t0}ms`);

  const onchain = await Promise.all(
    rows.map((r) =>
      client.getMarketOnchain(r.marketId).catch((e) => {
        console.debug(`[tapflow] getMarketOnchain(${r.marketId.slice(-6)}) failed: ${String(e).slice(0, 160)}`);
        return null as MarketOnchain | null;
      }),
    ),
  );
  console.debug(`[tapflow] on-chain status for ${rows.length} rows in ${Date.now() - t0}ms`);

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
    });
  });
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
