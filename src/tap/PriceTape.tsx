import React, { useMemo } from "react";
import { useLivePriceTicks } from "@somnia-chain/markets-sdk/react";
import type { Asset } from "../lib/ec";

const W = 600;
const H = 88;
const PAD = 6;

/**
 * The last ~2 minutes of oracle ticks against the window's opening price.
 * Green where the line is above the open, red below — the whole game in one glance.
 */
export const PriceTape: React.FC<{ asset: Asset; open: number | null; className?: string }> = ({ asset, open, className }) => {
  const ticks = useLivePriceTicks(asset, 120);

  const model = useMemo(() => {
    const pts = ticks
      .slice()
      .reverse()
      .map((t) => t.price)
      .filter((p) => Number.isFinite(p) && p > 0);
    if (pts.length < 2) return null;
    const all = open ? [...pts, open] : pts;
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    const span = Math.max(hi - lo, (hi || 1) * 0.0004);
    lo = (lo + hi) / 2 - span / 2;
    hi = lo + span;
    const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
    const y = (p: number) => PAD + (1 - (p - lo) / (hi - lo)) * (H - PAD * 2);
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
    const area = `${d} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
    const openY = open ? y(open) : null;
    const last = pts[pts.length - 1];
    return { d, area, openY, lastX: x(pts.length - 1), lastY: y(last), last, above: open ? last >= open : null };
  }, [ticks, open]);

  if (!model) {
    return (
      <div className={`tf-skeleton h-[72px] w-full ${className ?? ""}`} aria-label="waiting for price ticks">
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-bn-text-muted">price feed hydrating</div>
      </div>
    );
  }

  const up = "#2ebd85";
  const down = "#f6465d";
  const lineColor = model.above === null ? "#8aa6f9" : model.above ? up : down;

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[72px] sm:h-[88px] block">
        <defs>
          <linearGradient id="tfUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={up} stopOpacity="0.35" />
            <stop offset="1" stopColor={up} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tfDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={down} stopOpacity="0" />
            <stop offset="1" stopColor={down} stopOpacity="0.35" />
          </linearGradient>
          {model.openY !== null ? (
            <>
              <clipPath id="tfAbove">
                <rect x="0" y="0" width={W} height={model.openY} />
              </clipPath>
              <clipPath id="tfBelow">
                <rect x="0" y={model.openY} width={W} height={H - model.openY} />
              </clipPath>
            </>
          ) : null}
        </defs>
        {model.openY !== null ? (
          <>
            {/* area above the open line, tinted green; below, red (mirrored gradient) */}
            <path d={model.area} fill="url(#tfUp)" clipPath="url(#tfAbove)" />
            <path d={`${model.d} L${model.lastX},0 L${PAD},0 Z`} fill="url(#tfDown)" clipPath="url(#tfBelow)" />
            <line x1="0" x2={W} y1={model.openY} y2={model.openY} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" strokeWidth="1" />
          </>
        ) : null}
        <path d={model.d} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={model.lastX} cy={model.lastY} r="3.5" fill={lineColor} />
        <circle cx={model.lastX} cy={model.lastY} r="9" fill={lineColor} opacity="0.25">
          <animate attributeName="r" values="4;12;4" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </svg>
      {model.openY !== null ? (
        <span
          className="absolute right-1 text-[9px] uppercase tracking-widest text-white/50 font-mono"
          style={{ top: `calc(${(model.openY / H) * 100}% - 12px)` }}
        >
          open
        </span>
      ) : null}
    </div>
  );
};
