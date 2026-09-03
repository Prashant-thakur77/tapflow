import React from "react";
import { motion } from "framer-motion";

/** UP vs DOWN implied probability as one bar, Polymarket-style but louder. */
export const OddsBar: React.FC<{ up: number | null; down: number | null }> = ({ up, down }) => {
  const has = up !== null && down !== null && up + down > 0;
  const pctUp = has ? (up! / (up! + down!)) * 100 : 50;
  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] font-mono font-bold mb-1">
        <span className="text-up">UP {has ? Math.round(pctUp) : "—"}%</span>
        <span className="text-down">{has ? Math.round(100 - pctUp) : "—"}% DOWN</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
        <motion.div
          className="h-full"
          style={{ background: "linear-gradient(90deg, #2ebd85, #5fe0a8)" }}
          animate={{ width: `${pctUp}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        <div className="h-full flex-1" style={{ background: "linear-gradient(90deg, #ff6b7f, #f6465d)" }} />
      </div>
    </div>
  );
};
