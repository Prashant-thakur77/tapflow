import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { follow, getFeed, getLeaderboard, getMarketPositions, getProof, getRecent, getSettled, getStats } from "../lib/api";

/** Latest fills across the venue — the live ticker. */
export function useRecentFills(limit = 30) {
  return useQuery({ queryKey: ["tf-recent", limit], queryFn: () => getRecent(limit), refetchInterval: 6_000, retry: 1 });
}

/** Recently settled windows (optionally scoped to an asset/cadence). */
export function useSettled(asset = "", intervalSec = 0, limit = 12) {
  return useQuery({ queryKey: ["tf-settled", asset, intervalSec, limit], queryFn: () => getSettled(asset, intervalSec, limit), refetchInterval: 20_000, retry: 1 });
}

/** Who holds what on one window. */
export function useMarketPositions(marketId?: string) {
  return useQuery({ queryKey: ["tf-positions", marketId], queryFn: () => getMarketPositions(marketId!), enabled: !!marketId, refetchInterval: 10_000, retry: 1 });
}

export function useStats() {
  return useQuery({ queryKey: ["tf-stats"], queryFn: getStats, refetchInterval: 15_000, retry: 1 });
}

export function useLeaderboard(limit = 50) {
  return useQuery({ queryKey: ["tf-leaderboard", limit], queryFn: () => getLeaderboard(limit), refetchInterval: 15_000, retry: 1 });
}

export function useAgentFeed(limit = 30) {
  return useQuery({ queryKey: ["tf-feed", limit], queryFn: () => getFeed(limit), refetchInterval: 8_000, retry: 1 });
}

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ follower, leader }: { follower: string; leader: string }) => follow(follower, leader),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tf-leaderboard"] }),
  });
}

export function useProof() {
  return useQuery({ queryKey: ["tf-proof"], queryFn: getProof, refetchInterval: 15_000, retry: 1 });
}
