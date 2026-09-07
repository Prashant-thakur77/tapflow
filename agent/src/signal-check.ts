// Read-only proof the agent's data path works: sample spot a few times, print the
// momentum signal and the window it would tap. Places nothing.
//
//   npm run signal

import { config } from "./config.js";
import { ASSETS, fmtCadence, getClient, getExchange, listLiveWindows, pickWindow, quoteFromBook, readBook, secondsLeft, toRaw } from "./ec.js";
import { Momentum, decide } from "./momentum.js";

const ex = getExchange();
const client = getClient();
const mom = new Momentum(20_000);

async function sample() {
  for (const a of ASSETS) {
    const p = await ex.fetchPrice(a).catch(() => null);
    if (p) mom.push(a, p.price);
  }
}

async function run() {
  console.log(`signal check · asset=${config.asset} cadence=${fmtCadence(config.cadenceSec)} threshold=${config.momentumBps}bps\n`);
  for (let i = 0; i < 4; i++) {
    await sample();
    await new Promise((r) => setTimeout(r, 2500));
  }
  for (const a of ASSETS) {
    const m = mom.read(a);
    const call = decide(a, m, config.momentumBps);
    console.log(`${a}: ${m ? `${m.last.toFixed(2)} (${m.bps >= 0 ? "+" : ""}${m.bps.toFixed(1)}bps, ${m.samples} samples)` : "no data"} → ${call.rationale}`);
  }
  const asset = config.asset === "AUTO" ? "BTC" : config.asset;
  const windows = await listLiveWindows(client, { asset });
  const w = pickWindow(windows, asset, config.cadenceSec || 300, config.minLeftSec);
  if (w) {
    const book = await readBook(client, w);
    const up = quoteFromBook(book, "UP", toRaw(config.stakeUsdc));
    const down = quoteFromBook(book, "DOWN", toRaw(config.stakeUsdc));
    console.log(
      `\nwindow ${config.asset} ${fmtCadence(w.intervalSec)} · ${Math.round(secondsLeft(w))}s left · ` +
        `UP ${up ? Math.round(up.impliedProb * 100) + "%" : "—"} · DOWN ${down ? Math.round(down.impliedProb * 100) + "%" : "—"} · pool ${w.pool}`,
    );
  } else {
    console.log(`\nno live ${config.asset} ${fmtCadence(config.cadenceSec)} window right now`);
  }
  process.exit(0);
}

void run();
