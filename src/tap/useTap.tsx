import { useState } from "react";
import { useAccount, useChainId, useConnect, useSwitchChain } from "wagmi";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { CHAIN_ID, fmtCadence, fmtProb, fmtUsdc, getExchange, placeTap, txUrl, type Side, type TapQuote, type TapResult, type TapWindow } from "../lib/ec";
import { useTapStore } from "../store";
import { useRefreshAfterTx } from "./hooks";

export function errText(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  if (/user rejected|denied/i.test(m)) return "Rejected in wallet";
  return m.split("\n")[0].slice(0, 140);
}

/**
 * The one tap action, shared by the tap screen and the markets grid: connect
 * if needed, switch chain if needed, place the IOC, toast, confetti, record.
 * Resolves with the fill (or null when nothing was sent).
 */
export function useTap() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const pushTap = useTapStore((s) => s.pushTap);
  const refreshAll = useRefreshAfterTx();
  const [busy, setBusy] = useState<{ marketId: string; side: Side } | null>(null);

  const tap = async (w: TapWindow, side: Side, stake: number, q: TapQuote | null): Promise<TapResult | null> => {
    if (!isConnected || !address) {
      connect({ connector: connectors[0] });
      return null;
    }
    if (chainId !== CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: CHAIN_ID });
      } catch (e) {
        toast.error(errText(e));
      }
      return null;
    }
    if (!q) return null;
    setBusy({ marketId: w.marketId, side });
    const id = toast.loading(`${side} · ${stake} tUSDC on ${w.asset} ${fmtCadence(w.intervalSec)}…`);
    try {
      const r = await placeTap(getExchange(), w, q);
      if (r.filled > 0n) {
        toast.success(
          <span>
            {side} filled: {fmtUsdc(r.filled)} shares @ {fmtProb(r.avgPrice)}{" "}
            <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline text-accent-soft">
              tx ↗
            </a>
          </span>,
          { id, duration: 8000 },
        );
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.75 }, colors: [side === "UP" ? "#2ebd85" : "#f6465d", "#ffffff", "#0847F7"] });
        pushTap({
          at: Date.now(),
          asset: w.asset,
          intervalSec: w.intervalSec,
          marketId: w.marketId,
          expiry: w.expiry,
          side,
          stake,
          filled: Number(r.filled) / 1e6,
          paid: Number(r.paid) / 1e6,
          avgPrice: r.avgPrice,
          hash: r.hash,
        });
      } else {
        toast(
          <span>
            Book moved, nothing filled.{" "}
            <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline">
              tx ↗
            </a>
          </span>,
          { id, icon: "↩" },
        );
      }
      refreshAll();
      return r;
    } catch (e) {
      toast.error(errText(e), { id });
      return null;
    } finally {
      setBusy(null);
    }
  };

  return { tap, busy, isConnected, address, wrongChain: isConnected && chainId !== CHAIN_ID };
}
