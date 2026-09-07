import React from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { short, type TapWindow } from "../lib/ec";
import { useMarketPositions } from "./useLeaderboard";

/** Who is on which side of this window — the biggest stakes, from chain-indexed fills. */
export const TopPositions: React.FC<{ w: TapWindow | undefined; me?: string }> = ({ w, me }) => {
  const { data } = useMarketPositions(w?.marketId);
  if (!w) return null;
  const s = data?.summary;
  const total = (s?.upQty ?? 0) + (s?.downQty ?? 0);
  const upShare = total > 0 ? ((s?.upQty ?? 0) / total) * 100 : null;
  const rows = (data?.positions ?? []).slice(0, 6);

  return (
    <div className="tf-card px-3 py-2 overflow-hidden">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-bn-text-muted mb-1.5">
        <span className="flex items-center gap-1.5">
          <Users size={11} /> top positions on this window
        </span>
        {s ? (
          <span className="font-mono normal-case tracking-normal">
            {s.traders} traders · {s.volumeUsdc.toFixed(2)} tUSDC
          </span>
        ) : null}
      </div>
      {upShare !== null ? (
        <div className="flex items-center gap-2 text-[10px] font-mono mb-2">
          <span className="text-up font-bold w-14">UP {Math.round(upShare)}%</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-white/5">
            <div className="h-full bg-up" style={{ width: `${upShare}%` }} />
            <div className="h-full flex-1 bg-down" />
          </div>
          <span className="text-down font-bold w-14 text-right">{Math.round(100 - upShare)}% DOWN</span>
        </div>
      ) : null}
      {!rows.length ? (
        <div className="text-xs text-bn-text-dim">No positions indexed yet on this window.</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((p) => {
            const mine = !!me && p.taker.toLowerCase() === me.toLowerCase();
            return (
              <li key={`${p.taker}-${p.side}`} className="flex items-center justify-between text-[11px] font-mono">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`font-bold w-11 ${p.side === "UP" ? "text-up" : "text-down"}`}>{p.side}</span>
                  <Link to={`/leader/${p.taker}`} className={`hover:text-white truncate ${p.label ? "text-accent-soft font-bold" : ""}`}>
                    {p.label ?? short(p.taker)}
                  </Link>
                  {mine ? <span className="text-[9px] text-bn-text-muted">(you)</span> : null}
                </span>
                <span className="text-bn-text-dim shrink-0">
                  {p.qty.toFixed(2)} sh @ {Math.round(p.avgPrice * 100)}¢ · <span className="text-white">{p.cost.toFixed(2)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
