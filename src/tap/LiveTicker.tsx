import React from "react";
import { fmtCadence, short, txUrl } from "../lib/ec";
import { useRecentFills } from "./useLeaderboard";

const ago = (ms: number) => {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
};

/** Venue-wide tape of the latest taps, scrolling across the top of the app. */
export const LiveTicker: React.FC = () => {
  const { data } = useRecentFills(24);
  if (!data?.length) return null;
  const items = data.map((f, i) => (
    <a key={`${f.txHash}-${i}`} href={txUrl(f.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 whitespace-nowrap hover:text-white">
      <span className="text-white/35">●</span>
      <span className="text-bn-text-muted">{short(f.taker, 3)}</span>
      <span className={`font-bold ${f.side === "UP" ? "text-up" : "text-down"}`}>{f.side}</span>
      <span className="text-white">{f.cost.toFixed(2)}</span>
      <span className="text-bn-text-dim">
        on {f.asset} {fmtCadence(f.intervalSec)} @{Math.round(f.price * 100)}%
      </span>
      <span className="text-bn-text-muted">{ago(f.at)}</span>
    </a>
  ));
  return (
    <div className="overflow-hidden border-b border-white/5 bg-white/[0.02] text-[11px] font-mono py-1 select-none" aria-label="live taps across the venue">
      <div className="tf-marquee">
        <span>{items}</span>
        <span aria-hidden>{items}</span>
      </div>
    </div>
  );
};
