import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Asset, Side } from "./lib/ec";

export const STAKE_PRESETS = [1, 5, 10] as const;

export type TapOutcome = "win" | "loss" | "void";

export interface TapRecord {
  at: number;
  asset: Asset;
  intervalSec: number;
  marketId: string;
  /** unix seconds */
  expiry: number;
  side: Side;
  stake: number;
  /** human units */
  filled: number;
  paid: number;
  avgPrice: number;
  hash: string;
  /** Set by the settlement watcher once the window resolves. */
  result?: TapOutcome;
  payout?: number;
  pnl?: number;
  resultAt?: number;
  seen?: boolean;
}

interface TapState {
  asset: Asset;
  intervalSec: number;
  stake: number;
  taps: TapRecord[];
  seenHowItWorks: boolean;
  setAsset: (a: Asset) => void;
  setIntervalSec: (s: number) => void;
  setStake: (n: number) => void;
  pushTap: (t: TapRecord) => void;
  setResult: (hash: string, r: Pick<TapRecord, "result" | "payout" | "pnl" | "resultAt">) => void;
  markSeen: (hash: string) => void;
  setSeenHowItWorks: (v: boolean) => void;
}

export const useTapStore = create<TapState>()(
  persist(
    (set) => ({
      asset: "BTC",
      intervalSec: 300,
      stake: 5,
      taps: [],
      seenHowItWorks: false,
      setAsset: (asset) => set({ asset }),
      setIntervalSec: (intervalSec) => set({ intervalSec }),
      setStake: (stake) => set({ stake }),
      pushTap: (t) => set((s) => ({ taps: [t, ...s.taps].slice(0, 300) })),
      setResult: (hash, r) => set((s) => ({ taps: s.taps.map((t) => (t.hash === hash ? { ...t, ...r } : t)) })),
      markSeen: (hash) => set((s) => ({ taps: s.taps.map((t) => (t.hash === hash ? { ...t, seen: true } : t)) })),
      setSeenHowItWorks: (seenHowItWorks) => set({ seenHowItWorks }),
    }),
    { name: "tapflow", version: 2 },
  ),
);

/** Consecutive wins counting back from the most recent settled tap. */
export function streakOf(taps: TapRecord[]): number {
  let n = 0;
  for (const t of taps) {
    if (!t.result) continue;
    if (t.result === "win") n++;
    else if (t.result === "loss") break;
  }
  return n;
}

export function statsOf(taps: TapRecord[]) {
  const settled = taps.filter((t) => t.result);
  const wins = settled.filter((t) => t.result === "win").length;
  const losses = settled.filter((t) => t.result === "loss").length;
  const pnl = settled.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const staked = taps.reduce((a, t) => a + t.paid, 0);
  return { taps: taps.length, wins, losses, pnl, staked, streak: streakOf(taps) };
}
