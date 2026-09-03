import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, useWalletClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { bindSigner, getClient, isLive, somniaShannon, unbindSigner } from "../lib/ec";
import { useSessionStore } from "../tap/sessionStore";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const config = createConfig({
  chains: [somniaShannon],
  connectors: [injected()],
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
