import React from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { fmtMultiple, fmtUsdc, type Side, type TapQuote } from "../lib/ec";

/**
 * The only two controls that matter. Full-height, thumb-sized, and the odds
 * are the headline — the number you are betting against.
 */
export const TapButton: React.FC<{
  side: Side;
  quote: TapQuote | null;
  stake: number;
  disabled?: boolean;
  busy?: boolean;
  onTap: (side: Side) => void;
}> = ({ side, quote, stake, disabled, busy, onTap }) => {
  const up = side === "UP";
  const color = up ? "#2ebd85" : "#f6465d";
  const Icon = up ? TrendingUp : TrendingDown;
  const off = disabled || busy || !quote;
  const pct = quote ? Math.round(quote.impliedProb * 100) : null;
  const pays = quote ? Number(quote.payoutIfWin) / 1e6 : null;
  // The book could not absorb the whole stake at the protective limit.
  const thin = quote ? Number(quote.expectedCost) / 1e6 < stake * 0.85 : false;

  return (
    <motion.button
      whileTap={off ? undefined : { scale: 0.965 }}
      whileHover={off ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={off}
      onPointerDown={() => {
        if (!off && "vibrate" in navigator) navigator.vibrate?.(12);
      }}
      onClick={() => onTap(side)}
      aria-label={`${side}: ${pct ?? "—"}% implied, pays ${pays?.toFixed(2) ?? "—"} tUSDC on ${stake}`}
      className="relative flex-1 min-h-[140px] sm:min-h-[168px] rounded-2xl flex flex-col items-center justify-center gap-0.5 select-none disabled:opacity-35 disabled:cursor-not-allowed transition-opacity overflow-hidden"
      style={{
        background: `radial-gradient(120% 90% at 50% 110%, ${color}33 0%, ${color}12 45%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid ${color}66`,
        boxShadow: off ? "none" : `0 0 0 1px ${color}22, 0 18px 40px -18px ${color}aa, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <div className="flex items-center gap-2 font-display font-bold text-xl sm:text-2xl tracking-tight" style={{ color }}>
        {busy ? <Loader2 className="animate-spin" size={22} /> : <Icon size={22} strokeWidth={2.75} />}
        {side}
      </div>
      <div className="font-mono font-extrabold text-4xl sm:text-5xl text-white tabular leading-none mt-1">
        {pct !== null ? (
          <>
            {pct}
            <span className="text-xl sm:text-2xl text-white/60">%</span>
          </>
        ) : (
          <span className="text-white/30">—</span>
        )}
      </div>
      <div className="text-[11px] sm:text-xs text-bn-text-dim mt-1.5 font-mono">
        {quote ? (
          <>
            {stake} → <span className="font-bold text-white">{pays!.toFixed(2)}</span> <span className="text-white/50">({fmtMultiple(quote.avgPrice)})</span>
          </>
        ) : (
          "no liquidity"
        )}
      </div>
      {quote ? (
        <div className="text-[10px] font-semibold mt-0.5" style={{ color }}>
          +{fmtUsdc(quote.profitIfWin)} if right
        </div>
      ) : null}
      {thin ? (
        <div className="text-[9px] font-bold uppercase tracking-widest mt-1 text-amber">thin book · {(Number(quote!.expectedCost) / 1e6).toFixed(2)} fillable</div>
      ) : null}
    </motion.button>
  );
};
