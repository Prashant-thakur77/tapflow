import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Asset, Side } from "./lib/ec";

export const STAKE_PRESETS = [1, 5, 10] as const;

export interface TapRecord {
  at: number;
  asset: Asset;
  intervalSec: number;
  marketId: string;
  side: Side;
  stake: number;
  /** human units */
  filled: number;
  paid: number;
  avgPrice: number;
  hash: string;
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
      pushTap: (t) => set((s) => ({ taps: [t, ...s.taps].slice(0, 200) })),
      setSeenHowItWorks: (seenHowItWorks) => set({ seenHowItWorks }),
    }),
    { name: "tapflow" },
  ),
);
