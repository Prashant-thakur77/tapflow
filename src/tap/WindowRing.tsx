import React from "react";
import { fmtCountdown } from "../lib/ec";

const R = 62;
const C = 2 * Math.PI * R;

/** Seconds-left ring. Fills as the window ages; goes amber and pulses in the last 20s. */
export const WindowRing: React.FC<{
  left: number;
  pct: number;
  label: string;
  sub?: React.ReactNode;
  tone?: "up" | "down" | "flat";
  size?: number;
}> = ({ left, pct, label, sub, tone = "flat", size = 176 }) => {
  const late = left <= 20 && left > 0;
  const color = late ? "#f5a524" : tone === "up" ? "#2ebd85" : tone === "down" ? "#f6465d" : "#8aa6f9";
  return (
    <div className={`relative mx-auto ${late ? "tf-pulse" : ""}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={R} stroke="rgba(255,255,255,0.06)" strokeWidth="7" fill="none" />
        <circle
          cx="80"
          cy="80"
          r={R}
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={C}
          strokeDashoffset={C * pct}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 300ms", filter: `drop-shadow(0 0 8px ${color}77)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        <div className="text-[9px] uppercase tracking-[0.25em] text-bn-text-muted leading-tight">{label}</div>
        <div className={`font-mono font-extrabold tabular leading-none mt-1 ${late ? "text-amber" : "text-white"}`} style={{ fontSize: size * 0.2 }}>
          {left > 0 ? fmtCountdown(left) : <span className="text-white/30">··</span>}
        </div>
        {sub ? <div className="mt-1 text-[10px] text-bn-text-dim">{sub}</div> : null}
      </div>
    </div>
  );
};
