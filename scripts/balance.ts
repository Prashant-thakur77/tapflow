// Print STT + tUSDC balances for the wallets in .env. Read-only.
//   npx tsx scripts/balance.ts
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { getClient, COLLATERAL, fmtUsdc } from "../src/lib/ec";

const c = getClient();
const pc = c.getViemClient();
const wallets: [string, string | undefined][] = [
  ["MAIN  ", process.env.PRIVATE_KEY],
  ["HELPER", process.env.FAUCET_HELPER_KEY],
];
for (const [label, k] of wallets) {
  if (!k || k === "0x...") continue;
  const a = privateKeyToAccount(k as `0x${string}`).address;
  const [stt, usdc] = await Promise.all([pc.getBalance({ address: a }), c.getErc20Balance(COLLATERAL, a)]);
  console.log(`${label} ${a}  STT=${(Number(stt) / 1e18).toFixed(3)}  tUSDC=${fmtUsdc(usdc)}`);
}
process.exit(0);
