import React from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { fmtMultiple, fmtProb, fmtUsdc, type Side, type TapQuote } from "../lib/ec";

export const TapButton: React.FC<{
  side: Side;
  quote: TapQuote | null;
  disabled?: boolean;
  busy?: boolean;
  onTap: (side: Side) => void;
}> = ({ side, quote, disabled, busy, onTap }) => {
  const up = side === "UP";
  const color = up ? "#2ebd85" : "#f6465d";
  const Icon = up ? TrendingUp : TrendingDown;
  const off = disabled || busy || !quote;
  return (
    <motion.button
      whileTap={off ? undefined : { scale: 0.96 }}
      disabled={off}
      onClick={() => onTap(side)}
      className="relative flex-1 min-h-[132px] sm:min-h-[150px] rounded-xl flex flex-col items-center justify-center gap-1 select-none disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      style={{
        background: `linear-gradient(180deg, ${color}26 0%, ${color}10 100%)`,
        border: `1px solid ${color}55`,
        boxShadow: off ? "none" : `0 0 24px ${color}22, inset 0 0 30px ${color}0d`,
      }}
    >
      <div className="flex items-center gap-2 font-black text-2xl sm:text-3xl tracking-tight" style={{ color }}>
        {busy ? <Loader2 className="animate-spin" size={26} /> : <Icon size={26} strokeWidth={2.5} />}
        {side}
      </div>
      <div className="font-mono text-lg sm:text-xl font-bold text-white">
        {fmtProb(quote?.impliedProb ?? null)}
        <span className="text-bn-text-muted text-xs font-medium ml-1.5">· {quote ? fmtMultiple(quote.avgPrice) : "—"}</span>
      </div>
      <div className="text-[11px] sm:text-xs text-bn-text-dim">
        {quote ? (
          <>
            win <span className="font-semibold" style={{ color }}>+{fmtUsdc(quote.profitIfWin)}</span> tUSDC
          </>
        ) : (
          "no liquidity"
        )}
      </div>
    </motion.button>
  );
};
