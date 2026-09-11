import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, useWalletClient } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { bindSigner, getClient, isLive, somniaShannon, unbindSigner } from "../lib/ec";
import { useSessionStore } from "../tap/sessionStore";
import { WC_PROJECT_ID } from "../lib/wallet";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Injected first (MetaMask on desktop, a wallet's own in-app browser), plus
// WalletConnect when a project id is configured — that is the only way to sign
// from inside a Telegram mini-app, whose webview injects no provider.
const config = createConfig({
  chains: [somniaShannon],
  connectors: [
    injected(),
    ...(WC_PROJECT_ID
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: "TapFlow",
              description: "One-tap UP/DOWN on live DreamDEX Event Contracts, with same-block copy trading on Somnia.",
              url: typeof window !== "undefined" ? window.location.origin : "https://tapflow-phi.vercel.app",
              icons: ["https://tapflow-phi.vercel.app/icon-192.png"],
            },
          }),
        ]
      : []),
  ],
  transports: { [somniaShannon.id]: http() },
});

/**
 * Chooses the signer for every write: the session wallet when one is live (taps
 * need no popup), otherwise the connected wallet, otherwise read-only.
 */
function SignerBridge() {
  const { data: walletClient } = useWalletClient();
  const session = useSessionStore((s) => s.session);
  useEffect(() => {
    if (isLive(session)) bindSigner({ privateKey: session!.privateKey });
    else if (walletClient) bindSigner({ walletClient });
    else unbindSigner();
  }, [walletClient, session]);
  return null;
}

export function Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SomniaMarketsProvider client={getClient()}>
          <SignerBridge />
          {children}
        </SomniaMarketsProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
