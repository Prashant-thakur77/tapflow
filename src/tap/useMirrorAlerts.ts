import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { apiBase, apiReady, EXPLORER_URL } from "../lib/api";

interface MirrorRow {
  block: number;
  reactiveTx: string;
  follower: string;
  leader: string;
  side: "UP" | "DOWN";
  qty: number;
  success: boolean;
  sameBlock: boolean;
}

/**
 * When a mirror lands for the connected wallet, say so — the follower sees
 * their copy fire in the leader's block without watching the explorer.
 */
export function useMirrorAlerts() {
  const { address } = useAccount();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!address) return;
    let stop = false;
    const me = address.toLowerCase();
    const poll = async () => {
      try {
        await apiReady;
        const rows = (await (await fetch(`${apiBase()}/api/mirrors?limit=50`)).json()) as MirrorRow[];
        if (stop) return;
        const mine = rows.filter((r) => r.follower.toLowerCase() === me);
        if (seen.current === null) {
          seen.current = new Set(mine.map((r) => r.reactiveTx));
          return;
        }
        for (const r of mine) {
          if (seen.current.has(r.reactiveTx)) continue;
          seen.current.add(r.reactiveTx);
          toast(
            `⚡ ${r.side} mirrored for you in block ${r.block}${r.sameBlock ? " — same block as the leader" : ""}${r.success ? "" : " (order didn't fill)"}`,
            { duration: 9000, icon: r.success ? "🪞" : "↩" },
          );
          if ("vibrate" in navigator) navigator.vibrate?.(40);
          console.info(`[tapflow] mirror ${EXPLORER_URL}/tx/${r.reactiveTx}`);
        }
      } catch {
        /* indexer offline */
      }
    };
    void poll();
    const t = setInterval(poll, 10_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [address]);
}
