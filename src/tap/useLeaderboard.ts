import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { follow, getFeed, getLeaderboard, getStats } from "../lib/api";

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
