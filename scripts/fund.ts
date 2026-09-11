// Send a wallet enough to try TapFlow: STT for gas and tUSDC to trade with.
//
//   npx tsx scripts/fund.ts 0xYourAddress [stt] [tusdc]
//
// Pays from PRIVATE_KEY in .env. tUSDC is transferred from that wallet's own
// balance; if it is short, it mints more through the token's public faucet.
import "dotenv/config";
import { createWalletClient, http, parseEther, parseUnits, encodeFunctionData, isAddress, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getClient, COLLATERAL, fmtUsdc, somniaShannon } from "../src/lib/ec";

const to = (process.argv[2] ?? "") as `0x${string}`;
const stt = process.argv[3] ?? "2";
const usdc = process.argv[4] ?? "500";
if (!isAddress(to)) {
  console.error("usage: npx tsx scripts/fund.ts 0xYourAddress [stt] [tusdc]");
  process.exit(1);
}

const c = getClient();
const pc = c.getViemClient();
const from = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const w = createWalletClient({ account: from, chain: somniaShannon, transport: http() });
const ERC20 = [
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "faucet", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
] as const;

console.log(`from ${from.address} → ${to}`);
const want = parseUnits(usdc, 6);
if ((await c.getErc20Balance(COLLATERAL, from.address)) < want) {
  const h = await w.sendTransaction({ to: COLLATERAL, data: encodeFunctionData({ abi: ERC20, functionName: "faucet", args: [want] }) });
  await pc.waitForTransactionReceipt({ hash: h });
  console.log(`minted ${usdc} tUSDC   ${h}`);
}
const h1 = await w.sendTransaction({ to, value: parseEther(stt) });
await pc.waitForTransactionReceipt({ hash: h1 });
console.log(`sent ${stt} STT        ${h1}`);
const h2 = await w.sendTransaction({ to: COLLATERAL, data: encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [to, want] }) });
await pc.waitForTransactionReceipt({ hash: h2 });
console.log(`sent ${usdc} tUSDC     ${h2}`);

const [gas, bal] = await Promise.all([pc.getBalance({ address: to }), c.getErc20Balance(COLLATERAL, to)]);
console.log(`\n${to} now holds ${Number(formatEther(gas)).toFixed(3)} STT and ${fmtUsdc(bal)} tUSDC`);
process.exit(0);
