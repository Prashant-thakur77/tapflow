// Is there an injected wallet in this browser at all? We only ship the injected
// connector (WalletConnect needs a project id we do not have), so a judge on a
// phone or a fresh browser must be told what to do instead of pressing a dead
// button. Everything except signing works read-only without a wallet.

export const hasInjectedWallet = (): boolean =>
  typeof window !== "undefined" && typeof (window as { ethereum?: unknown }).ethereum !== "undefined";

export const WALLET_HELP =
  "No wallet in this browser. Install MetaMask (metamask.io), or open this page inside a wallet's browser. Everything except signing works without one.";
