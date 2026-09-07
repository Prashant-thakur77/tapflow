// TapBot — a momentum agent that taps as a public TapFlow leader.
//
// Each loop it samples BTC/ETH spot, reads its momentum, runs the risk gate,
// and when the gate says yes places a real IOC tap on the shortest live window,
// broadcasts it through the Router so followers mirror it in-block, and
// publishes a one-line rationale to the TapFlow feed. When the gate says no it
// publishes the reason too (at most one heartbeat per reason per 10 minutes),
// and every loop it sweeps settled winnings back to the wallet.
// Read-only until AGENT_PRIVATE_KEY is set.
//
//   npm start            # live loop (needs AGENT_PRIVATE_KEY funded on Shannon)
//   npm run signal       # read-only: print the current signal, place nothing

import { config, env } from "./config.js";
import {
  ASSETS,
  canTrade,
  fmtCadence,
  fmtUsdc,
  getClient,
  getExchange,
  listLiveWindows,
  pickWindow,
  placeTap,
  quoteFromBook,
  readBook,
  secondsLeft,
  toRaw,
  txUrl,
  type Side,
  type TapWindow,
} from "./ec.js";
import { Momentum, decide } from "./momentum.js";
import { broadcast, postFeed } from "./feed.js";
import { Ledger, gate, riskFromEnv, type Verdict } from "./risk.js";
import { maybeClaim } from "./claim.js";
import { privateKeyToAccount } from "viem/accounts";

const ex = getExchange();
const client = getClient();
const mom = new Momentum();
const ledger = new Ledger();
const risk = riskFromEnv(env, config.minLeftSec);
const me = config.botPrivateKey ? privateKeyToAccount(config.botPrivateKey).address : "0x0000000000000000000000000000000000000000";

let placing = false;
let lastHold: { code: string; at: number } = { code: "", at: 0 };
// A reason has to persist for a few ticks before it is worth telling followers —
// upstream indexer hiccups flip NO_WINDOW on and off and must not reach the feed.
let stable: { code: string; ticks: number } = { code: "", ticks: 0 };
const HOLD_MIN_GAP_MS = 2 * 60_000;
const HOLD_STABLE_TICKS = 3;

async function sample() {
  for (const a of ASSETS) {
    try {
      const p = await ex.fetchPrice(a);
      if (p) mom.push(a, p.price);
    } catch {
      /* transient */
    }
  }
}

/** The window to trade: the configured cadence, or the shortest live one. */
function chooseWindow(windows: TapWindow[], asset: typeof config.asset): TapWindow | undefined {
  if (config.cadence !== "auto" && config.cadenceSec > 0) return pickWindow(windows, asset, config.cadenceSec, config.minLeftSec);
  const cads = [...new Set(windows.filter((w) => w.asset === asset).map((w) => w.intervalSec))].sort((a, b) => a - b);
  for (const c of cads) {
    const w = pickWindow(windows, asset, c, config.minLeftSec);
    if (w && secondsLeft(w) >= config.minLeftSec) return w;
  }
  return undefined;
}

/** Publish a hold to the feed, but only when the reason changes or the heartbeat is due. */
async function publishHold(asset: typeof config.asset, v: Verdict, w: TapWindow | undefined, price: number | null) {
  stable = stable.code === v.code ? { code: v.code, ticks: stable.ticks + 1 } : { code: v.code, ticks: 1 };
  const changed = v.code !== lastHold.code && stable.ticks >= HOLD_STABLE_TICKS && Date.now() - lastHold.at > HOLD_MIN_GAP_MS;
  const heartbeat = Date.now() - lastHold.at > config.holdHeartbeatMs;
  if (!(changed || heartbeat) || !canTrade()) return;
  lastHold = { code: v.code, at: Date.now() };
  await postFeed({
    at: Date.now(),
    actor: me,
    label: config.label,
    asset,
    side: "HOLD",
    stake: 0,
    price: price ?? 0,
    rationale: `${v.reason}${w ? ` (${fmtCadence(w.intervalSec)} window, ${Math.round(secondsLeft(w))}s left)` : ""}`,
    txHash: "",
    code: v.code,
  });
}

async function tick() {
  await sample();
  if (placing) return;

  const asset = config.asset;
  const m = mom.read(asset);
  const call = decide(asset, m, config.momentumBps);
  const stamp = new Date().toISOString().slice(11, 19);

  const windows = await listLiveWindows(client, { asset }).catch(() => [] as TapWindow[]);
  const w = chooseWindow(windows, asset);
  let q = null;
  let otherAsk: number | null = null;
  if (w && call.side) {
    const book = await readBook(client, w).catch(() => null);
    if (book) {
      q = quoteFromBook(book, call.side, toRaw(config.stakeUsdc));
      const other = quoteFromBook(book, call.side === "UP" ? "DOWN" : "UP", toRaw(config.stakeUsdc));
      otherAsk = other?.impliedProb ?? null;
    }
  }

  const verdict = gate(
    { w, side: call.side, bps: m?.bps ?? null, q, otherAsk, stakeUsdc: config.stakeUsdc, secondsLeft: w ? secondsLeft(w) : 0, ledger },
    risk,
  );

  if (!verdict.ok || !w || !q || !call.side) {
    console.log(`[${stamp}] HOLD ${verdict.code}: ${verdict.reason}`);
    await publishHold(asset, verdict, w, q?.impliedProb ?? null);
    await sweep(stamp);
    return;
  }

  const side: Side = call.side;
  const rationale = `${call.rationale} · ${verdict.reason} (${fmtCadence(w.intervalSec)} window, ${Math.round(secondsLeft(w))}s left)`;

  if (config.dryRun || !canTrade()) {
    console.log(`[${stamp}] DRY ${side} ${config.stakeUsdc} ${asset} — ${rationale}`);
    return;
  }

  placing = true;
  try {
    const r = await placeTap(ex, w, q);
    if (r.filled > 0n) {
      ledger.record(w, side, Number(r.paid) / 1e6);
      lastHold = { code: "", at: 0 };
      console.log(`[${stamp}] TAP ${side} ${asset} ${fmtUsdc(r.filled)} @ ${Math.round(r.avgPrice * 100)}% — ${txUrl(r.hash)}`);
      const bhash = await broadcast(config.botPrivateKey!, {
        marketId: w.marketId,
        pool: w.pool,
        side,
        qty: r.filled,
        price: q.limitYesPrice,
        expiryNs: BigInt(Math.min(Math.floor(Date.now() / 1000) + 120, w.expiry)) * 1_000_000_000n,
      }).catch((e) => {
        console.warn("broadcast failed:", (e as Error).message);
        return null;
      });
      if (bhash) console.log(`[${stamp}] broadcast → ${txUrl(bhash)}`);
      await postFeed({ at: Date.now(), actor: me, label: config.label, asset, side, stake: config.stakeUsdc, price: q.impliedProb, rationale, txHash: r.hash, code: "OK" });
    } else {
      console.log(`[${stamp}] ${side} ${asset} — book moved, no fill`);
    }
  } catch (e) {
    console.warn(`[${stamp}] tap failed:`, (e as Error).message);
  } finally {
    placing = false;
  }
  await sweep(stamp);
}

/** Auto-claim settled winnings, serialised with the tap loop (same key, same nonce). */
async function sweep(stamp: string) {
  if (!config.autoClaim || !canTrade() || config.dryRun) return;
  try {
    const r = await maybeClaim(ex);
    if (r && r.claimed > 0) console.log(`[${stamp}] CLAIMED ${r.payoutUsdc} tUSDC from ${r.claimed} window(s)${r.hash ? ` — ${txUrl(r.hash)}` : ""}`);
  } catch (e) {
    console.warn(`[${stamp}] claim sweep failed:`, (e as Error).message.slice(0, 120));
  }
}

async function main() {
  console.log(`TapBot (${config.label})  asset=${config.asset} cadence=${config.cadence === "auto" ? "auto (shortest live)" : fmtCadence(config.cadenceSec)} stake=${config.stakeUsdc} tUSDC`);
  console.log(`wallet ${me} · trading=${canTrade() && !config.dryRun} · router=${config.routerAddress ?? "unset"} · feed=${config.tapflowApi}`);
  console.log(`risk: max price ${Math.round(risk.maxPrice * 100)}¢ · min edge ${risk.minEdgePts}pt · cooldown ${risk.cooldownSec}s · window cap ${risk.maxWindowUsdc} tUSDC · auto-claim ${config.autoClaim}`);
  if (!canTrade()) console.log("No AGENT_PRIVATE_KEY — running in read-only signal mode (no orders).");
  await sample();
  setInterval(() => void tick(), config.intervalMs);
}

void main();
