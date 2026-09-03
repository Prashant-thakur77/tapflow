import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { somniaShannon, type Asset, type Side } from "./ec.js";

export interface FeedItem {
  at: number;
  actor: string;
  label?: string;
  asset: Asset;
  side: Side;
  stake: number;
  price: number;
  rationale: string;
  txHash: string;
}

/** Publish a rationale to the TapFlow indexer feed (best-effort). */
export async function postFeed(item: FeedItem): Promise<void> {
  try {
    const res = await fetch(`${config.tapflowApi}/api/feed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: config.feedSecret, item }),
    });
    if (!res.ok) console.warn(`feed POST ${res.status}`);
  } catch (e) {
    console.warn("feed POST failed:", (e as Error).message);
  }
}

const ROUTER_ABI = [
  {
    type: "function",
    name: "broadcast",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "pool", type: "address" },
      { name: "side", type: "uint8" },
      { name: "qty", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "expiryNs", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

/**
 * Broadcast the tap through the Router so followers mirror it in-block. No-op
 * when ROUTER_ADDRESS is unset (contracts not deployed yet).
 */
export async function broadcast(
  pk: Hex,
  args: { marketId: Hex; pool: Hex; side: Side; qty: bigint; price: bigint; expiryNs: bigint },
): Promise<Hex | null> {
  if (!config.routerAddress) return null;
  const wallet = createWalletClient({ account: privateKeyToAccount(pk), chain: somniaShannon, transport: http() });
  return wallet.writeContract({
    address: config.routerAddress,
    abi: ROUTER_ABI,
    functionName: "broadcast",
    args: [args.marketId, args.pool, args.side === "UP" ? 0 : 1, args.qty, args.price, args.expiryNs],
  });
}
