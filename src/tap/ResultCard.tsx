import React, { useEffect } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Link } from "react-router-dom";
import { ExternalLink, Share2 } from "lucide-react";
import { fmtCadence, txUrl } from "../lib/ec";
import { statsOf, useTapStore, type TapRecord } from "../store";

/** The settlement moment: one card, one number, one share button. */
export const ResultCard: React.FC<{ tap: TapRecord | null }> = ({ tap }) => {
  const markSeen = useTapStore((s) => s.markSeen);
  const taps = useTapStore((s) => s.taps);
  const { streak } = statsOf(taps);

  useEffect(() => {
    if (tap?.result === "win") {
      confetti({ particleCount: 160, spread: 90, startVelocity: 45, origin: { y: 0.6 }, colors: ["#2ebd85", "#ffffff", "#0847F7", "#f5a524"] });
      if ("vibrate" in navigator) navigator.vibrate?.([30, 40, 30]);
    }
  }, [tap?.hash, tap?.result]);

  if (!tap) return null;
  const won = tap.result === "win";
  const voided = tap.result === "void";
  const color = won ? "#2ebd85" : voided ? "#f5a524" : "#f6465d";
  const pnl = tap.pnl ?? 0;
  const line = `${won ? "🟢" : voided ? "🟡" : "🔴"} ${tap.side} ${won ? "✓" : voided ? "void" : "✗"} ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} tUSDC on ${tap.asset} ${fmtCadence(tap.intervalSec)}${streak > 1 ? ` · ${streak}-streak` : ""}`;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(`${line}\n\nTapFlow — one-tap Event Contracts on @Somnia_Network × DreamDEX\n${window.location.origin}`)}`;

  return (
    <Dialog open onClose={() => markSeen(tap.hash)} className="relative z-50">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="w-full max-w-sm">
        <DialogPanel className="tf-card w-full p-6 text-center overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(80% 60% at 50% 0%, ${color}33, transparent 70%)` }} />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-bn-text-muted">
              {tap.asset} {fmtCadence(tap.intervalSec)} · settled
            </div>
            <div className="font-display font-bold text-5xl mt-3 tracking-tight" style={{ color }}>
              {tap.side} {won ? "✓" : voided ? "~" : "✗"}
            </div>
            <div className="font-mono font-extrabold text-4xl mt-2 tabular" style={{ color }}>
              {pnl >= 0 ? "+" : ""}
              {pnl.toFixed(2)} <span className="text-base text-white/60">tUSDC</span>
            </div>
            <div className="text-xs text-bn-text-dim mt-2">
              {tap.filled.toFixed(2)} shares @ {Math.round(tap.avgPrice * 100)}% · paid {tap.paid.toFixed(2)}
              {streak > 1 ? <span className="ml-2 text-amber font-bold">🔥 {streak}-streak</span> : null}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a href={shareUrl} target="_blank" rel="noreferrer" className="btn-outline py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                <Share2 size={15} /> Share
              </a>
              {won || voided ? (
                <Link to="/portfolio" onClick={() => markSeen(tap.hash)} className="btn-primary py-2.5 rounded-lg font-bold text-sm flex items-center justify-center">
                  Claim +{(tap.payout ?? 0).toFixed(2)}
                </Link>
              ) : (
                <button onClick={() => markSeen(tap.hash)} className="btn-primary py-2.5 rounded-lg font-bold text-sm">
                  Tap again
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-bn-text-muted">
              <a href={txUrl(tap.hash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white">
                your tap <ExternalLink size={11} />
              </a>
              <button onClick={() => markSeen(tap.hash)} className="hover:text-white">
                dismiss
              </button>
            </div>
          </div>
        </DialogPanel>
        </motion.div>
      </div>
    </Dialog>
  );
};
