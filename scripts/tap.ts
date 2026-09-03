// Place ONE real tap on Shannon from the command line, through the same lib the
// web app uses. Needs PRIVATE_KEY in .env (a wallet holding STT for gas and
// tUSDC). Prints the tx hash + explorer link — those go in the README.
//
//   npx tsx scripts/tap.ts BTC 5m UP 1        # 1 tUSDC on BTC 5-minute window, UP
//   npx tsx scripts/tap.ts ETH 15m DOWN 5
//   npx tsx scripts/tap.ts faucet             # mint tUSDC from the testnet faucet

import "dotenv/config";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  bindSigner,
  getClient,
  getExchange,
  listLiveWindows,
  pickWindow,
  quoteTap,
  placeTap,
  windowPosition,
  fmtCadence,
  fmtCountdown,
  fmtProb,
  fmtUsdc,
  toRaw,
  txUrl,
  COLLATERAL,
  type Asset,
  type Side,
} from "../src/lib/ec";

const pk = process.env.PRIVATE_KEY as Hex | undefined;
if (!pk || pk === "0x...") {
  console.error("Set PRIVATE_KEY in .env (funded Shannon key).");
  process.exit(1);
}
const me = privateKeyToAccount(pk).address;
const ex = getExchange();
const client = getClient();
bindSigner({ privateKey: pk });

const [a0, cadence = "5m", s0 = "UP", amt = "1"] = process.argv.slice(2);

if (a0 === "faucet") {
  const res = await ex.trader.faucet();
  console.log(`faucet tx ${res.hash}\n${txUrl(res.hash)}`);
  process.exit(0);
}

const asset = (a0 ?? "BTC").toUpperCase() as Asset;
const side = s0.toUpperCase() as Side;
const intervalSec = cadence.endsWith("h") ? parseInt(cadence) * 3600 : parseInt(cadence) * 60;
const stake = toRaw(amt);

const [stt, usdc] = await Promise.all([
  client.getViemClient().getBalance({ address: me }),
  client.getErc20Balance(COLLATERAL, me),
]);
console.log(`wallet ${me}\n  STT   ${Number(stt) / 1e18}\n  tUSDC ${fmtUsdc(usdc)}\n`);

const windows = await listLiveWindows(client, { asset });
const w = pickWindow(windows, asset, intervalSec, 20);
if (!w) {
  console.error(`no live ${asset} ${cadence} window with ≥20s left`);
  process.exit(1);
}
console.log(`window ${w.asset} ${fmtCadence(w.intervalSec)}  closes in ${fmtCountdown(w.expiry - Date.now() / 1000)}  marketId=${w.marketId}`);

const before = await windowPosition(client, me, w);
const q = await quoteTap(client, w, side, stake);
if (!q) {
  console.error("nothing fillable on that side (empty book)");
  process.exit(1);
}
console.log(
  `quote  ${side} ${fmtUsdc(stake)} tUSDC → ${fmtUsdc(q.quantity)} shares @ ${fmtProb(q.avgPrice)}  escrow ${fmtUsdc(q.escrow)}  win → +${fmtUsdc(q.profitIfWin)}`,
);

const t0 = Date.now();
const r = await placeTap(ex, w, q);
const after = await windowPosition(client, me, w);
console.log(
  `\nTAP ${side} sent in ${Date.now() - t0}ms\n  tx      ${r.hash}\n  link    ${txUrl(r.hash)}\n  filled  ${fmtUsdc(r.filled)} shares @ ${fmtProb(r.avgPrice)} for ${fmtUsdc(r.paid)} tUSDC` +
    `\n  position Up ${fmtUsdc(before.up)}→${fmtUsdc(after.up)}  Down ${fmtUsdc(before.down)}→${fmtUsdc(after.down)}`,
);
process.exit(0);
