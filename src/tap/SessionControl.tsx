import React, { useState } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { motion } from "framer-motion";
import { KeyRound, Zap, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import { SESSION_CAP_USDC, fmtCountdown, fmtUsdc } from "../lib/ec";
import { useSession } from "./useSession";

const CAPS = [10, 25, 50] as const;

function errText(e: unknown) {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  if (/user rejected|denied/i.test(m)) return "Cancelled in wallet";
  return m.split("\n")[0].slice(0, 120);
}

/** The one-tap session control: a pill when live, a button + cap modal when not. */
export const SessionControl: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { isConnected } = useAccount();
  const { active, busy, remainingMs, sessionUsdc, start, end } = useSession();
  const [open, setOpen] = useState(false);
  const [cap, setCap] = useState<number>(25);

  const onStart = async () => {
    try {
      await start(cap);
      setOpen(false);
      toast.success("One-tap on. Tap freely — no more popups.");
    } catch (e) {
      toast.error(errText(e));
    }
  };
  const onEnd = async () => {
    try {
      await end();
      toast.success("Session ended, funds swept back.");
    } catch (e) {
      toast.error(errText(e));
    }
  };

  if (active) {
    const late = remainingMs < 5 * 60 * 1000;
    return (
      <div className={`flex items-center gap-2 ${compact ? "" : "tf-card px-3 py-2"}`}>
        <span className="flex items-center gap-1.5 text-xs font-bold text-up">
          <Zap size={13} className="fill-up" /> one-tap
        </span>
        {!compact ? (
          <span className="text-[11px] text-bn-text-dim font-mono">
            {sessionUsdc !== undefined ? `${fmtUsdc(sessionUsdc)} tUSDC left` : "…"}
          </span>
        ) : null}
        <span className={`text-[11px] font-mono ${late ? "text-amber" : "text-bn-text-muted"}`}>{fmtCountdown(remainingMs / 1000)}</span>
        <button onClick={onEnd} disabled={busy !== null} className="ml-auto text-[11px] text-bn-text-muted hover:text-down disabled:opacity-50">
          {busy === "end" ? <Loader2 size={12} className="animate-spin" /> : "end"}
        </button>
      </div>
    );
  }

  if (!isConnected) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center gap-1.5 font-bold rounded-lg transition-all ${compact ? "px-2.5 py-1.5 text-[11px]" : "tf-card px-3 py-2 text-xs w-full hover:border-white/20"}`}
      >
        <KeyRound size={13} className="text-accent-soft" /> Enable one-tap
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel as={motion.div} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="tf-card w-full max-w-sm p-5 relative">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-bn-text-muted hover:text-white">
              <X size={18} />
            </button>
            <div className="label-tag inline-block mb-3">ONE-TAP MODE</div>
            <p className="text-sm text-bn-text-dim leading-relaxed">
              Fund a capped session wallet once. After that, every tap signs itself — no wallet popup. It expires in 30 minutes, and unspent
              tUSDC plus gas is swept back to you when you end it or it expires.
            </p>
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-bn-text-muted mb-2">budget cap</div>
              <div className="tf-seg w-full grid grid-cols-3">
                {CAPS.map((c) => (
                  <button key={c} data-on={cap === c} onClick={() => setCap(c)} className="w-full">
                    {c} tUSDC
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-bn-text-muted mt-2">Max {SESSION_CAP_USDC} tUSDC. Plus ~1.5 STT for gas. One signature to fund.</p>
            </div>
            <button onClick={onStart} disabled={busy !== null} className="btn-primary w-full mt-5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {busy === "start" ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              {busy === "start" ? "Funding…" : `Fund ${cap} tUSDC & go`}
            </button>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
};
