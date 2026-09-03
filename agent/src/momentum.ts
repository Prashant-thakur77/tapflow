import type { Asset, Side } from "./ec.js";

/** A rolling window of recent spot samples per asset, for a momentum read. */
export class Momentum {
  private buf = new Map<Asset, { t: number; p: number }[]>();
  constructor(private windowMs = 90_000) {}

  push(asset: Asset, price: number) {
    const now = Date.now();
    const arr = this.buf.get(asset) ?? [];
    arr.push({ t: now, p: price });
    while (arr.length && now - arr[0].t > this.windowMs) arr.shift();
    this.buf.set(asset, arr);
  }

  /**
   * Signal for an asset: the move from the oldest sample in the window to the
   * latest, in bps. Positive → UP bias, negative → DOWN. `null` until it has
   * two samples spread over enough time to be meaningful.
   */
  read(asset: Asset): { bps: number; last: number; from: number; samples: number } | null {
    const arr = this.buf.get(asset);
    if (!arr || arr.length < 2) return null;
    const from = arr[0].p;
    const last = arr[arr.length - 1].p;
    if (from <= 0) return null;
    return { bps: ((last - from) / from) * 10_000, last, from, samples: arr.length };
  }
}

/** Turn a momentum read into a side + one-line rationale, or skip. */
export function decide(
  asset: Asset,
  m: { bps: number; last: number } | null,
  thresholdBps: number,
): { side: Side; rationale: string } | { side: null; rationale: string } {
  if (!m) return { side: null, rationale: `${asset}: warming up, not enough ticks yet` };
  const dir = m.bps >= 0 ? "▲" : "▼";
  if (Math.abs(m.bps) < thresholdBps) {
    return { side: null, rationale: `${asset} ${dir}${Math.abs(m.bps).toFixed(1)}bps < ${thresholdBps}bps — too flat, holding` };
  }
  const side: Side = m.bps > 0 ? "UP" : "DOWN";
  return { side, rationale: `${asset} ${dir}${Math.abs(m.bps).toFixed(1)}bps over ~90s → momentum ${side}` };
}
