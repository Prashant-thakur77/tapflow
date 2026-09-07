// The same-block mirror, end to end on Shannon:
//   1. leader (PRIVATE_KEY) places a real tap
//   2. leader broadcasts it through Router → PositionOpened
//   3. Somnia reactivity delivers the event to CopyHandler in the SAME block,
//      which mirrors it into every follower's order via MirrorVault
//   4. we read that block's logs and print the proof (both tx hashes, one block)
//
//   npx tsx scripts/mirror-demo.ts [BTC|ETH] [5m|15m|1h|4h|24h] [UP|DOWN] [stake] [--no-tap]

import "dotenv/config";
import fs from "node:fs";
import { createWalletClient, http, parseAbi, parseAbiItem, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  EXPLORER_URL,
  bindSigner,
  fmtCadence,
  fmtProb,
  fmtUsdc,
  getClient,
  getExchange,
  listLiveWindows,
  pickWindow,
  placeTap,
  quoteTap,
  somniaShannon,
  toRaw,
  txUrl,
  type Asset,
  type Side,
} from "../src/lib/ec";

const dep = JSON.parse(fs.readFileSync("contracts/deployments.json", "utf8")) as {
  router: Hex; mirrorVault: Hex; copyHandler: Hex; subscriptions: { copyHandler: string };
};
const pk = process.env.PRIVATE_KEY as Hex;
if (!pk || pk === "0x...") throw new Error("PRIVATE_KEY missing in .env");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const noTap = process.argv.includes("--no-tap");
const asset = (args[0] ?? "ETH").toUpperCase() as Asset;
const cadence = args[1] ?? "24h";
const side = (args[2] ?? "UP").toUpperCase() as Side;
const stake = toRaw(args[3] ?? "1");
const intervalSec = cadence.endsWith("h") ? parseInt(cadence) * 3600 : parseInt(cadence) * 60;

const ROUTER_ABI = parseAbi(["function broadcast(bytes32 marketId,address pool,uint8 side,uint256 qty,uint256 price,uint64 expiryNs)"]);
const MIRRORED = parseAbiItem("event Mirrored(address indexed follower,address indexed leader,bytes32 indexed marketId,uint8 side,uint256 qty,bool success)");
const FILLED = parseAbiItem("event FollowerFilled(address indexed follower,address indexed leader,bytes32 indexed marketId,uint8 side,uint256 qty,uint256 cost,uint256 spent,uint256 maxLoss)");

const leader = privateKeyToAccount(pk);
const ex = getExchange();
const client = getClient();
const pc = client.getViemClient();
bindSigner({ privateKey: pk });

console.log(`leader ${leader.address}  router ${dep.router}  copyHandler ${dep.copyHandler} (sub #${dep.subscriptions.copyHandler})`);

const windows = await listLiveWindows(client, { asset });
const w = pickWindow(windows, asset, intervalSec, 60);
if (!w) throw new Error(`no live ${asset} ${cadence} window`);
console.log(`window ${w.asset} ${fmtCadence(w.intervalSec)}  marketId ${w.marketId}  pool ${w.pool}`);

const q = await quoteTap(client, w, side, stake);
if (!q) throw new Error("book too thin to quote");
console.log(`quote  ${side} ${fmtUsdc(stake)} → ${fmtUsdc(q.quantity)} shares @ ${fmtProb(q.avgPrice)} (limit YES ${Number(q.limitYesPrice) / 1e6})`);

// 1. the leader's own tap (real order)
if (!noTap) {
  const r = await placeTap(ex, w, q);
  console.log(`\n[1] leader tap    ${txUrl(r.hash)}\n    filled ${fmtUsdc(r.filled)} @ ${fmtProb(r.avgPrice)}`);
}

// 2. broadcast through Router → PositionOpened (gas from the node's estimate)
const wallet = createWalletClient({ account: leader, chain: somniaShannon, transport: http() });
const expiryNs = BigInt(Math.min(Math.floor(Date.now() / 1000) + 120, w.expiry)) * 1_000_000_000n;
const t0 = Date.now();
const bhash = await wallet.writeContract({
  address: dep.router,
  abi: ROUTER_ABI,
  functionName: "broadcast",
  args: [w.marketId, w.pool, side === "UP" ? 0 : 1, q.quantity, q.limitYesPrice, expiryNs],
});
const rcpt = await pc.waitForTransactionReceipt({ hash: bhash });
const block = rcpt.blockNumber;
console.log(`\n[2] broadcast     ${txUrl(bhash)}\n    status ${rcpt.status}  block ${block}  (${Date.now() - t0}ms)`);

// 3. the reactive mirror: look in the SAME block (and the next, in case of queue spill)
async function scan(from: bigint, to: bigint) {
  const [m, f] = await Promise.all([
    pc.getLogs({ address: dep.copyHandler, event: MIRRORED, fromBlock: from, toBlock: to }),
    pc.getLogs({ address: dep.mirrorVault, event: FILLED, fromBlock: from, toBlock: to }),
  ]);
  return { m, f };
}
let { m, f } = await scan(block, block);
let where = "SAME block";
if (m.length === 0) {
  await new Promise((r) => setTimeout(r, 3000));
  ({ m, f } = await scan(block, block + 3n));
  where = m.length ? `block ${m[0].blockNumber} (broadcast was ${block})` : "not found in the next 3 blocks";
}
console.log(`\n[3] reactive mirror → ${where}`);
for (const l of m) {
  console.log(`    Mirrored  follower ${l.args.follower}  qty ${fmtUsdc(l.args.qty!)}  success ${l.args.success}`);
  console.log(`              reactive tx ${txUrl(l.transactionHash!)}  block ${l.blockNumber}`);
}
for (const l of f) {
  console.log(`    FollowerFilled  qty ${fmtUsdc(l.args.qty!)}  cost ${fmtUsdc(l.args.cost!)}  spent ${fmtUsdc(l.args.spent!)}/${fmtUsdc(l.args.maxLoss!)}`);
}
if (m.length && m[0].blockNumber === block) {
  console.log(`\n✅ SAME-BLOCK MIRROR PROVEN — block ${block}: ${EXPLORER_URL}/block/${block}`);
} else if (m.length) {
  console.log(`\n⚠️  mirrored, but ${m[0].blockNumber! - block} block(s) later`);
} else {
  console.log(`\n❌ no mirror log found — check the CopyHandler's STT balance and subscription`);
}
process.exit(0);
