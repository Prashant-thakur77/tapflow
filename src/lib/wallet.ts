// Which wallet can this browser actually reach?
//
// Two cases matter. On a desktop with MetaMask, or inside a wallet's own
// in-app browser, there is an injected EIP-1193 provider and we use it. Inside
// a Telegram mini-app there is none — Telegram's webview injects nothing — so
// we fall back to WalletConnect, which deep-links into MetaMask (or any other
// WalletConnect wallet) on the same phone. WalletConnect only exists when a
// project id is configured; without one the app still reads the chain fine and
// only signing is unavailable.

import type { Connector } from "wagmi";

export const WC_PROJECT_ID: string = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim();

export const hasInjectedWallet = (): boolean =>
  typeof window !== "undefined" && typeof (window as { ethereum?: unknown }).ethereum !== "undefined";

export const hasWalletConnect = (): boolean => WC_PROJECT_ID.length > 0;

/** Is there any way to sign here? */
export const canConnectWallet = (): boolean => hasInjectedWallet() || hasWalletConnect();

/**
 * The connector to use for a Connect press: the injected wallet when the
 * browser has one, otherwise WalletConnect. Returns null when neither exists,
 * and the caller shows WALLET_HELP instead of a dead button.
 */
export function pickConnector(connectors: readonly Connector[]): Connector | null {
  if (hasInjectedWallet()) {
    const injected = connectors.find((c) => c.type === "injected" || c.id === "injected");
    if (injected) return injected;
  }
  const wc = connectors.find((c) => c.type === "walletConnect" || c.id === "walletConnect");
  if (wc) return wc;
  return connectors[0] ?? null;
}

export const WALLET_HELP = hasWalletConnect()
  ? "No wallet in this browser. Press CONNECT again and scan the WalletConnect code with MetaMask, or open this page in MetaMask's own browser. Everything except signing works without one."
  : "No wallet in this browser. Install MetaMask (metamask.io), or open this page inside a wallet's browser. Everything except signing works without one.";
