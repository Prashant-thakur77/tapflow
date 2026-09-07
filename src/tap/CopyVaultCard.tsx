import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useWriteContract, usePublicClient } from "wagmi";
import toast from "react-hot-toast";
import { Copy, ExternalLink } from "lucide-react";
import { EXPLORER_URL, fmtUsdc, short } from "../lib/ec";
import { COPY, COPY_DEPLOYED, MIRROR_VAULT_ABI } from "../lib/copy";
import { useMyFollow } from "./useCopy";

/** The follower's side of copy trading: what's in the vault, who it mirrors, and the way out. */
export const CopyVaultCard: React.FC = () => {
  const f = useMyFollow();
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<"withdraw" | "unfollow" | null>(null);
  if (!COPY_DEPLOYED) return null;
  const hasVault = f.available > 0n || f.active;
  if (!hasVault) return null;

  const run = async (kind: "withdraw" | "unfollow") => {
    setBusy(kind);
    const id = toast.loading(kind === "withdraw" ? `Withdrawing ${fmtUsdc(f.available)} tUSDC…` : "Stopping the mirror…");
    try {
      const hash =
        kind === "withdraw"
          ? await writeContractAsync({ address: COPY.vault, abi: MIRROR_VAULT_ABI, functionName: "withdraw", args: [f.available] })
          : await writeContractAsync({ address: COPY.vault, abi: MIRROR_VAULT_ABI, functionName: "clearFollow" });
      await pc?.waitForTransactionReceipt({ hash });
      toast.success(
        <a href={`${EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer" className="underline">
          {kind === "withdraw" ? "Withdrawn to your wallet ↗" : "Mirror stopped ↗"}
        </a>,
        { id, duration: 8000 },
      );
      f.refetch();
    } catch (e) {
      toast.error(((e as { shortMessage?: string }).shortMessage ?? (e as Error).message).split("\n")[0].slice(0, 120), { id });
    } finally {
      setBusy(null);
    }
  };

  const pct = f.maxLoss > 0n ? Number((f.spent * 100n) / f.maxLoss) : 0;
  return (
    <section className="tf-card p-4" style={{ borderColor: "rgba(138,166,249,0.35)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm flex items-center gap-2">
          <Copy size={15} className="text-accent-soft" /> Copy vault
        </h2>
        <a href={`${EXPLORER_URL}/address/${COPY.vault}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-bn-text-muted hover:text-white flex items-center gap-1">
          MirrorVault {short(COPY.vault)} <ExternalLink size={10} />
        </a>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">available</div>
          <div className="font-mono font-extrabold text-lg">{fmtUsdc(f.available)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">mirroring</div>
          <div className="font-mono font-bold text-lg truncate">
            {f.leader ? (
              <Link to={`/leader/${f.leader}`} className="text-accent-soft hover:underline">
                {short(f.leader)}
              </Link>
            ) : (
              <span className="text-bn-text-muted">nobody</span>
            )}
          </div>
          {f.active ? <div className="text-[10px] text-bn-text-muted">{f.ratioBps / 100}% of each tap</div> : null}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">loss cap used</div>
          <div className="font-mono font-bold text-lg">
            {fmtUsdc(f.spent)} <span className="text-bn-text-muted text-xs">/ {fmtUsdc(f.maxLoss)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-1">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-bn-text-muted mt-3 leading-relaxed">
        Every mirror is an IOC order placed by <code>MirrorVault</code> from this deposit in the leader's block. RiskGuard pauses the mirror at the loss cap. You can leave any time.
      </p>
      <div className="flex gap-2 mt-3">
        <button onClick={() => run("withdraw")} disabled={busy !== null || f.available === 0n} className="btn-outline px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40">
          {busy === "withdraw" ? "withdrawing…" : `Withdraw ${fmtUsdc(f.available)} tUSDC`}
        </button>
        {f.active ? (
          <button onClick={() => run("unfollow")} disabled={busy !== null} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-down hover:text-white disabled:opacity-40">
            {busy === "unfollow" ? "stopping…" : "Stop following"}
          </button>
        ) : null}
      </div>
    </section>
  );
};
