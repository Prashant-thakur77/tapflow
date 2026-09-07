import React from "react";
import { fmtCadence, type Asset } from "../lib/ec";
import { useSettled } from "./useLeaderboard";

const fmtPx = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The last windows of this series and how they closed — the pattern hunters' strip. */
export const SettledStrip: React.FC<{ asset: Asset; intervalSec: number }> = ({ asset, intervalSec }) => {
  const { data } = useSettled(asset, intervalSec, 10);
  if (!data?.length) return null;
  return (
    <div className="tf-card px-3 py-2 overflow-hidden">
      <div className="text-[10px] uppercase tracking-widest text-bn-text-muted mb-1.5">
        recently settled · {asset} {fmtCadence(intervalSec)}
      </div>
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {data.map((s) => {
          const up = s.result === "UP";
          const voided = s.result === "VOID";
          const color = voided ? "#f5a524" : up ? "#2ebd85" : "#f6465d";
          return (
            <div key={s.marketId} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-mono" style={{ background: `${color}14`, border: `1px solid ${color}44` }}>
              <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color }}>
                  {voided ? "VOID" : s.result}
                </span>
                <span className="text-bn-text-muted">{new Date(s.expiryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="text-bn-text-dim mt-0.5">{s.closePx ? fmtPx(s.closePx) : s.openPx ? `open ${fmtPx(s.openPx)}` : "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
