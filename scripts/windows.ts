// Read-only smoke test of src/lib/ec against Shannon: live windows, top of
// book, spot price, and a dry quote for a 5 tUSDC UP tap. Sends nothing.
//
//   npx tsx scripts/windows.ts

import "dotenv/config";
import { getClient, getExchange, listLiveWindows, pickWindow, readTop, quoteTap, fmtCadence, fmtCountdown, fmtProb, fmtUsdc, toRaw, ASSETS } from "../src/lib/ec";

const client = getClient();
const ex = getExchange();

const windows = await listLiveWindows(client);
console.log(`live windows on venue: ${windows.length}\n`);
for (const w of windows) {
  const top = await readTop(client, w);
  console.log(
    `${w.asset.padEnd(3)} ${fmtCadence(w.intervalSec).padStart(3)}  closes in ${fmtCountdown(w.expiry - Date.now() / 1000).padStart(6)}  ` +
      `UP ask ${fmtProb(top.up).padStart(4)}  DOWN ask ${fmtProb(top.down).padStart(4)}  strike=${w.strike}  pool=${w.pool}`,
  );
}

for (const asset of ASSETS) {
  const p = await ex.fetchPrice(asset).catch(() => null);
  console.log(`\nspot ${asset}: ${p ? `${p.price} (ema ${p.ema})` : "feed unavailable"}`);
}

const w = pickWindow(windows, "BTC", 300) ?? pickWindow(windows, "BTC", 900) ?? windows[0];
if (w) {
  const opening = await client.getOpeningPrices([w.marketId]).catch((e) => ({ error: String(e) }));
  console.log(`\nopening price for ${w.marketId}:`, opening);
  const reso = await client.getMarketResolution(w.marketId).catch((e) => ({ error: String(e).slice(0, 200) }));
  console.log(`resolution row:`, JSON.stringify(reso, (_k, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 600));
  for (const side of ["UP", "DOWN"] as const) {
    const q = await quoteTap(client, w, side, toRaw(5));
    console.log(`\ndry quote: 5 tUSDC ${side} on ${w.asset} ${fmtCadence(w.intervalSec)} (${fmtCountdown(w.expiry - Date.now() / 1000)} left)`);
    console.log(
      q
        ? `  buys ${fmtUsdc(q.quantity)} shares @ avg ${fmtProb(q.avgPrice)} (best ask ${fmtProb(q.impliedProb)})  cost ${fmtUsdc(q.expectedCost)}  max ${fmtUsdc(q.escrow)}  ` +
            `limit(YES) ${Number(q.limitYesPrice) / 1e6}  win → +${fmtUsdc(q.profitIfWin)}`
        : "  nothing fillable (empty book)",
    );
  }
}

process.exit(0);
