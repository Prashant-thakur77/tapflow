// TapBot — a momentum agent that taps as a public TapFlow leader.
//
// Each loop it samples BTC/ETH spot, reads its momentum, and on a strong enough
// move places a real IOC tap on the shortest live window, broadcasts it through
// the Router so followers mirror it in-block, and publishes a one-line rationale
// to the TapFlow feed. Read-only until AGENT_PRIVATE_KEY is set.
//
//   npm start            # live loop (needs AGENT_PRIVATE_KEY funded on Shannon)
//   npm run signal       # read-only: print the current signal, place nothing

import { config } from "./config.js";
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
} from "./ec.js";
import { Momentum, decide } from "./momentum.js";
import { broadcast, postFeed } from "./feed.js";
import { privateKeyToAccount } from "viem/accounts";

const ex = getExchange();
const client = getClient();
const mom = new Momentum();
const me = config.botPrivateKey ? privateKeyToAccount(config.botPrivateKey).address : "0x0000000000000000000000000000000000000000";

let placing = false;

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

async function tick() {
  await sample();
  if (placing) return;

  const asset = config.asset;
  const m = mom.read(asset);
  const call = decide(asset, m, config.momentumBps);
  const stamp = new Date().toISOString().slice(11, 19);

  if (!call.side) {
    console.log(`[${stamp}] ${call.rationale}`);
    return;
  }

  const windows = await listLiveWindows(client, { asset });
  const w = pickWindow(windows, asset, config.cadenceSec, config.minLeftSec);
  if (!w) {
    console.log(`[${stamp}] ${call.rationale} — but no live ${asset} ${fmtCadence(config.cadenceSec)} window`);
    return;
  }
  const book = await readBook(client, w);
  const q = quoteFromBook(book, call.side, toRaw(config.stakeUsdc));
  if (!q) {
    console.log(`[${stamp}] ${call.rationale} — but book too thin to fill`);
    return;
  }

  const rationale = `${call.rationale} @ ${Math.round(q.impliedProb * 100)}% (${fmtCadence(w.intervalSec)} window, ${Math.round(secondsLeft(w))}s left)`;

  if (config.dryRun || !canTrade()) {
    console.log(`[${stamp}] DRY ${call.side} ${config.stakeUsdc} ${asset} — ${rationale}`);
    return;
  }

  placing = true;
  try {
    const r = await placeTap(ex, w, q);
    if (r.filled > 0n) {
      console.log(`[${stamp}] TAP ${call.side} ${asset} ${fmtUsdc(r.filled)} @ ${Math.round(r.avgPrice * 100)}% — ${txUrl(r.hash)}`);
      const bhash = await broadcast(config.botPrivateKey!, {
        marketId: w.marketId,
        pool: w.pool,
        side: call.side,
        qty: r.filled,
        price: q.limitYesPrice,
        expiryNs: BigInt(Math.min(Math.floor(Date.now() / 1000) + 120, w.expiry)) * 1_000_000_000n,
      }).catch((e) => {
        console.warn("broadcast failed:", (e as Error).message);
        return null;
      });
      if (bhash) console.log(`[${stamp}] broadcast → ${txUrl(bhash)}`);
      await postFeed({
        at: Date.now(),
        actor: me,
        label: config.label,
        asset,
        side: call.side,
        stake: config.stakeUsdc,
        price: q.impliedProb,
        rationale,
        txHash: r.hash,
      });
    } else {
      console.log(`[${stamp}] ${call.side} ${asset} — book moved, no fill`);
    }
  } catch (e) {
    console.warn(`[${stamp}] tap failed:`, (e as Error).message);
  } finally {
    placing = false;
  }
}

async function main() {
  console.log(`TapBot (${config.label})  asset=${config.asset} cadence=${fmtCadence(config.cadenceSec)} stake=${config.stakeUsdc} tUSDC`);
  console.log(`wallet ${me} · trading=${canTrade() && !config.dryRun} · router=${config.routerAddress ?? "unset"} · feed=${config.tapflowApi}`);
  if (!canTrade()) console.log("No AGENT_PRIVATE_KEY — running in read-only signal mode (no orders).");
  // Prime the momentum buffer, then loop.
  await sample();
  setInterval(() => void tick(), config.intervalMs);
}

void main();
