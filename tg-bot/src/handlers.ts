// Command handlers. Flow mirrors ayazabbas/strike (bot/src/index.ts):
// commands + inline keyboards with colon-separated callback data.
import { InlineKeyboard, type Context } from "grammy";
import { isAddress } from "viem";
import { config } from "./config.js";
import {
  ASSETS,
  cadences,
  canTrade,
  fmtCadence,
  fmtCountdown,
  fmtMultiple,
  fmtProb,
  fmtPx,
  fmtUsdc,
  getClient,
  getExchange,
  listLiveWindows,
  openingPrice,
  parseCadence,
  pickWindow,
  placeTap,
  quoteFromBook,
  readBook,
  secondsLeft,
  short,
  toRaw,
  topOf,
  txUrl,
  type Asset,
  type Side,
  type TapWindow,
} from "./ec.js";
import { stateOf, type ChatState } from "./state.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };

// ── keyboards ────────────────────────────────────────────────────────────

export function mainKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  // Telegram only accepts https for web_app buttons; fall back to a plain link.
  if (config.webappUrl.startsWith("https://")) kb.webApp("⚡ Open TapFlow", config.webappUrl);
  else kb.url("⚡ Open TapFlow", config.webappUrl);
  kb.row().text("🎯 Current window", "window").text("🏆 Leaderboard", "board");
  return kb;
}

function windowKeyboard(st: ChatState, available: number[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (canTrade()) {
    kb.text("🟢 UP 1", "tap:UP:1").text("🟢 UP 5", "tap:UP:5").row();
    kb.text("🔴 DOWN 1", "tap:DOWN:1").text("🔴 DOWN 5", "tap:DOWN:5").row();
  }
  for (const a of ASSETS) kb.text(`${a === st.asset ? "• " : ""}${a}`, `asset:${a}`);
  kb.row();
  for (const s of (available.length ? available : [300, 900, 3600]).slice(0, 5)) {
    kb.text(`${s === st.intervalSec ? "• " : ""}${fmtCadence(s)}`, `cad:${s}`);
  }
  kb.row().text("🔄 Refresh", "window");
  if (config.webappUrl.startsWith("https://")) kb.webApp("⚡ Tap in app", config.webappUrl);
  else kb.url("⚡ Tap in app", config.webappUrl);
  return kb;
}

// ── /start ───────────────────────────────────────────────────────────────

export async function handleStart(ctx: Context): Promise<void> {
  const text = [
    "⚡ <b>TapFlow</b> — one-tap UP/DOWN on live Event Contracts.",
    "",
    "Every window is a DreamDEX binary market on Somnia Shannon: will BTC or ETH close above where it opened? Tap a side, your stake becomes a real order on the on-chain book. Winning shares pay 1 tUSDC.",
    "",
    "<b>Commands</b>",
    "/window [BTC|ETH] [5m|15m|1h] — the live window and its odds",
    canTrade() ? "/up &lt;amt&gt; · /down &lt;amt&gt; — tap with the bot wallet" : "/up · /down — tap from the mini-app (bot wallet not configured)",
    "/follow &lt;address&gt; — mirror a leader's taps",
    "/board — top tappers",
    "/wallet &lt;address&gt; — save your wallet for /follow",
  ].join("\n");
  await ctx.reply(text, { ...HTML, reply_markup: mainKeyboard() });
}

// ── /window ──────────────────────────────────────────────────────────────

export async function describeWindow(st: ChatState): Promise<{ text: string; kb: InlineKeyboard; w?: TapWindow }> {
  const client = getClient();
  const ex = getExchange();
  const windows = await listLiveWindows(client);
  const available = cadences(windows, st.asset);
  // The short series only run in main trading hours. Rather than answering "no
  // window" to someone trying the bot for the first time, show the soonest live
  // one for this asset, then any asset, and say that is what happened.
  let w = pickWindow(windows, st.asset, st.intervalSec, 10);
  let switched: string | null = null;
  if (!w && available.length) {
    st.intervalSec = available[0];
    w = pickWindow(windows, st.asset, st.intervalSec, 10);
    if (w) switched = `no ${fmtCadence(st.intervalSec)} … showing the soonest live ${st.asset} window`;
  }
  if (!w && windows.length) {
    const soonest = [...windows].sort((a, b) => a.expiry - b.expiry)[0];
    st.asset = soonest.asset;
    st.intervalSec = soonest.intervalSec;
    w = soonest;
    switched = `no live ${st.asset} window … showing the soonest one on the venue`;
  }
  if (!w) {
    return {
      text: `No live windows on the venue right now. They roll continuously, so try again in a minute — or open the app to watch for the next one.`,
      kb: windowKeyboard(st, available),
    };
  }
  const [book, spot] = await Promise.all([readBook(client, w, 10), ex.fetchPrice(w.asset).catch(() => null)]);
  const top = topOf(book);
  const spotPx = spot?.price ?? null;
  const open = await openingPrice(client, w, spotPx);
  const move = open && spotPx ? (spotPx - open) / open : null;
  const q5 = { up: quoteFromBook(book, "UP", toRaw(5)), down: quoteFromBook(book, "DOWN", toRaw(5)) };

  const lines = [
    ...(switched ? [`<i>${esc(switched)}</i>`, ""] : []),
    `🎯 <b>${w.asset} · ${fmtCadence(w.intervalSec)} window</b>  ⏱ <b>${fmtCountdown(secondsLeft(w))}</b> left`,
    `closes ${new Date(w.expiry * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`,
    "",
    `${w.asset} now: <b>${spotPx ? fmtPx(spotPx) : "—"}</b>${open ? `  · opened ${fmtPx(open)}` : ""}${
      move !== null ? `  · ${move >= 0 ? "▲" : "▼"} ${(Math.abs(move) * 100).toFixed(3)}%` : ""
    }`,
    "",
    `🟢 <b>UP ${fmtProb(top.up)}</b>${q5.up ? `  · 5 → ${fmtUsdc(q5.up.payoutIfWin)} (${fmtMultiple(q5.up.avgPrice)})` : "  · no liquidity"}`,
    `🔴 <b>DOWN ${fmtProb(top.down)}</b>${q5.down ? `  · 5 → ${fmtUsdc(q5.down.payoutIfWin)} (${fmtMultiple(q5.down.avgPrice)})` : "  · no liquidity"}`,
    "",
    `<code>pool ${short(w.pool)} · market ${short(w.marketId, 6)}</code>`,
  ];
  return { text: lines.join("\n"), kb: windowKeyboard(st, available), w };
}

export async function handleWindow(ctx: Context, args: string[] = []): Promise<void> {
  const st = stateOf(ctx.chat!.id);
  for (const a of args) {
    const up = a.toUpperCase();
    if (up === "BTC" || up === "ETH") st.asset = up as Asset;
    const c = parseCadence(a);
    if (c) st.intervalSec = c;
  }
  const pending = await ctx.reply("⏳ reading the window…");
  try {
    const { text, kb } = await describeWindow(st);
    await ctx.api.editMessageText(ctx.chat!.id, pending.message_id, text, { ...HTML, reply_markup: kb });
  } catch (e) {
    await ctx.api.editMessageText(ctx.chat!.id, pending.message_id, `Couldn't read the window: ${esc(errText(e))}`);
  }
}

// ── /up /down ────────────────────────────────────────────────────────────

export function parseAmount(s: string | undefined, fallback = 1): number {
  const n = Number((s ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(config.maxStake, Math.max(0.5, n));
}

export async function handleTap(ctx: Context, side: Side, amount: number): Promise<void> {
  const st = stateOf(ctx.chat!.id);
  if (!canTrade()) {
    await ctx.reply(
      `The bot has no trading wallet configured, so it can't tap for you. Open the mini-app and tap <b>${side}</b> there — same window, same odds, your own wallet.`,
      { ...HTML, reply_markup: mainKeyboard() },
    );
    return;
  }
  const client = getClient();
  const ex = getExchange();
  const pending = await ctx.reply(`⏳ ${side} · ${amount} tUSDC on ${st.asset} ${fmtCadence(st.intervalSec)}…`);
  const edit = (t: string, kb?: InlineKeyboard) => ctx.api.editMessageText(ctx.chat!.id, pending.message_id, t, { ...HTML, reply_markup: kb });
  try {
    const windows = await listLiveWindows(client, { asset: st.asset });
    const w = pickWindow(windows, st.asset, st.intervalSec, 15);
    if (!w) return void (await edit(`No live ${st.asset} ${fmtCadence(st.intervalSec)} window with enough time left.`));
    const book = await readBook(client, w, 10);
    const q = quoteFromBook(book, side, toRaw(amount));
    if (!q) return void (await edit(`No liquidity on the ${side} side right now.`));
    const r = await placeTap(ex, w, q);
    if (r.filled === 0n) {
      await edit(`↩ Book moved, nothing filled. <a href="${txUrl(r.hash)}">tx</a>`, windowKeyboard(st, cadences(windows, st.asset)));
      return;
    }
    await edit(
      [
        `${side === "UP" ? "🟢" : "🔴"} <b>${side} filled</b> on ${w.asset} ${fmtCadence(w.intervalSec)}`,
        `${fmtUsdc(r.filled)} shares @ ${fmtProb(r.avgPrice)} for ${fmtUsdc(r.paid)} tUSDC`,
        `pays <b>${fmtUsdc(r.filled)}</b> if right (+${fmtUsdc(r.filled - r.paid)})`,
        `⏱ ${fmtCountdown(secondsLeft(w))} to settlement`,
        `<a href="${txUrl(r.hash)}">view on Shannon explorer</a>`,
      ].join("\n"),
      windowKeyboard(st, cadences(windows, st.asset)),
    );
  } catch (e) {
    await edit(`❌ ${esc(errText(e))}`);
  }
}

// ── /follow ──────────────────────────────────────────────────────────────

export async function handleFollow(ctx: Context, leaderArg: string | undefined): Promise<void> {
  const st = stateOf(ctx.chat!.id);
  const leader = (leaderArg ?? "").trim();
  if (!isAddress(leader)) {
    await ctx.reply("Usage: /follow &lt;0xLeaderAddress&gt; — find leaders with /board.", HTML);
    return;
  }
  const follower = st.wallet ?? (config.botPrivateKey ? getExchange().walletAddress : undefined);
  if (!follower) {
    await ctx.reply("Tell me your wallet first: /wallet &lt;0xYourAddress&gt; — then /follow again.", HTML);
    return;
  }
  try {
    const res = await fetch(`${config.tapflowApi}/api/follow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ follower, leader }),
    });
    if (!res.ok) throw new Error(`indexer ${res.status}`);
    await ctx.reply(
      `✅ <b>${short(follower)}</b> now follows <b>${short(leader)}</b>.\nOn-chain mirroring (same block via Somnia reactivity) needs a MirrorVault deposit — do that in the app under Leaders.`,
      { ...HTML, reply_markup: mainKeyboard() },
    );
  } catch (e) {
    await ctx.reply(`Couldn't record the follow: ${esc(errText(e))}`);
  }
}

export async function handleWallet(ctx: Context, addr: string | undefined): Promise<void> {
  const st = stateOf(ctx.chat!.id);
  const a = (addr ?? "").trim();
  if (!isAddress(a)) {
    await ctx.reply(st.wallet ? `Saved wallet: <code>${st.wallet}</code>\nChange it with /wallet &lt;0x…&gt;` : "Usage: /wallet &lt;0xYourAddress&gt;", HTML);
    return;
  }
  st.wallet = a as `0x${string}`;
  await ctx.reply(`Saved <code>${a}</code> for /follow.`, HTML);
}

// ── /board ───────────────────────────────────────────────────────────────

interface Leader {
  address: string;
  taps: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  pnlUsdc: number;
  followers: number;
  isAgent: boolean;
  label?: string;
}

export async function handleBoard(ctx: Context): Promise<void> {
  try {
    const res = await fetch(`${config.tapflowApi}/api/leaderboard?limit=10`);
    if (!res.ok) throw new Error(`indexer ${res.status}`);
    const rows = (await res.json()) as Leader[];
    if (!rows.length) {
      await ctx.reply("No tappers on the board yet. Be the first — /window", { reply_markup: mainKeyboard() });
      return;
    }
    const medals = ["🥇", "🥈", "🥉"];
    const lines = rows.map((l, i) => {
      const name = l.label ?? short(l.address);
      const pnl = `${l.pnlUsdc >= 0 ? "+" : ""}${l.pnlUsdc.toFixed(2)}`;
      return `${medals[i] ?? `${i + 1}.`} <b>${esc(name)}</b>${l.isAgent ? " 🤖" : ""} · ${Math.round(l.winRate * 100)}% · ${l.streak > 0 ? `🔥${l.streak} · ` : ""}${pnl} · ${l.followers} followers\n<code>/follow ${l.address}</code>`;
    });
    await ctx.reply(`🏆 <b>Top tappers</b>\n\n${lines.join("\n\n")}`, { ...HTML, reply_markup: mainKeyboard() });
  } catch (e) {
    await ctx.reply(`Leaderboard unavailable: ${esc(errText(e))}`);
  }
}

// ── callbacks ────────────────────────────────────────────────────────────

export async function handleCallback(ctx: Context, data: string): Promise<void> {
  const st = stateOf(ctx.chat!.id);
  const [kind, a, b] = data.split(":");
  if (kind === "window") {
    const { text, kb } = await describeWindow(st);
    await ctx.editMessageText(text, { ...HTML, reply_markup: kb }).catch(() => ctx.reply(text, { ...HTML, reply_markup: kb }));
  } else if (kind === "board") {
    await handleBoard(ctx);
  } else if (kind === "asset" && (a === "BTC" || a === "ETH")) {
    st.asset = a;
    const { text, kb } = await describeWindow(st);
    await ctx.editMessageText(text, { ...HTML, reply_markup: kb }).catch(() => undefined);
  } else if (kind === "cad" && Number(a) > 0) {
    st.intervalSec = Number(a);
    const { text, kb } = await describeWindow(st);
    await ctx.editMessageText(text, { ...HTML, reply_markup: kb }).catch(() => undefined);
  } else if (kind === "tap" && (a === "UP" || a === "DOWN")) {
    await handleTap(ctx, a, parseAmount(b, 1));
  }
}

export function errText(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  return m.split("\n")[0].slice(0, 160);
}
