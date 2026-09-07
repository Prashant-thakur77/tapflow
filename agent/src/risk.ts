// TapBot — the risk gate. Every tap passes through here first, and every "no"
// carries a reason code that is published to the feed, so followers can see
// why the bot held as clearly as why it traded.
//
// The shape (declarative reason codes, near-expiry stop, per-window cap,
// edge-over-anchor) is adapted from ideas in dreamdex-bot-kit's
// strategies/ec-oracle-follow (MIT, Copyright DreamDEX S.A.) and strike-bot's
// RiskManager; the code is ours.

import type { Side, TapQuote, TapWindow } from "./ec.js";

export type ReasonCode =
  | "OK"
  | "NO_WINDOW"
  | "NO_SIGNAL"
  | "FLAT"
  | "THIN_BOOK"
  | "PRICE_TOO_HIGH"
  | "SPREAD_EATS_EDGE"
  | "NEAR_EXPIRY"
  | "ALREADY_IN_WINDOW"
  | "COOLDOWN"
  | "EXPOSURE_CAP";

export interface Verdict {
  ok: boolean;
  code: ReasonCode;
  reason: string;
  /** Estimated edge in probability points (positive = worth taking). */
  edgePts?: number;
}

export interface RiskConfig {
  /** Never pay more than this per share (0.90 = 90¢): a 3¢ payout on a 97¢ share is not a trade. */
  maxPrice: number;
  /** Minimum edge over the book's implied probability, in points. */
  minEdgePts: number;
  /** Momentum tilt per basis point of spot move, in points (capped by `maxTiltPts`). */
  tiltPerBps: number;
  maxTiltPts: number;
  /** Don't tap when the window is this close to settling. */
  minLeftSec: number;
  /** Seconds between taps on the same asset. */
  cooldownSec: number;
  /** Max tUSDC at risk on one window. */
  maxWindowUsdc: number;
}

export function riskFromEnv(env: (k: string, d?: string) => string, minLeftSec: number): RiskConfig {
  return {
    maxPrice: Number(env("AGENT_MAX_PRICE", "0.90")),
    minEdgePts: Number(env("AGENT_MIN_EDGE_PTS", "2")),
    tiltPerBps: Number(env("AGENT_TILT_PER_BPS", "1")),
    maxTiltPts: Number(env("AGENT_MAX_TILT_PTS", "25")),
    minLeftSec,
    cooldownSec: Number(env("AGENT_COOLDOWN_SEC", "300")),
    maxWindowUsdc: Number(env("AGENT_MAX_WINDOW_USDC", "3")),
  };
}

/** What the bot has already done, so the gate can be stateful without a database. */
export class Ledger {
  private byWindow = new Map<string, { usdc: number; sides: Set<Side> }>();
  private lastTapAt = new Map<string, number>();

  record(w: TapWindow, side: Side, usdc: number) {
    const k = w.marketId.toLowerCase();
    const cur = this.byWindow.get(k) ?? { usdc: 0, sides: new Set<Side>() };
    cur.usdc += usdc;
    cur.sides.add(side);
    this.byWindow.set(k, cur);
    this.lastTapAt.set(w.asset, Date.now());
    // forget windows that settled long ago
    for (const [id, v] of this.byWindow) if (v.usdc === 0) this.byWindow.delete(id);
  }
  exposure(w: TapWindow) {
    return this.byWindow.get(w.marketId.toLowerCase()) ?? { usdc: 0, sides: new Set<Side>() };
  }
  sinceLastTap(asset: string) {
    const t = this.lastTapAt.get(asset);
    return t ? (Date.now() - t) / 1000 : Infinity;
  }
}

/**
 * The anchored estimate: the book's mid is the crowd's fair value; momentum
 * tilts it. Edge is what's left after paying the ask. Wide spreads eat it —
 * which is exactly when a market order is the wrong tool.
 */
export function gate(
  input: {
    w: TapWindow | undefined;
    side: Side | null;
    bps: number | null;
    q: TapQuote | null;
    /** implied probability of the OTHER side's ask, for the mid */
    otherAsk: number | null;
    stakeUsdc: number;
    secondsLeft: number;
    ledger: Ledger;
  },
  cfg: RiskConfig,
): Verdict {
  const { w, side, bps, q, otherAsk } = input;
  if (!w) return { ok: false, code: "NO_WINDOW", reason: "no live window for this asset" };
  if (bps === null) return { ok: false, code: "NO_SIGNAL", reason: "warming up — not enough spot ticks yet" };
  if (!side) return { ok: false, code: "FLAT", reason: `spot ${bps >= 0 ? "▲" : "▼"}${Math.abs(bps).toFixed(1)}bps — too flat, holding` };
  if (input.secondsLeft < cfg.minLeftSec) return { ok: false, code: "NEAR_EXPIRY", reason: `${Math.round(input.secondsLeft)}s left — too close to settlement` };
  if (!q) return { ok: false, code: "THIN_BOOK", reason: `${side} book too thin to fill ${input.stakeUsdc} tUSDC` };

  const ask = q.impliedProb; // what we pay per share for `side`
  if (ask > cfg.maxPrice) {
    return { ok: false, code: "PRICE_TOO_HIGH", reason: `${side} at ${Math.round(ask * 100)}¢ > max ${Math.round(cfg.maxPrice * 100)}¢ — payout too thin` };
  }

  // mid of this side = (ask − (1 − otherAsk)) / 2 + (1 − otherAsk); if the other side has no ask, use our ask as mid
  const bid = otherAsk !== null ? 1 - otherAsk : ask;
  const mid = (ask + bid) / 2;
  const halfSpreadPts = Math.max(0, (ask - mid) * 100);
  const tiltPts = Math.min(cfg.maxTiltPts, Math.abs(bps) * cfg.tiltPerBps);
  const edgePts = tiltPts - halfSpreadPts;
  if (edgePts < cfg.minEdgePts) {
    return {
      ok: false,
      code: "SPREAD_EATS_EDGE",
      edgePts,
      reason: `${side} tilt +${tiltPts.toFixed(1)}pt vs half-spread ${halfSpreadPts.toFixed(1)}pt → edge ${edgePts.toFixed(1)}pt < ${cfg.minEdgePts}pt`,
    };
  }

  const ex = input.ledger.exposure(w);
  if (ex.sides.has(side)) return { ok: false, code: "ALREADY_IN_WINDOW", reason: `already ${side} on this window`, edgePts };
  if (ex.usdc + input.stakeUsdc > cfg.maxWindowUsdc) return { ok: false, code: "EXPOSURE_CAP", reason: `window exposure ${ex.usdc.toFixed(2)} + ${input.stakeUsdc} > cap ${cfg.maxWindowUsdc}`, edgePts };
  const since = input.ledger.sinceLastTap(w.asset);
  if (since < cfg.cooldownSec) return { ok: false, code: "COOLDOWN", reason: `tapped ${w.asset} ${Math.round(since)}s ago — cooling down`, edgePts };

  return { ok: true, code: "OK", edgePts, reason: `${side}: tilt +${tiltPts.toFixed(1)}pt − half-spread ${halfSpreadPts.toFixed(1)}pt = edge +${edgePts.toFixed(1)}pt at ${Math.round(ask * 100)}¢` };
}
