// TapFlow indexer (F4) client — the leaderboard, live stats and agent feed.
// Base URL from VITE_TAPFLOW_API (default the local indexer).

const BASE =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_TAPFLOW_API ??
    "http://localhost:8787").replace(/\/$/, "");

export const EXPLORER_URL = "https://shannon-explorer.somnia.network";
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
  copies?: number;
  isAgent: boolean;
  label?: string;
}

export interface FeedItem {
  at: number;
  actor: string;
  label?: string;
  asset: string;
  side: "UP" | "DOWN" | "HOLD";
  stake: number;
  price: number;
  rationale: string;
  txHash: string;
  /** risk-gate reason code on agent entries */
  code?: string;
}

export interface RecentFill {
  at: number;
  taker: string;
  side: "UP" | "DOWN";
  qty: number;
  price: number;
  cost: number;
  txHash: string;
  marketId: string;
  asset: string;
  intervalSec: number;
}

export interface SettledWindow {
  marketId: string;
  asset: string;
  intervalSec: number;
  tradingStart: number;
  expiry: number;
  expiryAt: number;
  result: "UP" | "DOWN" | "VOID";
  openPx: number | null;
  closePx: number | null;
}

export interface MarketPositions {
  marketId: string;
  summary: { fills: number; traders: number; volumeUsdc: number; upQty: number; downQty: number };
  positions: { taker: string; side: "UP" | "DOWN"; qty: number; cost: number; avgPrice: number; fills: number; lastAt: number; label?: string }[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface ProofSummary {
  broadcasts: number;
  mirrors: number;
  successful: number;
  sameBlock: number;
  followers: number;
  leaders: number;
  cursor: number;
}

export const getStats = () => get<Stats>("/api/stats");
export const getProof = () => get<ProofSummary & { latest: unknown[] }>("/api/proof");
export const getLeaderboard = (limit = 50) => get<Leader[]>(`/api/leaderboard?limit=${limit}`);
export const getFeed = (limit = 30) => get<FeedItem[]>(`/api/feed?limit=${limit}`);
export const getLeader = (address: string) => get<Leader & { recent: unknown[] }>(`/api/leader/${address}`);
export const getRecent = (limit = 30) => get<RecentFill[]>(`/api/recent?limit=${limit}`);
export const getSettled = (asset = "", intervalSec = 0, limit = 12) => get<SettledWindow[]>(`/api/settled?asset=${asset}&intervalSec=${intervalSec}&limit=${limit}`);
export interface FollowerClaimable {
  marketId: string;
  outcomeIdx: 0 | 1;
  shares: number;
  estPayoutUsdc: number;
  result: "UP" | "DOWN" | "VOID";
  asset: string | null;
  intervalSec: number | null;
  expiry: number | null;
}
export const getFollowerClaimables = (address: string) => get<FollowerClaimable[]>(`/api/follower/${address}/claimable`);
export const getMarketPositions = (marketId: string) => get<MarketPositions>(`/api/market/${marketId}/positions`);

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
