import "dotenv/config";

export const CHAIN_ID = 50312;
export const RPC_URL = process.env.RPC_URL ?? "https://dream-rpc.somnia.network";
export const WS_RPC_URL = process.env.WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws";
export const INDEXER_URL = process.env.INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql";
export const VENUE_ID = (process.env.VENUE_ID ??
  "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c") as `0x${string}`;
export const EXPLORER = "https://shannon-explorer.somnia.network";

export const PORT = Number(process.env.PORT ?? 8787);
export const POLL_MS = Number(process.env.POLL_MS ?? 15_000);
export const DB_PATH = process.env.DB_PATH ?? "tapflow.db";
export const BACKFILL = Number(process.env.BACKFILL ?? 120);
export const FEED_SECRET = process.env.FEED_SECRET ?? "";
export const AGENT_ADDRESS = (process.env.AGENT_ADDRESS ?? "").toLowerCase();
export const AGENT_LABEL = process.env.AGENT_LABEL ?? "TapBot";
export const APP_URL = process.env.APP_URL ?? "https://tapflow.vercel.app";

/** tUSDC: 6 decimals. */
export const ONE = 1_000_000;

/** MirrorVault addresses (v2, v1): their taps are followers' mirrored orders, not a tapper. */
export const VAULT_ADDRESSES = (process.env.VAULT_ADDRESSES ?? "0x535A2F473f073AB27FAd8F65ECD5Fe1203C8aE95,0x1a9c46409a34511e05E0552618b81C818D5f0C12,0x4d5F238420452D360D98AF0fA08A33048964a5A5,0xF5fc089748604722ADa350599a8afBAFb0A6aB0A").toLowerCase().split(",");
