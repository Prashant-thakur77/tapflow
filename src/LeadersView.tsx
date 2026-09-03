import React from "react";
import { Users } from "lucide-react";

/** Placeholder until the fills indexer (F4) ships the leaderboard. */
export const LeadersView: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-6">
    <div className="sci-card p-6 max-w-md text-center">
      <Users className="mx-auto mb-3 text-[#8aa6f9]" size={28} />
      <h2 className="font-bold text-base mb-1">Leaderboard</h2>
      <p className="text-xs text-bn-text-dim leading-relaxed">
        Wins, streaks, PnL and followers per tapper, built from on-chain fills. Following a leader mirrors their taps in the same block via Somnia
        reactivity. Landing with the indexer and copy contracts.
      </p>
    </div>
  </div>
);
