import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, useWalletClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { bindSigner, getClient, somniaShannon, unbindSigner } from "../lib/ec";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const config = createConfig({
  chains: [somniaShannon],
  connectors: [injected()],
  transports: { [somniaShannon.id]: http() },
});

/** Hands the connected wallet to the DreamDEX exchange as its signer. */
function SignerBridge() {
  const { data: walletClient } = useWalletClient();
  useEffect(() => {
    if (walletClient) bindSigner({ walletClient });
    else unbindSigner();
  }, [walletClient]);
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
