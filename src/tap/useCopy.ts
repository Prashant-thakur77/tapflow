import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { Hex } from "viem";
import { COLLATERAL, toRaw, type Side, type TapWindow } from "../lib/ec";
import { COPY, COPY_DEPLOYED, ERC20_ALLOWANCE_ABI, MIRROR_VAULT_ABI, ROUTER_ABI } from "../lib/copy";

/** On-chain follower count for a leader, from MirrorVault. */
export function useFollowerCount(leader?: string) {
  return useReadContract({
    address: COPY.vault,
    abi: MIRROR_VAULT_ABI,
    functionName: "followerCount",
    args: leader ? [leader as `0x${string}`] : undefined,
    query: { enabled: COPY_DEPLOYED && !!leader, refetchInterval: 15_000 },
  });
}

/** The connected wallet's follow config + budget in the vault. */
export function useMyFollow() {
  const { address } = useAccount();
  const follow = useReadContract({
    address: COPY.vault,
    abi: MIRROR_VAULT_ABI,
    functionName: "follows",
    args: address ? [address] : undefined,
    query: { enabled: COPY_DEPLOYED && !!address, refetchInterval: 10_000 },
  });
  const available = useReadContract({
    address: COPY.vault,
    abi: MIRROR_VAULT_ABI,
    functionName: "available",
    args: address ? [address] : undefined,
    query: { enabled: COPY_DEPLOYED && !!address, refetchInterval: 10_000 },
  });
  const f = follow.data;
  return {
    leader: f && f[5] ? (f[0] as string) : null,
    ratioBps: f ? Number(f[1]) : 0,
    maxLoss: f ? f[2] : 0n,
    spent: f ? f[4] : 0n,
    active: !!f?.[5],
    available: available.data ?? 0n,
    refetch: () => void Promise.all([follow.refetch(), available.refetch()]),
  };
}

/**
 * Follow a leader on-chain: approve tUSDC → deposit into MirrorVault →
 * setFollow. Three transactions, gas sized by the node (Somnia prices fresh
 * storage far above Ethereum, so never hand-pick a limit).
 */
export function useFollowOnchain() {
  const { address } = useAccount();
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<"approve" | "deposit" | "follow" | null>(null);

  const follow = async (leader: `0x${string}`, depositUsdc: number, ratioBps = 10_000, maxLossUsdc = depositUsdc) => {
    if (!address || !pc) throw new Error("connect a wallet");
    if (!COPY_DEPLOYED) throw new Error("copy contracts not deployed");
    const amount = toRaw(depositUsdc);
    const wait = (hash: Hex) => pc.waitForTransactionReceipt({ hash });
    try {
      const allowance = await pc.readContract({ address: COLLATERAL, abi: ERC20_ALLOWANCE_ABI, functionName: "allowance", args: [address, COPY.vault] });
      if (allowance < amount) {
        setStep("approve");
        const h = await writeContractAsync({ address: COLLATERAL, abi: ERC20_ALLOWANCE_ABI, functionName: "approve", args: [COPY.vault, amount] });
        await wait(h);
      }
      if (amount > 0n) {
        setStep("deposit");
        const h = await writeContractAsync({ address: COPY.vault, abi: MIRROR_VAULT_ABI, functionName: "deposit", args: [amount] });
        await wait(h);
      }
      setStep("follow");
      const h = await writeContractAsync({
        address: COPY.vault,
        abi: MIRROR_VAULT_ABI,
        functionName: "setFollow",
        args: [leader, ratioBps, toRaw(maxLossUsdc)],
      });
      const r = await wait(h);
      return r.transactionHash;
    } finally {
      setStep(null);
    }
  };

  const unfollow = async () => {
    const h = await writeContractAsync({ address: COPY.vault, abi: MIRROR_VAULT_ABI, functionName: "clearFollow" });
    if (pc) await pc.waitForTransactionReceipt({ hash: h });
    return h;
  };

  return { follow, unfollow, step };
}

/** Broadcast a filled tap through the Router so followers mirror it in-block. */
export function useBroadcast() {
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState(false);

  const broadcast = async (w: TapWindow, side: Side, qty: bigint, limitYesPrice: bigint) => {
    if (!COPY_DEPLOYED) throw new Error("copy contracts not deployed");
    setPending(true);
    try {
      const expiryNs = BigInt(Math.min(Math.floor(Date.now() / 1000) + 120, w.expiry)) * 1_000_000_000n;
      const h = await writeContractAsync({
        address: COPY.router,
        abi: ROUTER_ABI,
        functionName: "broadcast",
        args: [w.marketId, w.pool, side === "UP" ? 0 : 1, qty, limitYesPrice, expiryNs],
      });
      const r = pc ? await pc.waitForTransactionReceipt({ hash: h }) : null;
      return { hash: h, block: r?.blockNumber ?? null };
    } finally {
      setPending(false);
    }
  };
  return { broadcast, pending };
}
