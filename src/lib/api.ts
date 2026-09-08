// TapFlow indexer (F4) client — the leaderboard, live stats and agent feed.
// Base URL from VITE_TAPFLOW_API (default the local indexer).

const BUILD_BASE =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_TAPFLOW_API ??
    "http://localhost:8787").replace(/\/$/, "");

export const EXPLORER_URL = "https://shannon-explorer.somnia.network";

// The indexer runs behind a quick tunnel whose hostname changes on restart. In
// production the app reads the current URL from api-url.json in the repo at
// runtime (published by scripts/tunnel.sh), so a tunnel restart never needs a
// rebuild. Local dev keeps the build-time value.
const API_URL_JSON = "https://raw.githubusercontent.com/Prashant-thakur77/tapflow/main/api-url.json";
let base = BUILD_BASE;
export function apiBase(): string {
  return base;
}
export const apiReady: Promise<string> = (async () => {
  if (/localhost|127\.0\.0\.1/.test(BUILD_BASE)) return base;
  try {
    const r = await fetch(`${API_URL_JSON}?t=${Math.floor(Date.now() / 60_000)}`, { signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { api?: string };
    if (typeof j.api === "string" && /^https?:\/\//.test(j.api)) base = j.api.replace(/\/$/, "");
  } catch {
    /* keep the build-time base */
  }
  return base;
})();
/** @deprecated read `apiBase()` after `await apiReady` — kept for synchronous render paths. */
export const TAPFLOW_API = BUILD_BASE;

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
  await apiReady;
  const res = await fetch(`${base}${path}`);
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
export interface MirrorRowApi {
  block: number;
  reactiveTx: string;
  broadcastTx: string | null;
  sameBlock: boolean;
  follower: string;
  leader: string;
  side: "UP" | "DOWN";
  qty: number;
  cost: number | null;
  success: boolean;
  reason?: number | null;
  reasonText?: string | null;
}

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
  await apiReady;
  const res = await fetch(`${base}/api/follow`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ follower: followerAddr, leader: leaderAddr }),
  });
  if (!res.ok) throw new Error(`follow → ${res.status}`);
}

export const ogTapUrl = (title: string, sub: string, tone: "win" | "loss" | "flat") =>
  `${base}/api/og?title=${encodeURIComponent(title)}&sub=${encodeURIComponent(sub)}&tone=${tone}`;
