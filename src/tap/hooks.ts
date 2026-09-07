import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance } from "wagmi";
import {
  useLiveBinaryOrderBookByMarket,
  useLivePrice,
  useWatchMarket,
  useWatchPrice,
} from "@somnia-chain/markets-sdk/react";
import {
  COLLATERAL,
  getClient,
  listLiveWindows,
  listClaimable,
  pickWindow,
  progress,
  quoteFromBook,
  readGrid,
  secondsLeft,
  toRaw,
  windowPosition,
  type Asset,
  type Side,
  type TapWindow,
} from "../lib/ec";

/**
 * Every live window on the venue. Refreshed every 15s normally; every 3s while
 * a caller is waiting for a series to roll over (`fast`), because the indexer
 * lists a successor window a few seconds after the previous one expires.
 */
export function useLiveWindows(opts: { fastWhen?: (windows: TapWindow[]) => boolean } = {}) {
  const { fastWhen } = opts;
  const q = useQuery({
    queryKey: ["windows"],
    queryFn: () => listLiveWindows(getClient()),
    refetchInterval: (query) => (fastWhen?.(query.state.data ?? []) ? 3_000 : 15_000),
    staleTime: 2_000,
  });
  return q;
}

/** No window for this series while the venue has others: the gap between expiry and the successor being indexed. */
const inRollover = (windows: TapWindow[], asset: Asset, intervalSec: number) =>
  windows.length > 0 && !pickWindow(windows, asset, intervalSec, 10);

/** The window to show for the chosen asset + cadence; refetches when it expires. */
export function useCurrentWindow(asset: Asset, intervalSec: number) {
  const { data: windows = [], refetch, isLoading, error } = useLiveWindows({
    fastWhen: (ws) => inRollover(ws, asset, intervalSec),
  });
  const w = useMemo(() => pickWindow(windows, asset, intervalSec, 10), [windows, asset, intervalSec]);
  const gap = inRollover(windows, asset, intervalSec);
  useEffect(() => {
    if (!w) return;
    const ms = Math.max(500, w.expiry * 1000 - Date.now() + 1500);
    const t = setTimeout(() => refetch(), ms);
    return () => clearTimeout(t);
  }, [w, refetch]);
  return { window: w, windows, isLoading, rolling: gap, error: error as Error | null };
}

/** A wall clock that re-renders every `intervalMs` (render-pure: no Date.now() in render). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** 100ms clock for the ring. */
export function useCountdown(w: TapWindow | undefined) {
  const now = useNow(100);
  if (!w) return { left: 0, pct: 0 };
  return { left: secondsLeft(w, now), pct: progress(w, now) };
}

/** Underlying spot from the oracle price feed (watched while mounted). */
export function useSpot(asset: Asset) {
  useWatchPrice(asset);
  return useLivePrice(asset);
}

/** The window's opening price (what it settles against), in the feed's raw integer units. */
export function useOpeningPrice(w: TapWindow | undefined) {
  return useQuery({
    queryKey: ["opening", w?.marketId],
    enabled: !!w,
    queryFn: async () => {
      const r = await getClient().getOpeningPrices([w!.marketId]);
      const hit = Object.entries(r).find(([k]) => k.toLowerCase() === w!.marketId.toLowerCase());
      const v = hit?.[1] ?? null;
      console.debug(`[tapflow] opening price ${w!.marketId.slice(-6)} → ${v}`);
      return v === null ? null : Number(v);
    },
    refetchInterval: (q) => (q.state.data ? false : 5_000),
  });
}

/**
 * Book for the window: the SDK's live-store book the moment it has hydrated,
 * with a 3s on-chain poll underneath so quotes never depend on the tail.
 */
export function useTapQuotes(w: TapWindow | undefined, stake: number) {
  const watch = useWatchMarket(w?.pool);
  const live = useLiveBinaryOrderBookByMarket(w?.marketId, 10);
  const polled = useQuery({
    queryKey: ["book", w?.pool],
    enabled: !!w,
    queryFn: () => getClient().getBinaryOrderBook(w!.pool, { depth: 10 }),
    refetchInterval: 3_000,
  });
  // The pool's tick/lot/min grid: an off-grid quantity reverts on-chain.
  const gridQ = useQuery({
    queryKey: ["grid", w?.pool],
    enabled: !!w,
    queryFn: () => readGrid(getClient(), w!.pool),
    staleTime: 10 * 60_000,
  });
  const stakeRaw = toRaw(stake);
  return useMemo(() => {
    const liveHas = live.yesAsks.length + live.noAsks.length > 0;
    const book = liveHas ? live : polled.data;
    const has = !!book && book.yesAsks.length + book.noAsks.length > 0;
    const grid = gridQ.data;
    return {
      hasBook: has,
      book: has ? book! : null,
      grid,
      source: liveHas ? ("live" as const) : polled.data ? ("poll" as const) : ("none" as const),
      watch: String(watch),
      up: has ? quoteFromBook(book!, "UP", stakeRaw, { grid }) : null,
      down: has ? quoteFromBook(book!, "DOWN", stakeRaw, { grid }) : null,
    };
  }, [live, polled.data, stakeRaw, watch, gridQ.data]);
}

export function useWindowPosition(w: TapWindow | undefined) {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["position", address, w?.marketId],
    enabled: !!address && !!w,
    queryFn: () => windowPosition(getClient(), address!, w!),
    refetchInterval: 6_000,
  });
}

export function useBalances() {
  const { address } = useAccount();
  const stt = useBalance({ address, query: { refetchInterval: 8_000 } });
  const usdc = useQuery({
    queryKey: ["usdc", address],
    enabled: !!address,
    queryFn: () => getClient().getErc20Balance(COLLATERAL, address!),
    refetchInterval: 8_000,
  });
  return { stt: stt.data?.value, usdc: usdc.data, refetch: () => void Promise.all([stt.refetch(), usdc.refetch()]) };
}

export function useClaimable() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["claimable", address],
    enabled: !!address,
    queryFn: () => listClaimable(getClient(), address!),
    refetchInterval: 15_000,
  });
}

/** Invalidate everything a tap or claim changes. */
export function useRefreshAfterTx() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["position"] });
    void qc.invalidateQueries({ queryKey: ["usdc"] });
    void qc.invalidateQueries({ queryKey: ["claimable"] });
  };
}

export type { Side };
