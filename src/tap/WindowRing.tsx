import React from "react";
import { fmtCountdown } from "../lib/ec";

const R = 62;
const C = 2 * Math.PI * R;

/** Seconds-left ring. Fills as the window ages; goes amber in the last 20s. */
export const WindowRing: React.FC<{
  left: number;
  pct: number;
  label: string;
  sub?: React.ReactNode;
  tone?: "up" | "down" | "flat";
}> = ({ left, pct, label, sub, tone = "flat" }) => {
  const late = left <= 20;
  const color = late ? "#f5a524" : tone === "up" ? "#2ebd85" : tone === "down" ? "#f6465d" : "#0847F7";
  return (
    <div className="relative w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={R} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <circle
          cx="80"
          cy="80"
          r={R}
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={C}
          strokeDashoffset={C * pct}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 300ms", filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[11px] uppercase tracking-widest text-bn-text-muted">{label}</div>
        <div className={`font-mono font-black text-3xl sm:text-4xl leading-none mt-1 ${late ? "text-[#f5a524] animate-pulse" : "text-white"}`}>
          {fmtCountdown(left)}
        </div>
        {sub ? <div className="mt-1.5 text-[11px] text-bn-text-dim">{sub}</div> : null}
      </div>
    </div>
  );
};
