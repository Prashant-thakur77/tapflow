import "dotenv/config";
import type { Hex } from "viem";

export const env = (k: string, d = "") => process.env[k] ?? d;

export const config = {
  chainId: 50312,
  rpcUrl: env("RPC_URL", "https://dream-rpc.somnia.network"),
  wsRpcUrl: env("WS_RPC_URL", "wss://api.infra.testnet.somnia.network/ws"),
  indexerUrl: env("INDEXER_URL", "https://dev.smk.somnia.host/v1/graphql"),
  explorerUrl: env("EXPLORER_URL", "https://shannon-explorer.somnia.network"),
  venueId: env("VENUE_ID", "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c") as Hex,

  // TapBot's own funded key. Read-only signal checks work without it.
  botPrivateKey: (process.env.AGENT_PRIVATE_KEY || undefined) as Hex | undefined,
  label: env("AGENT_LABEL", "TapBot"),

  // Where to publish the rationale feed (the F4 indexer).
  tapflowApi: env("TAPFLOW_API", "http://localhost:8787"),
  feedSecret: env("FEED_SECRET", ""),

  // Optional: broadcast through the Router so followers mirror in-block.
  routerAddress: (process.env.ROUTER_ADDRESS || undefined) as Hex | undefined,

  // Strategy knobs.
  /** "auto" = whichever asset has a live window and the best edge this tick. */
  asset: (env("AGENT_ASSET", "auto").toUpperCase() as "BTC" | "ETH" | "AUTO"),
  /** "auto" = shortest live cadence for the asset; else seconds. */
  cadence: env("AGENT_CADENCE_SEC", "auto"),
  cadenceSec: Number(env("AGENT_CADENCE_SEC", "300")) || 0,
  stakeUsdc: Number(env("AGENT_STAKE_USDC", "2")),
  intervalMs: Number(env("AGENT_INTERVAL_MS", "20000")),
  momentumBps: Number(env("AGENT_MOMENTUM_BPS", "5")), // min move to act, in bps
  minLeftSec: Number(env("AGENT_MIN_LEFT_SEC", "40")),
  dryRun: env("AGENT_DRY_RUN", "false") === "true",
  autoClaim: env("AUTO_CLAIM", "true") !== "false",
  holdHeartbeatMs: Number(env("AGENT_HOLD_HEARTBEAT_MS", String(10 * 60_000))),
};
