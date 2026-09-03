// TapFlow — one SomniaMarkets exchange for the whole app.
//
// Constructed once for public reads; the signer is bound later (a wagmi
// WalletClient in the browser, a private key in scripts/agents) and can be
// swapped or cleared without touching live watches.
//
// `assertTxOk` is adapted from dreamdex-bot-kit/packages/ec-core/src/exchange.ts
// (MIT, Copyright DreamDEX S.A.).

import { SomniaMarkets, type SomniaMarketsClient } from "@somnia-chain/markets-sdk";
import type { Hex, WalletClient } from "viem";
import { ADDRESSES, INDEXER_URL, PRICE_FEED, WS_RPC_URL, somniaShannon } from "./config";

let exchange: SomniaMarkets | undefined;

export function getExchange(): SomniaMarkets {
  exchange ??= new SomniaMarkets({
    chain: somniaShannon,
    addresses: ADDRESSES,
    wsRpcUrl: WS_RPC_URL,
    indexerUrl: INDEXER_URL,
    priceFeed: PRICE_FEED,
  });
  return exchange;
}

export function getClient(): SomniaMarketsClient {
  return getExchange().client;
}

export type Signer = { walletClient?: WalletClient; privateKey?: Hex };

/** Bind (or replace) the signer used for every write. */
export function bindSigner(signer: Signer): void {
  getExchange().setSigner(signer);
}

/** Back to unauthenticated reads (wallet disconnected). */
export function unbindSigner(): void {
  getExchange().setSigner({});
}

export function signerAddress(): `0x${string}` | undefined {
  return getExchange().walletAddress;
}

/**
 * Throw if a trader write's receipt says the transaction REVERTED. The SDK
 * resolves `{ hash, receipt }` without checking `receipt.status`, so a mint on
 * a locked market or an underfunded order "succeeds" silently unless you look.
 */
export function assertTxOk(
  res: { hash?: string; receipt?: { status?: string } },
  label = "transaction",
): void {
  if (res?.receipt?.status === "reverted") {
    throw new Error(`${label} reverted on-chain (tx ${res.hash ?? "?"})`);
  }
}
