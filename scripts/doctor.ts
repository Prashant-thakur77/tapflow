// TapFlow preflight — everything the demo depends on, in one read-only screen.
// Sends no transactions.
//
//   npx tsx scripts/doctor.ts
//
// The shape follows dreamdex-bot-kit/scripts/ec-doctor.ts (MIT, Copyright DreamDEX S.A.).

import "dotenv/config";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { createPublicClient, formatEther, formatUnits, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { COLLATERAL, EXPLORER_URL, getClient, listLiveWindows, quoteFromBook, readGrid, secondsLeft, somniaShannon, toRaw } from "../src/lib/ec";
import deployments from "../contracts/deployments.json";

const pc = createPublicClient({ chain: somniaShannon, transport: http() });
const client = getClient();
const ok = (b: boolean) => (b ? "✓" : "✗");
const pad = (s: string, n: number) => s.padEnd(n);
const ERC20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const VAULT = parseAbi(["function available(address) view returns (uint256)", "function followerCount(address) view returns (uint256)", "function follows(address) view returns (address leader, uint32 ratioBps, uint256 maxLoss, uint256 deposited, uint256 spent, bool active)"]);
const HANDLER = parseAbi(["function subscriptionId() view returns (uint256)"]);
const api = process.env.TAPFLOW_API ?? "http://localhost:8787";
const published = (() => {
  try {
    return JSON.parse(require("node:fs").readFileSync("api-url.json", "utf8")).api as string;
  } catch {
    return "";
  }
})();

async function wallet(label: string, pk?: string) {
  if (!pk) return console.log(`${pad(label, 10)} (not set)`);
  const a = privateKeyToAccount(pk as `0x${string}`).address;
  const [stt, usdc] = await Promise.all([pc.getBalance({ address: a }), pc.readContract({ address: COLLATERAL, abi: ERC20, functionName: "balanceOf", args: [a] })]);
  console.log(`${pad(label, 10)} ${a}  ${Number(formatEther(stt)).toFixed(3)} STT  ${formatUnits(usdc, 6)} tUSDC ${ok(stt > 500_000_000_000_000_000n)} gas ${ok(usdc >= 5_000_000n)} stake`);
  return a;
}

console.log("── TapFlow doctor ──────────────────────────────────────────────");
console.log(`chain ${somniaShannon.id} · block ${await pc.getBlockNumber()} · ${new Date().toISOString()}`);
console.log("\n── wallets");
const leader = await wallet("leader", process.env.PRIVATE_KEY);
const follower = await wallet("follower", process.env.FAUCET_HELPER_KEY);

console.log("\n── copy contracts");
const d = deployments as { router: `0x${string}`; mirrorVault: `0x${string}`; copyHandler: `0x${string}`; riskGuard: `0x${string}`; subscriptions: { copyHandler: string; riskGuard: string } };
const handlerStt = await pc.getBalance({ address: d.copyHandler });
const sub = await pc.readContract({ address: d.copyHandler, abi: HANDLER, functionName: "subscriptionId" }).catch(() => 0n);
console.log(`CopyHandler ${d.copyHandler}  sub #${sub} ${ok(sub > 0n)}  gas tank ${Number(formatEther(handlerStt)).toFixed(2)} STT ${ok(handlerStt > 1_000_000_000_000_000_000n)}`);
const guardSub = await pc.readContract({ address: d.riskGuard, abi: HANDLER, functionName: "subscriptionId" }).catch(() => 0n);
console.log(`RiskGuard   ${d.riskGuard}  sub #${guardSub} ${guardSub > 0n ? "✓" : "– (needs 32 STT)"}`);
if (leader) {
  const n = await pc.readContract({ address: d.mirrorVault, abi: VAULT, functionName: "followerCount", args: [leader] }).catch(() => 0n);
  console.log(`MirrorVault ${d.mirrorVault}  followers of leader: ${n}`);
}
if (follower) {
  const bal = await pc.readContract({ address: d.mirrorVault, abi: VAULT, functionName: "available", args: [follower] }).catch(() => 0n);
  const f = await pc.readContract({ address: d.mirrorVault, abi: VAULT, functionName: "follows", args: [follower] }).catch(() => null);
  console.log(`follower vault available ${formatUnits(bal, 6)} tUSDC ${ok(bal >= 1_000_000n)} · follows ${f ? `${f[0].slice(0, 10)}… ratio ${f[1] / 100}% spent ${formatUnits(f[4], 6)}/${formatUnits(f[2], 6)} active=${f[5]}` : "?"}`);
}

console.log("\n── live windows");
const windows = await listLiveWindows(client).catch((e) => {
  console.log(`upstream indexer ✗ ${(e as Error).message.slice(0, 80)} — retry in a few seconds`);
  return [];
});
if (!windows.length) console.log("none ✗");
for (const w of windows) {
  const [book, grid] = await Promise.all([client.getBinaryOrderBook(w.pool, { depth: 5 }), readGrid(client, w.pool).catch(() => null)]);
  const up = quoteFromBook(book, "UP", toRaw(5), grid ? { grid } : undefined);
  const dn = quoteFromBook(book, "DOWN", toRaw(5), grid ? { grid } : undefined);
  const px = (q: ReturnType<typeof quoteFromBook>) => (q ? `${Math.round(q.impliedProb * 100)}¢` : "—");
  const left = secondsLeft(w);
  console.log(`${pad(`${w.asset} ${w.intervalSec >= 3600 ? w.intervalSec / 3600 + "h" : w.intervalSec / 60 + "m"}`, 8)} closes in ${pad(`${Math.floor(left / 60)}m${Math.floor(left % 60)}s`, 9)} UP ${pad(px(up), 4)} DOWN ${pad(px(dn), 4)} grid ${grid ? `${grid.tick}/${grid.lot}` : "?"}  pool ${w.pool.slice(0, 10)}…  ${ok(!!(up || dn))}`);
}

console.log("\n── indexer");
try {
  const h = (await (await fetch(`${api}/api/health`)).json()) as { lastBlock?: number; markets?: number; fills?: number };
  const proof = (await (await fetch(`${api}/api/proof`)).json()) as { mirrors: number; sameBlock: number; broadcasts: number };
  console.log(`${api}  ✓  cursor ${h.lastBlock ?? "?"} · mirrors ${proof.mirrors} (${proof.sameBlock} same block) · broadcasts ${proof.broadcasts}`);
} catch (e) {
  console.log(`${api}  ✗ ${(e as Error).message}`);
}
if (published) {
  try {
    const r = await fetch(`${published}/api/health`, { signal: AbortSignal.timeout(10_000) });
    console.log(`${published} (api-url.json)  ${ok(r.ok)} ${r.status}`);
  } catch {
    console.log(`${published} (api-url.json)  ✗ unreachable — restart scripts/tunnel.sh`);
  }
}
try {
  const r = await fetch("https://tapflow-phi.vercel.app/", { method: "HEAD" });
  console.log(`https://tapflow-phi.vercel.app  ${ok(r.ok)} ${r.status}`);
} catch {
  console.log("https://tapflow-phi.vercel.app  ✗");
}
console.log(`\nexplorer ${EXPLORER_URL}`);
process.exit(0);
