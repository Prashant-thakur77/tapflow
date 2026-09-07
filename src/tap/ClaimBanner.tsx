import React, { useState } from "react";
import toast from "react-hot-toast";
import { Coins } from "lucide-react";
import { claimAll, fmtUsdc, getExchange, txUrl } from "../lib/ec";
import { useClaimable, useRefreshAfterTx } from "./hooks";
import { useSession } from "./useSession";

/** Winnings waiting on settled windows, one tap to sweep them all (no popup with a session key). */
export const ClaimBanner: React.FC = () => {
  const { data: claimable = [], refetch } = useClaimable();
  const { active: oneTap } = useSession();
  const refreshAll = useRefreshAfterTx();
  const [busy, setBusy] = useState(false);
  const winners = claimable.filter((c) => c.estPayout > 0n);
  if (!winners.length) return null;
  const total = winners.reduce((s, c) => s + c.estPayout, 0n);

  const onClaim = async () => {
    setBusy(true);
    const id = toast.loading(`Claiming ${fmtUsdc(total)} tUSDC from ${winners.length} window${winners.length > 1 ? "s" : ""}…`);
    try {
      const r = await claimAll(getExchange(), winners);
      toast.success(
        <span>
          Claimed +{fmtUsdc(total)} tUSDC{" "}
          {r.hash ? (
            <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline text-accent-soft">
              tx ↗
            </a>
          ) : null}
        </span>,
        { id, duration: 8000 },
      );
      refreshAll();
      void refetch();
    } catch (e) {
      toast.error(((e as { shortMessage?: string }).shortMessage ?? (e as Error).message).split("\n")[0].slice(0, 120), { id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tf-card px-3 py-2.5 flex items-center justify-between gap-3" style={{ borderColor: "rgba(245,165,36,0.45)", background: "rgba(245,165,36,0.06)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <Coins size={15} className="text-amber shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-bold">
            <span className="text-amber">+{fmtUsdc(total)} tUSDC</span> waiting
          </div>
          <div className="text-[10px] text-bn-text-muted truncate">
            {winners.length} settled window{winners.length > 1 ? "s" : ""} · {oneTap ? "one tap, no popup" : "one signature"}
          </div>
        </div>
      </div>
      <button onClick={onClaim} disabled={busy} className="shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs text-black disabled:opacity-50" style={{ background: "#f5a524" }}>
        {busy ? "claiming…" : "Claim all"}
      </button>
    </div>
  );
};
