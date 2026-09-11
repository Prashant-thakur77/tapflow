// TapFlow — display helpers.

import { DECIMALS, EXPLORER_URL, ONE } from "./config";

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER_URL}/address/${addr}`;

export const short = (addr: string, n = 4) => `${addr.slice(0, 2 + n)}…${addr.slice(-n)}`;

/** Raw collateral → "12.34". */
export function fmtUsdc(raw: bigint, dp = 2): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const whole = abs / ONE;
  const frac = abs % ONE;
  const fracStr = frac.toString().padStart(DECIMALS, "0").slice(0, dp);
  return `${neg ? "-" : ""}${whole.toString()}${dp > 0 ? "." + fracStr : ""}`;
}

/** "12.5" tUSDC → raw. */
export function toRaw(human: number | string): bigint {
  const [i, f = ""] = Number(human).toFixed(DECIMALS).split(".");
  return BigInt(i + f.padEnd(DECIMALS, "0"));
}

export const fmtProb = (p: number | null | undefined) =>
  p === null || p === undefined || !Number.isFinite(p) ? "—" : `${Math.round(p * 100)}%`;

/** ×-multiplier a winning tap returns on stake, e.g. 1.6×. */
export const fmtMultiple = (avgPrice: number) =>
  avgPrice > 0 ? `${(1 / avgPrice).toFixed(2)}×` : "—";

export function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  // Past an hour, minutes-and-seconds stops reading as a duration: a 24h window
  // showed "648:43". Hours get their own field, and the seconds are dropped
  // because nobody reads them at that range.
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, "0")}` : `${r}s`;
}

export const fmtCadence = (intervalSec: number) =>
  intervalSec >= 3600 ? `${intervalSec / 3600}h` : `${Math.round(intervalSec / 60)}m`;
