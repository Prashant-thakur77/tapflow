import React from "react";
import { useLiveFills } from "@somnia-chain/markets-sdk/react";
import { ONE, short, type TapWindow } from "../lib/ec";

function ago(tsSec: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - tsSec));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

/** Every fill on this window's pool as it lands — proof the market is alive. */
export const LiveTape: React.FC<{ w: TapWindow | undefined; me?: string }> = ({ w, me }) => {
  // Pools are recycled across windows: keep only this market's fills.
  const fills = useLiveFills(w?.pool, 40).filter((f) => w && f.market_id.toLowerCase() === w.marketId.toLowerCase()).slice(0, 14);
  const rows = fills.map((f) => {
    const side = f.takerSide ?? f.makerSide;
    const up = side === "BUY_YES" || side === "SELL_NO";
    const yesPx = Number(f.fillPrice) / Number(ONE);
    const px = up ? yesPx : 1 - yesPx;
    const who = f.taker ?? f.maker ?? "";
    const mine = !!me && who.toLowerCase() === me.toLowerCase();
    return { id: f.id, up, px, qty: Number(f.quantity) / Number(ONE), who, mine, ts: Number(f.timestamp) };
  });

  return (
    <div className="tf-card px-3 py-2 overflow-hidden min-w-0 w-full max-w-full">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-bn-text-muted mb-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${rows.length ? "bg-up animate-pulse" : "bg-white/20"}`} />
        live taps on this window
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-bn-text-dim">No fills yet this window. Be the first.</div>
      ) : (
        <div className="flex gap-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none" }}>
          {rows.map((r) => (
            <div
              key={r.id}
              className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono rounded-lg px-2 py-1"
              style={{
                background: r.mine ? "rgba(8,71,247,0.18)" : "rgba(255,255,255,0.035)",
                border: `1px solid ${r.mine ? "rgba(138,166,249,0.5)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <span className="text-bn-text-muted">{r.mine ? "you" : short(r.who, 3)}</span>
              <span className={`font-bold ${r.up ? "text-up" : "text-down"}`}>{r.up ? "UP" : "DOWN"}</span>
              <span className="text-white">{r.qty.toFixed(1)}</span>
              <span className="text-bn-text-dim">@{Math.round(r.px * 100)}%</span>
              <span className="text-bn-text-muted">{ago(r.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
