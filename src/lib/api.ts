// TapFlow indexer (F4) client — the leaderboard, live stats and agent feed.
// Base URL from VITE_TAPFLOW_API (default the local indexer).

const BASE =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_TAPFLOW_API ??
    "http://localhost:8787").replace(/\/$/, "");

export const TAPFLOW_API = BASE;

export interface Stats {
  wallets: number;
  taps: number;
  volumeUsdc: number;
  windows: number;
  updatedAt: number;
}

export interface Leader {
  address: string;
  taps: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  bestStreak: number;
  pnlUsdc: number;
  volumeUsdc: number;
  followers: number;
  isAgent: boolean;
  label?: string;
}

export interface FeedItem {
  at: number;
  actor: string;
  label?: string;
  asset: string;
  side: "UP" | "DOWN";
  stake: number;
  price: number;
  rationale: string;
  txHash: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const getStats = () => get<Stats>("/api/stats");
export const getLeaderboard = (limit = 50) => get<Leader[]>(`/api/leaderboard?limit=${limit}`);
export const getFeed = (limit = 30) => get<FeedItem[]>(`/api/feed?limit=${limit}`);
export const getLeader = (address: string) => get<Leader & { recent: unknown[] }>(`/api/leader/${address}`);

export async function follow(followerAddr: string, leaderAddr: string): Promise<void> {
  const res = await fetch(`${BASE}/api/follow`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ follower: followerAddr, leader: leaderAddr }),
  });
  if (!res.ok) throw new Error(`follow → ${res.status}`);
}

export const ogTapUrl = (title: string, sub: string, tone: "win" | "loss" | "flat") =>
  `${BASE}/api/og?title=${encodeURIComponent(title)}&sub=${encodeURIComponent(sub)}&tone=${tone}`;
