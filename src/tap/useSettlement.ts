import { useEffect, useMemo } from "react";
import { getClient } from "../lib/ec";
import { useTapStore, type TapRecord } from "../store";
import { useNow } from "./hooks";

const GIVE_UP_SEC = 45 * 60;

/**
 * Watches every tap whose window has expired and, once the market resolves
 * on-chain, writes win / loss / void back into the store. Also returns the
 * newest result the user has not seen yet, for the result card.
 */
export function useSettlement() {
  const taps = useTapStore((s) => s.taps);
  const setResult = useTapStore((s) => s.setResult);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const now = Date.now() / 1000;
      const due = taps.filter((t) => !t.result && t.expiry < now && now - t.expiry < GIVE_UP_SEC);
      const byMarket = new Map<string, TapRecord[]>();
      for (const t of due) byMarket.set(t.marketId, [...(byMarket.get(t.marketId) ?? []), t]);
      for (const [marketId, group] of byMarket) {
        try {
          const oc = await getClient().getMarketOnchain(marketId as `0x${string}`);
          if (stop) return;
          if (!oc.isResolved && !oc.isVoided) continue;
          for (const t of group) {
            const won = !oc.isVoided && oc.winningOutcome === (t.side === "UP" ? 0 : 1);
            const result = oc.isVoided ? "void" : won ? "win" : "loss";
            const payout = oc.isVoided ? t.filled * 0.5 : won ? t.filled : 0;
            setResult(t.hash, { result, payout, pnl: payout - t.paid, resultAt: Date.now() });
          }
        } catch {
          // transient RPC error — next tick
        }
      }
    };
    void tick();
    const id = setInterval(tick, 6_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [taps, setResult]);

  const now = useNow(5_000);
  const unseen = useMemo(() => taps.find((t) => t.result && !t.seen) ?? null, [taps]);
  const pending = useMemo(() => taps.filter((t) => !t.result && t.expiry < now / 1000 + 1), [taps, now]);
  return { unseen, pending };
}
