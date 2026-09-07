import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClient, ONE, type TapWindow } from "../lib/ec";
import { useNow } from "./hooks";

type Pt = { t: number; p: number; n: number };

/** 1-minute candles of the YES price over this window = the crowd's UP odds over time. */
function useCrowdOdds(w: TapWindow | undefined) {
  return useQuery({
    queryKey: ["tf-odds", w?.marketId],
    enabled: !!w,
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: 1,
    queryFn: async (): Promise<Pt[]> => {
      // Pools are recycled across windows: bound the candles to this window's trading span.
      const rows = await getClient().getCandles(w!.pool, 60, { from: w!.tradingStart, to: w!.expiry, limit: 500 });
      return rows
        .map((c) => ({ t: Number(c.bucketStart), p: Number(c.closePrice) / Number(ONE), n: c.tradeCount }))
        .filter((r) => r.t >= w!.tradingStart && r.t <= w!.expiry && r.p > 0 && r.p <= 1)
        .sort((a, b) => a.t - b.t);
    },
  });
}

const W = 600;
const H = 96;
const PAD = 6;

/** Limitless-style odds line: where the crowd priced UP through the window, plus the live quote. */
export const OddsChart: React.FC<{ w: TapWindow | undefined; liveUp: number | null }> = ({ w, liveUp }) => {
  const { data, isLoading } = useCrowdOdds(w);
  const nowSec = Math.floor(useNow(5_000) / 1000);
  const pts = useMemo(() => {
    const base = data ?? [];
    return liveUp !== null && liveUp > 0 && liveUp < 1 ? [...base, { t: nowSec, p: liveUp, n: 0 }] : base;
  }, [data, liveUp, nowSec]);

  if (!w) return null;
  const trades = (data ?? []).reduce((s, r) => s + r.n, 0);
  const t0 = w.tradingStart;
  const t1 = w.expiry;
  const x = (t: number) => PAD + ((Math.min(Math.max(t, t0), t1) - t0) / Math.max(1, t1 - t0)) * (W - PAD * 2);
  const y = (p: number) => PAD + (1 - p) * (H - PAD * 2);
  const path = pts.length ? pts.map((r, i) => `${i === 0 ? "M" : "L"}${x(r.t).toFixed(1)},${y(r.p).toFixed(1)}`).join(" ") : "";
  const last = pts.at(-1);
  const first = pts[0];
  const delta = last && first ? (last.p - first.p) * 100 : 0;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-bn-text-muted mb-1">
        <span>crowd odds · UP over this window</span>
        <span className="font-mono normal-case tracking-normal">
          {last ? (
            <>
              <span className="text-up font-bold">{Math.round(last.p * 100)}%</span>
              {pts.length > 1 ? <span className={delta >= 0 ? "text-up" : "text-down"}> {delta >= 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(0)}pt</span> : null}
              <span className="text-bn-text-muted"> · {trades} fills</span>
            </>
          ) : isLoading ? (
            "loading…"
          ) : (
            "no fills yet"
          )}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: 72 }} aria-label="crowd odds over time">
        <defs>
          <linearGradient id="tf-odds-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2ebd85" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2ebd85" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 50% line — the coin flip */}
        <line x1={PAD} x2={W - PAD} y1={y(0.5)} y2={y(0.5)} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
        <text x={W - PAD} y={y(0.5) - 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="monospace">
          50%
        </text>
        {path ? (
          <>
            <path d={`${path} L${x(last!.t).toFixed(1)},${H - PAD} L${x(first!.t).toFixed(1)},${H - PAD} Z`} fill="url(#tf-odds-fill)" />
            <path d={path} fill="none" stroke="#2ebd85" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={x(last!.t)} cy={y(last!.p)} r="3.5" fill="#2ebd85" />
          </>
        ) : null}
        {/* now marker */}
        <line x1={x(nowSec)} x2={x(nowSec)} y1={PAD} y2={H - PAD} stroke="rgba(138,166,249,0.35)" />
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-bn-text-muted -mt-0.5">
        <span>open {new Date(t0 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>settles {new Date(t1 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
};
