import http from "node:http";
import { AGENT_ADDRESS, AGENT_LABEL, APP_URL, FEED_SECRET, PORT } from "./config.js";
import { liveWindowsFromChain } from "./newmarkets.js";
import { followerClaimables } from "./mirrors.js";
import { addFeed, follows, leader, leaderboard, listFeed, marketPositions, recentFills, setFollow, settledMarkets, stats, tapByTx, type FeedItem } from "./db.js";
import { lastSync } from "./chain.js";
import { listMirrors, proofSummary } from "./mirrors.js";
import { chainFillsCursor } from "./chainfills.js";
import { ogCard, type Tone } from "./og.js";

const isAddr = (s: unknown): s is string => typeof s === "string" && /^0x[0-9a-fA-F]{40}$/.test(s);
const isTx = (s: unknown): s is string => typeof s === "string" && /^0x[0-9a-fA-F]{64}$/.test(s);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const cad = (s: number) => (s >= 3600 ? `${s / 3600}h` : `${Math.round(s / 60)}m`);

function send(res: http.ServerResponse, code: number, body: unknown, type = "application/json"): void {
  res.writeHead(code, {
    "content-type": `${type}; charset=utf-8`,
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "cache-control": type.startsWith("image") ? "public, max-age=60" : "no-store",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("invalid JSON body");
  }
}

function svg(res: http.ServerResponse, s: string) {
  send(res, 200, s, "image/svg+xml");
}

export function startApi(): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const p = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (req.method === "OPTIONS") return send(res, 204, "");

      if (p === "/" || p === "/api") return send(res, 200, { name: "tapflow-indexer", endpoints: ["/api/health", "/api/stats", "/api/windows", "/api/recent", "/api/settled", "/api/market/:id/positions", "/api/mirrors", "/api/follower/:address/claimable", "/api/proof", "/api/leaderboard", "/api/leader/:address", "/api/feed", "/api/follows/:address", "/api/og"] });
      if (p === "/api/health") {
        const s = stats();
        return send(res, 200, { ok: true, lastBlock: chainFillsCursor, fills: s.fills, lastSync });
      }
      if (p === "/api/stats") return send(res, 200, stats());
      if (p === "/api/windows") return send(res, 200, await liveWindowsFromChain());
      if (p === "/api/mirrors") {
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
        return send(res, 200, listMirrors(limit));
      }
      if (p === "/api/proof") return send(res, 200, proofSummary());
      if (p === "/api/settled") {
        const asset = (url.searchParams.get("asset") ?? "").toUpperCase();
        const intervalSec = Number(url.searchParams.get("intervalSec") ?? 0) || 0;
        const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") ?? 12)));
        return send(res, 200, settledMarkets(asset, intervalSec, limit));
      }
      if (p === "/api/recent") {
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
        return send(res, 200, recentFills(limit));
      }
      if (p.startsWith("/api/market/") && p.endsWith("/positions")) {
        const id = p.slice("/api/market/".length, -"/positions".length);
        if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return send(res, 400, { error: "bad marketId" });
        return send(res, 200, marketPositions(id, Math.min(50, Number(url.searchParams.get("limit") ?? 20))));
      }
      if (p === "/api/leaderboard") {
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
        return send(res, 200, leaderboard(limit));
      }
      if (p.startsWith("/api/leader/")) {
        const a = p.slice("/api/leader/".length);
        if (!isAddr(a)) return send(res, 400, { error: "bad address" });
        const l = leader(a);
        return l ? send(res, 200, l) : send(res, 404, { error: "no taps for this address" });
      }
      if (p === "/api/feed" && req.method === "GET") {
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
        return send(res, 200, listFeed(limit, url.searchParams.get("taps") === "1"));
      }
      if (p === "/api/feed" && req.method === "POST") {
        const body = await readJson(req);
        if (FEED_SECRET && body.secret !== FEED_SECRET) return send(res, 401, { error: "bad secret" });
        const it = body.item as Partial<FeedItem> | undefined;
        if (!it || !isAddr(it.actor) || (it.side !== "UP" && it.side !== "DOWN" && it.side !== "HOLD") || typeof it.rationale !== "string" || typeof it.asset !== "string") {
          return send(res, 400, { error: "item needs actor, asset, side, stake, price, rationale, txHash" });
        }
        addFeed({
          at: Number(it.at ?? Date.now()),
          actor: it.actor,
          label: it.label ?? (AGENT_ADDRESS && it.actor.toLowerCase() === AGENT_ADDRESS ? AGENT_LABEL : undefined),
          asset: it.asset,
          side: it.side,
          stake: Number(it.stake ?? 0),
          price: Number(it.price ?? 0),
          rationale: it.rationale.slice(0, 280),
          txHash: String(it.txHash ?? ""),
          ...(typeof it.code === "string" ? { code: it.code.slice(0, 32) } : {}),
        });
        return send(res, 201, { ok: true });
      }
      if (p.startsWith("/api/follower/") && p.endsWith("/claimable")) {
        const a = p.slice("/api/follower/".length, -"/claimable".length);
        if (!isAddr(a)) return send(res, 400, { error: "bad address" });
        return send(res, 200, await followerClaimables(a));
      }
      if (p.startsWith("/api/follows/")) {
        const a = p.slice("/api/follows/".length);
        if (!isAddr(a)) return send(res, 400, { error: "bad address" });
        return send(res, 200, follows(a));
      }
      if (p === "/api/follow" && req.method === "POST") {
        const body = await readJson(req);
        if (!isAddr(body.follower)) return send(res, 400, { error: "follower must be an address" });
        const leaderAddr = body.leader;
        if (leaderAddr !== null && leaderAddr !== "" && leaderAddr !== undefined && !isAddr(leaderAddr)) return send(res, 400, { error: "leader must be an address or null" });
        setFollow(body.follower, isAddr(leaderAddr) ? leaderAddr : null);
        return send(res, 200, { ok: true, ...follows(body.follower) });
      }

      // ── share cards ──
      if (p === "/api/og") {
        const tone = (["win", "loss", "flat"].includes(url.searchParams.get("tone") ?? "") ? url.searchParams.get("tone") : "flat") as Tone;
        return svg(res, ogCard({ title: url.searchParams.get("title") ?? "TapFlow", sub: url.searchParams.get("sub") ?? undefined, tone, footer: `${APP_URL.replace(/^https?:\/\//, "")} · Somnia × DreamDEX` }));
      }
      if (p.startsWith("/api/og/leader/")) {
        const a = p.slice("/api/og/leader/".length);
        if (!isAddr(a)) return send(res, 400, { error: "bad address" });
        const l = leader(a);
        if (!l) return svg(res, ogCard({ title: short(a), sub: "no taps yet", tone: "flat" }));
        const name = l.label ?? short(a);
        return svg(res, ogCard({ title: `${name} ${l.pnlUsdc >= 0 ? "+" : ""}${l.pnlUsdc.toFixed(2)}`, sub: `${l.wins}W · ${l.losses}L${l.streak > 1 ? ` · ${l.streak}-streak` : ""} · ${l.followers} followers`, tone: l.pnlUsdc >= 0 ? "win" : "loss", badge: l.isAgent ? "AGENT LEADER · TAPFLOW" : "LEADER · TAPFLOW" }));
      }
      if (p.startsWith("/api/og/tap/")) {
        const h = p.slice("/api/og/tap/".length);
        if (!isTx(h)) return send(res, 400, { error: "bad tx hash" });
        const t = tapByTx(h);
        if (!t) return svg(res, ogCard({ title: "tap not indexed yet", sub: short(h), tone: "flat" }));
        const won = t.result === "win";
        const tone: Tone = t.result === "win" ? "win" : t.result === "loss" ? "loss" : "flat";
        const mark = t.result === "win" ? "✓" : t.result === "loss" ? "✗" : t.result === "void" ? "~" : "…";
        const pnl = t.pnl !== undefined ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)} tUSDC` : `${t.qty.toFixed(2)} shares @ ${Math.round(t.price * 100)}%`;
        return svg(res, ogCard({ title: `${won ? "🟢" : t.result === "loss" ? "🔴" : "⚪"} ${t.side} ${mark}`, sub: `${pnl} · ${t.asset} ${cad(t.intervalSec)}`, tone }));
      }

      return send(res, 404, { error: "not found" });
    } catch (e) {
      return send(res, 500, { error: String((e as Error).message ?? e).slice(0, 200) });
    }
  });
  server.listen(PORT, () => console.log(`api: http://localhost:${PORT}/api`));
  return server;
}
