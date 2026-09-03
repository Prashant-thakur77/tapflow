import Database from "better-sqlite3";
import { AGENT_ADDRESS, AGENT_LABEL, DB_PATH } from "./config.js";

export type Side = "UP" | "DOWN";
export type Result = "win" | "loss" | "void";
export type MarketResult = "UP" | "DOWN" | "VOID";

export interface MarketRow {
  marketId: string;
  pool: string;
  asset: string;
  intervalSec: number;
  tradingStart: number;
  expiry: number;
  status: string;
  result: MarketResult | null;
  fillsDone: number;
}

export interface FillRowDb {
  id: string;
  marketId: string;
  pool: string;
  txHash: string;
  ts: number;
  taker: string;
  side: Side;
  qty: number;
  price: number;
  cost: number;
  result: Result | null;
  pnl: number | null;
}

export interface TapRow {
  at: number;
  asset: string;
  intervalSec: number;
  marketId: string;
  side: Side;
  qty: number;
  price: number;
  txHash: string;
  result?: Result;
  pnl?: number;
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
  side: Side;
  stake: number;
  price: number;
  rationale: string;
  txHash: string;
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS markets (
  marketId TEXT PRIMARY KEY, pool TEXT NOT NULL, asset TEXT NOT NULL, intervalSec INTEGER NOT NULL,
  tradingStart INTEGER NOT NULL, expiry INTEGER NOT NULL, status TEXT NOT NULL,
  result TEXT, fillsDone INTEGER NOT NULL DEFAULT 0, updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS fills (
  id TEXT PRIMARY KEY, marketId TEXT NOT NULL, pool TEXT NOT NULL, txHash TEXT NOT NULL, ts INTEGER NOT NULL,
  taker TEXT NOT NULL, side TEXT NOT NULL, qty REAL NOT NULL, price REAL NOT NULL, cost REAL NOT NULL,
  result TEXT, pnl REAL
);
CREATE INDEX IF NOT EXISTS fills_taker ON fills(taker);
CREATE INDEX IF NOT EXISTS fills_market ON fills(marketId);
CREATE TABLE IF NOT EXISTS feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT NOT NULL, label TEXT, asset TEXT NOT NULL,
  side TEXT NOT NULL, stake REAL NOT NULL, price REAL NOT NULL, rationale TEXT NOT NULL, txHash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS follows (follower TEXT PRIMARY KEY, leader TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const stmts = {
  upsertMarket: db.prepare(`INSERT INTO markets (marketId,pool,asset,intervalSec,tradingStart,expiry,status,updatedAt)
    VALUES (@marketId,@pool,@asset,@intervalSec,@tradingStart,@expiry,@status,@updatedAt)
    ON CONFLICT(marketId) DO UPDATE SET pool=excluded.pool, status=excluded.status, expiry=excluded.expiry, updatedAt=excluded.updatedAt`),
  getMarket: db.prepare(`SELECT * FROM markets WHERE marketId = ?`),
  setResult: db.prepare(`UPDATE markets SET result = ?, updatedAt = ? WHERE marketId = ?`),
  setFillsDone: db.prepare(`UPDATE markets SET fillsDone = 1 WHERE marketId = ?`),
  insertFill: db.prepare(`INSERT OR IGNORE INTO fills (id,marketId,pool,txHash,ts,taker,side,qty,price,cost)
    VALUES (@id,@marketId,@pool,@txHash,@ts,@taker,@side,@qty,@price,@cost)`),
  fillsOfMarket: db.prepare(`SELECT * FROM fills WHERE marketId = ?`),
  setFillResult: db.prepare(`UPDATE fills SET result = ?, pnl = ? WHERE id = ?`),
  taps: db.prepare(`SELECT f.taker, f.marketId, f.txHash, f.side, MIN(f.ts) AS ts, SUM(f.qty) AS qty, SUM(f.cost) AS cost,
      MAX(f.result) AS result, SUM(f.pnl) AS pnl, m.asset, m.intervalSec
    FROM fills f JOIN markets m ON m.marketId = f.marketId
    GROUP BY f.taker, f.txHash, f.marketId, f.side ORDER BY ts DESC`),
  tapsOf: db.prepare(`SELECT f.taker, f.marketId, f.txHash, f.side, MIN(f.ts) AS ts, SUM(f.qty) AS qty, SUM(f.cost) AS cost,
      MAX(f.result) AS result, SUM(f.pnl) AS pnl, m.asset, m.intervalSec
    FROM fills f JOIN markets m ON m.marketId = f.marketId WHERE f.taker = ?
    GROUP BY f.taker, f.txHash, f.marketId, f.side ORDER BY ts DESC LIMIT ?`),
  stats: db.prepare(`SELECT COUNT(DISTINCT taker) AS wallets, COUNT(DISTINCT txHash) AS taps, COALESCE(SUM(cost),0) AS volume,
      COUNT(DISTINCT marketId) AS windows, COUNT(*) AS fills, MAX(ts) AS lastTs FROM fills`),
  followerCounts: db.prepare(`SELECT leader, COUNT(*) AS n FROM follows GROUP BY leader`),
  followersOf: db.prepare(`SELECT follower FROM follows WHERE leader = ? ORDER BY at DESC`),
  leaderOf: db.prepare(`SELECT leader FROM follows WHERE follower = ?`),
  upsertFollow: db.prepare(`INSERT INTO follows (follower,leader,at) VALUES (?,?,?) ON CONFLICT(follower) DO UPDATE SET leader=excluded.leader, at=excluded.at`),
  deleteFollow: db.prepare(`DELETE FROM follows WHERE follower = ?`),
  insertFeed: db.prepare(`INSERT INTO feed (at,actor,label,asset,side,stake,price,rationale,txHash) VALUES (@at,@actor,@label,@asset,@side,@stake,@price,@rationale,@txHash)`),
  listFeed: db.prepare(`SELECT at,actor,label,asset,side,stake,price,rationale,txHash FROM feed ORDER BY at DESC LIMIT ?`),
  tapByTx: db.prepare(`SELECT f.taker, f.marketId, f.txHash, f.side, MIN(f.ts) AS ts, SUM(f.qty) AS qty, SUM(f.cost) AS cost,
      MAX(f.result) AS result, SUM(f.pnl) AS pnl, m.asset, m.intervalSec
    FROM fills f JOIN markets m ON m.marketId = f.marketId WHERE f.txHash = ? GROUP BY f.taker, f.marketId, f.side LIMIT 1`),
  getMeta: db.prepare(`SELECT value FROM meta WHERE key = ?`),
  setMeta: db.prepare(`INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`),
};

export function upsertMarket(m: Omit<MarketRow, "result" | "fillsDone">): void {
  stmts.upsertMarket.run({ ...m, marketId: m.marketId.toLowerCase(), pool: m.pool.toLowerCase(), updatedAt: Date.now() });
}
export const getMarket = (id: string) => stmts.getMarket.get(id.toLowerCase()) as MarketRow | undefined;
export const markFillsDone = (id: string) => stmts.setFillsDone.run(id.toLowerCase());

export function insertFills(rows: Omit<FillRowDb, "result" | "pnl">[]): number {
  let n = 0;
  const tx = db.transaction((items: typeof rows) => {
    for (const r of items) n += stmts.insertFill.run({ ...r, marketId: r.marketId.toLowerCase(), pool: r.pool.toLowerCase(), taker: r.taker.toLowerCase() }).changes;
  });
  tx(rows);
  return n;
}

/** Record a market's outcome and settle every fill on it. */
export function applyResult(marketId: string, result: MarketResult): void {
  const id = marketId.toLowerCase();
  const tx = db.transaction(() => {
    stmts.setResult.run(result, Date.now(), id);
    for (const f of stmts.fillsOfMarket.all(id) as FillRowDb[]) {
      const r: Result = result === "VOID" ? "void" : f.side === result ? "win" : "loss";
      const payout = r === "win" ? f.qty : r === "void" ? f.qty * 0.5 : 0;
      stmts.setFillResult.run(r, payout - f.cost, f.id);
    }
  });
  tx();
}

interface TapAgg {
  taker: string;
  marketId: string;
  txHash: string;
  side: Side;
  ts: number;
  qty: number;
  cost: number;
  result: Result | null;
  pnl: number | null;
  asset: string;
  intervalSec: number;
}

const toTapRow = (t: TapAgg): TapRow => ({
  at: t.ts * 1000,
  asset: t.asset,
  intervalSec: t.intervalSec,
  marketId: t.marketId,
  side: t.side,
  qty: round(t.qty),
  price: t.qty > 0 ? round(t.cost / t.qty, 4) : 0,
  txHash: t.txHash,
  ...(t.result ? { result: t.result, pnl: round(t.pnl ?? 0) } : {}),
});

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

function aggregate(taps: TapAgg[], followers: Map<string, number>): Leader[] {
  const by = new Map<string, TapAgg[]>();
  for (const t of taps) by.set(t.taker, [...(by.get(t.taker) ?? []), t]);
  const out: Leader[] = [];
  for (const [address, rows] of by) {
    const settled = rows.filter((r) => r.result === "win" || r.result === "loss");
    const wins = settled.filter((r) => r.result === "win").length;
    const losses = settled.length - wins;
    // rows are newest first: current streak walks forward, best streak walks the whole tape
    let streak = 0;
    for (const r of rows) {
      if (r.result === "win") streak++;
      else if (r.result === "loss") break;
    }
    let best = 0;
    let run = 0;
    for (const r of [...rows].reverse()) {
      if (r.result === "win") best = Math.max(best, ++run);
      else if (r.result === "loss") run = 0;
    }
    out.push({
      address,
      taps: rows.length,
      wins,
      losses,
      winRate: settled.length ? round(wins / settled.length, 3) : 0,
      streak,
      bestStreak: best,
      pnlUsdc: round(rows.reduce((a, r) => a + (r.pnl ?? 0), 0)),
      volumeUsdc: round(rows.reduce((a, r) => a + r.cost, 0)),
      followers: followers.get(address) ?? 0,
      isAgent: !!AGENT_ADDRESS && address === AGENT_ADDRESS,
      ...(AGENT_ADDRESS && address === AGENT_ADDRESS ? { label: AGENT_LABEL } : {}),
    });
  }
  // rank: pnl, then win rate, then volume
  return out.sort((a, b) => b.pnlUsdc - a.pnlUsdc || b.winRate - a.winRate || b.volumeUsdc - a.volumeUsdc);
}

function followerMap(): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of stmts.followerCounts.all() as { leader: string; n: number }[]) m.set(r.leader, r.n);
  return m;
}

export function leaderboard(limit = 50): Leader[] {
  return aggregate(stmts.taps.all() as TapAgg[], followerMap()).slice(0, limit);
}

export function leader(address: string): (Leader & { recent: TapRow[] }) | null {
  const a = address.toLowerCase();
  const rows = stmts.tapsOf.all(a, 500) as TapAgg[];
  if (rows.length === 0) return null;
  const [l] = aggregate(rows, followerMap());
  return { ...l, recent: rows.slice(0, 50).map(toTapRow) };
}

export function tapByTx(txHash: string): TapRow | null {
  const r = stmts.tapByTx.get(txHash.toLowerCase()) as TapAgg | undefined;
  return r ? toTapRow(r) : null;
}

export function stats() {
  const s = stmts.stats.get() as { wallets: number; taps: number; volume: number; windows: number; fills: number; lastTs: number | null };
  return { wallets: s.wallets, taps: s.taps, volumeUsdc: round(s.volume), windows: s.windows, fills: s.fills, lastFillAt: s.lastTs ? s.lastTs * 1000 : null, updatedAt: Date.now() };
}

export function addFeed(item: FeedItem): void {
  stmts.insertFeed.run({ label: null, ...item, actor: item.actor.toLowerCase() });
}
export const listFeed = (limit = 30) =>
  (stmts.listFeed.all(limit) as (FeedItem & { label: string | null })[]).map(({ label, ...r }) => (label ? { ...r, label } : r)) as FeedItem[];

export function setFollow(follower: string, leader: string | null): void {
  if (!leader) stmts.deleteFollow.run(follower.toLowerCase());
  else stmts.upsertFollow.run(follower.toLowerCase(), leader.toLowerCase(), Date.now());
}
export function follows(address: string) {
  const a = address.toLowerCase();
  return {
    leader: (stmts.leaderOf.get(a) as { leader: string } | undefined)?.leader ?? null,
    followers: (stmts.followersOf.all(a) as { follower: string }[]).map((r) => r.follower),
  };
}

export const getMeta = (k: string) => (stmts.getMeta.get(k) as { value: string } | undefined)?.value;
export const setMeta = (k: string, v: string) => stmts.setMeta.run(k, v);
