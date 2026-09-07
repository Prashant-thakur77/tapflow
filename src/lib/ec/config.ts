// TapFlow — Somnia Shannon / DreamDEX Event Contracts configuration.
//
// One place for chain, endpoints, venue and the book grid. Works in the browser
// (Vite `import.meta.env.VITE_*`) and under Node/tsx (`process.env.*`) so the
// same lib drives the web app, the CLI scripts and the agent.

import { defineChain } from "viem";
import {
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";

function env(name: string): string | undefined {
  const vite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const fromVite = vite?.[`VITE_${name}`];
  if (fromVite) return fromVite;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

export const CHAIN_ID = 50312;
export const RPC_URL = env("RPC_URL") ?? "https://dream-rpc.somnia.network";
export const WS_RPC_URL = env("WS_RPC_URL") ?? "wss://api.infra.testnet.somnia.network/ws";
export const INDEXER_URL = env("INDEXER_URL") ?? "https://dev.smk.somnia.host/v1/graphql";
export const EXPLORER_URL = "https://shannon-explorer.somnia.network";
export const DREAMDEX_REST_URL = "https://stg.api.dreamdex.io/v0";

/** DreamDEX venue on Shannon. Moves occasionally — override with VENUE_ID. */
export const VENUE_ID = (env("VENUE_ID") ??
  "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c") as `0x${string}`;

/** tUSDC collateral: 6 decimals. One whole contract = 1e6 raw units. */
export const DECIMALS = 6;
export const ONE = 10n ** BigInt(DECIMALS);
/**
 * Book grid fallback. The live venue reports tick = lot = minQuantity = 1000
 * (0.001 share) as of Sep 2026 — the bot kit's July note of "no lot constraint"
 * is stale. `readGrid()` in tap.ts reads the real values per pool; these are
 * only the defaults before that read lands.
 */
export const TICK = 1_000n; // 0.001 probability
export const LOT = 1_000n; // 0.001 share
export const MIN_QTY = 1_000n;

export const ADDRESSES = SOMNIA_TESTNET_ADDRESSES;
/** TestUSDC (6 dp, public `faucet(uint256)`). */
export const COLLATERAL: `0x${string}` =
  SOMNIA_TESTNET_ADDRESSES.testUsdc ?? "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E";
export const PRICE_FEED = SOMNIA_TESTNET_PRICE_FEED;

export const somniaShannon = defineChain({
  id: CHAIN_ID,
  name: "Somnia Shannon",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL], webSocket: [WS_RPC_URL] } },
  blockExplorers: { default: { name: "Shannon Explorer", url: EXPLORER_URL } },
  testnet: true,
});
