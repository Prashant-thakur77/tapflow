import React from "react";
import { useParams } from "react-router-dom";
import { Zap } from "lucide-react";
import { pickWindow, type Asset } from "./lib/ec";
import { WindowCard } from "./MarketsView";
import { useLiveWindows } from "./tap/hooks";

/** Parse "5m" | "15m" | "1h" | "4h" | "24h" into seconds. */
function parseCadence(s: string | undefined): number {
  const m = /^(\d+)(m|h)$/.exec(s ?? "");
  if (!m) return 300;
  return Number(m[1]) * (m[2] === "h" ? 3600 : 60);
}

/**
 * /embed/:asset/:cadence — one live window as a self-contained card, for any
 * Somnia dapp to drop into an iframe. Same real orders, same session key.
 */
export const EmbedView: React.FC = () => {
  const params = useParams();
  const asset = (params.asset ?? "BTC").toUpperCase() as Asset;
  const cadence = parseCadence(params.cadence);
  const { data: windows = [], isLoading } = useLiveWindows();
  const w = pickWindow(windows, asset, cadence, 5) ?? windows.filter((x) => x.asset === asset).sort((a, b) => a.expiry - b.expiry)[0];

  return (
    <div className="min-h-screen p-3 text-white" style={{ background: "#07090f", fontFamily: "'Manrope', sans-serif" }}>
      <div className="max-w-sm mx-auto flex flex-col gap-2">
        {w ? <WindowCard w={w} stake={5} /> : <div className="tf-card p-4 text-xs text-bn-text-dim">{isLoading ? "Loading live windows…" : `No live ${asset} window right now.`}</div>}
        <a href="https://tapflow-phi.vercel.app/tap" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 text-[10px] font-mono text-bn-text-muted hover:text-white">
          <Zap size={10} /> powered by TapFlow · real orders on DreamDEX Event Contracts
        </a>
      </div>
    </div>
  );
};
