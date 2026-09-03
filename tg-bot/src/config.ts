// TapFlow Telegram bot — configuration from process.env only (no Vite here).
import "dotenv/config";
import type { Hex } from "viem";

const env = (k: string, d?: string) => {
  const v = process.env[k]?.trim();
  return v ? v : d;
};

export const config = {
  /** Telegram bot token from @BotFather. */
  botToken: env("BOT_TOKEN") ?? "",
  /** Optional funded Shannon key the bot taps with. Unset = read-only bot. */
  botPrivateKey: (env("BOT_PRIVATE_KEY") && env("BOT_PRIVATE_KEY") !== "0x..." ? env("BOT_PRIVATE_KEY") : undefined) as Hex | undefined,
  /** The TapFlow web app / mini-app URL. Telegram web_app buttons need https. */
  webappUrl: env("WEBAPP_URL", "http://localhost:5174")!,
  /** The TapFlow indexer (F4). */
  tapflowApi: env("TAPFLOW_API", "http://localhost:8787")!.replace(/\/$/, ""),

  // Somnia Shannon / DreamDEX (docs/CONTRACTS.md)
  chainId: 50312,
  rpcUrl: env("RPC_URL", "https://dream-rpc.somnia.network")!,
  wsRpcUrl: env("WS_RPC_URL", "wss://api.infra.testnet.somnia.network/ws")!,
  indexerUrl: env("INDEXER_URL", "https://dev.smk.somnia.host/v1/graphql")!,
  venueId: env("VENUE_ID", "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c") as Hex,
  explorerUrl: "https://shannon-explorer.somnia.network",

  /** Max stake the bot will place per /up or /down, in tUSDC. */
  maxStake: Number(env("MAX_STAKE", "25")),
};

export function assertBotToken(): void {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN is not set. Create a bot with @BotFather and put the token in tg-bot/.env");
  }
}
