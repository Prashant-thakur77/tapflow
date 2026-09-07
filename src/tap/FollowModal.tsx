import React, { useState } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Loader2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { fmtUsdc, short, txUrl } from "../lib/ec";
import { COPY } from "../lib/copy";
import { useFollowOnchain, useMyFollow } from "./useCopy";

const DEPOSITS = [5, 10, 25] as const;

/** Follow a leader on-chain: deposit a capped budget into MirrorVault, set ratio + max-loss. */
export const FollowModal: React.FC<{ leader: { address: string; label?: string } | null; onClose: () => void; onFollowed?: () => void }> = ({
  leader,
  onClose,
  onFollowed,
}) => {
  const { follow, step } = useFollowOnchain();
  const mine = useMyFollow();
  const [deposit, setDeposit] = useState<number>(10);
  const [ratio, setRatio] = useState<number>(10_000);

  if (!leader) return null;
  const name = leader.label ?? short(leader.address);

  const go = async () => {
    try {
      const hash = await follow(leader.address as `0x${string}`, deposit, ratio, deposit);
      toast.success(
        <span>
          Following {name} on-chain.{" "}
          <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="underline">
            tx ↗
          </a>
        </span>,
        { duration: 8000 },
      );
      mine.refetch();
      onFollowed?.();
      onClose();
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? String(e);
      toast.error(/rejected|denied/i.test(m) ? "Cancelled in wallet" : m.split("\n")[0].slice(0, 120));
    }
  };

  const seg = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold ${on ? "bg-accent text-white" : "text-bn-text-dim hover:text-white bg-white/5"}`;

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="tf-card w-full max-w-sm p-5 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-bn-text-muted hover:text-white">
            <X size={18} />
          </button>
          <div className="label-tag inline-block mb-3">FOLLOW ON-CHAIN</div>
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <Users size={16} className="text-accent-soft" /> {name}
          </div>
          <p className="text-xs text-bn-text-dim leading-relaxed mt-2">
            Your budget sits in <span className="font-mono">MirrorVault</span>. Every time {name} broadcasts a tap, Somnia reactivity places your proportional
            order in the <b>same block</b>. Spend can never exceed your max-loss; withdraw the rest any time.
          </p>

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-bn-text-muted mb-1.5">budget & max-loss (tUSDC)</div>
            <div className="flex gap-1.5">
              {DEPOSITS.map((d) => (
                <button key={d} className={seg(deposit === d)} onClick={() => setDeposit(d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-bn-text-muted mb-1.5">mirror ratio</div>
            <div className="flex gap-1.5">
              {[5_000, 10_000, 20_000].map((r) => (
                <button key={r} className={seg(ratio === r)} onClick={() => setRatio(r)}>
                  {r / 10_000}×
                </button>
              ))}
            </div>
          </div>

          {mine.active ? (
            <div className="mt-3 text-[11px] text-bn-text-muted">
              Currently following {short(mine.leader!)} · budget left {fmtUsdc(mine.available)} · spent {fmtUsdc(mine.spent)}/{fmtUsdc(mine.maxLoss)}. Following {name} replaces it.
            </div>
          ) : null}

          <button onClick={go} disabled={step !== null} className="btn-primary w-full mt-5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {step ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
            {step === "approve" ? "Approving tUSDC…" : step === "deposit" ? "Depositing…" : step === "follow" ? "Setting follow…" : `Deposit ${deposit} & follow`}
          </button>
          <div className="mt-2 text-[10px] text-bn-text-muted font-mono text-center">
            vault {short(COPY.vault)} · reactivity sub #{COPY.subscription}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
