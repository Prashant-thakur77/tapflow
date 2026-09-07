import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Code2, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { ASSETS, cadences, fmtCadence, fmtCountdown, fmtProb, fmtUsdc, type Asset, type Side, type TapWindow } from "./lib/ec";
import { STAKE_PRESETS, useTapStore } from "./store";
import { useCountdown, useLiveWindows, useOpeningPrice, useSpot, useTapQuotes } from "./tap/hooks";
import { useTap } from "./tap/useTap";

const fmtPx = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One live window as a card: question, countdown, odds, volume, quick taps. */
export const WindowCard: React.FC<{ w: TapWindow; stake: number }> = ({ w, stake }) => {
  const { left, pct } = useCountdown(w);
  const spot = useSpot(w.asset);
  const { data: opening } = useOpeningPrice(w);
  const q = useTapQuotes(w, stake);
  const { tap, busy } = useTap();
  const setAsset = useTapStore((s) => s.setAsset);
  const setIntervalSec = useTapStore((s) => s.setIntervalSec);

  const spotPx = spot?.price ?? null;
  const openPx = (() => {
    if (!opening || opening <= 0) return null;
    if (!spotPx) return opening / 100;
    const scales = [1e2, 1e6, 1e8, 1e18, 1];
    return opening / scales.reduce((best, s) => (Math.abs(opening / s - spotPx) < Math.abs(opening / best - spotPx) ? s : best), 1e2);
  })();
  const up = q.up?.impliedProb ?? null;
  const down = q.down?.impliedProb ?? null;
  const pctUp = up !== null && down !== null && up + down > 0 ? (up / (up + down)) * 100 : null;
  const closes = new Date(w.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const late = left < 20;
  const tone = openPx && spotPx ? (spotPx >= openPx ? "#2ebd85" : "#f6465d") : "#8aa6f9";
  const isBusy = (s: Side) => busy?.marketId === w.marketId && busy.side === s;

  return (
    <div className="tf-card p-3 sm:p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black" style={{ background: w.asset === "BTC" ? "rgba(247,147,26,0.18)" : "rgba(98,126,234,0.2)", color: w.asset === "BTC" ? "#f7931a" : "#8aa6f9" }}>
              {w.asset === "BTC" ? "₿" : "Ξ"}
            </span>
            <span className="font-display font-bold">
              {w.asset} · {fmtCadence(w.intervalSec)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-up font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" /> LIVE
            </span>
          </div>
          <div className="text-[11px] text-bn-text-dim mt-1 truncate">
            {openPx ? (
              <>
                Will {w.asset} settle <span className="text-white">above {fmtPx(openPx)}</span> at {closes}?
              </>
            ) : (
              <>Above the opening price at {closes}?</>
            )}
          </div>
        </div>
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 40 40" className="w-12 h-12 -rotate-90">
            <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" fill="none" />
            <circle cx="20" cy="20" r="16" stroke={late ? "#f5a524" : tone} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 16} strokeDashoffset={2 * Math.PI * 16 * pct} style={{ transition: "stroke-dashoffset 120ms linear" }} />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold tabular ${late ? "text-amber" : "text-white"}`}>{fmtCountdown(left)}</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] font-mono font-bold mb-1">
          <span className="text-up">UP {pctUp !== null ? Math.round(pctUp) : "—"}%</span>
          <span className="text-down">{pctUp !== null ? Math.round(100 - pctUp) : "—"}% DOWN</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden flex bg-white/5">
          <div className="h-full bg-up" style={{ width: `${pctUp ?? 50}%`, transition: "width 400ms" }} />
          <div className="h-full flex-1 bg-down" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["UP", "DOWN"] as Side[]).map((s) => {
          const qq = s === "UP" ? q.up : q.down;
          const color = s === "UP" ? "#2ebd85" : "#f6465d";
          const off = !qq || late || busy !== null;
          return (
            <button
              key={s}
              disabled={off}
              onClick={() => void tap(w, s, stake, qq)}
              className="rounded-xl py-2.5 flex flex-col items-center disabled:opacity-40 transition-transform active:scale-[0.97]"
              style={{ background: `${color}1a`, border: `1px solid ${color}55` }}
            >
              <span className="font-display font-bold" style={{ color }}>
                {isBusy(s) ? "…" : s}
              </span>
              <span className="font-mono text-[11px] text-white">
                {qq ? `${stake} → ${(Number(qq.payoutIfWin) / 1e6).toFixed(2)}` : "no liquidity"}
              </span>
              {qq ? <span className="font-mono text-[10px]" style={{ color }}>+{fmtUsdc(qq.profitIfWin)} · {fmtProb(qq.impliedProb)}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-bn-text-muted font-mono">
        <span>
          {w.volumeUsdc >= 1 ? `${Math.round(w.volumeUsdc).toLocaleString()} tUSDC vol` : "fresh window"} · {w.trades} fills
        </span>
        <span className="flex items-center gap-3">
          <button
            onClick={() => {
              const cad = w.intervalSec >= 3600 ? `${w.intervalSec / 3600}h` : `${w.intervalSec / 60}m`;
              const snippet = `<iframe src="${window.location.origin}/embed/${w.asset}/${cad}" width="380" height="330" style="border:0;border-radius:16px" loading="lazy"></iframe>`;
              void navigator.clipboard?.writeText(snippet).then(() => toast.success("Embed snippet copied — paste it into any site"));
            }}
            className="flex items-center gap-1 hover:text-white"
            title="copy an iframe snippet for this window"
          >
            <Code2 size={11} /> embed
          </button>
          <Link to="/tap" onClick={() => { setAsset(w.asset); setIntervalSec(w.intervalSec); }} className="flex items-center gap-1 text-accent-soft hover:text-white">
            <Zap size={11} /> focus
          </Link>
        </span>
      </div>
    </div>
  );
};

/** Every live window on the venue, Polymarket-style, with cadence + asset filters and quick taps. */
export const MarketsView: React.FC = () => {
  const { data: windows = [], isLoading } = useLiveWindows();
  const stake = useTapStore((s) => s.stake);
  const setStake = useTapStore((s) => s.setStake);
  const [asset, setAsset] = useState<Asset | "ALL">("ALL");
  const [cad, setCad] = useState<number | 0>(0);

  const allCads = useMemo(() => [...new Set(windows.map((w) => w.intervalSec))].sort((a, b) => a - b), [windows]);
  const counts = useMemo(() => Object.fromEntries(allCads.map((c) => [c, windows.filter((w) => w.intervalSec === c && (asset === "ALL" || w.asset === asset)).length])), [allCads, windows, asset]);
  const shown = windows.filter((w) => (asset === "ALL" || w.asset === asset) && (cad === 0 || w.intervalSec === cad)).sort((a, b) => a.expiry - b.expiry);

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight">Markets</h1>
            <p className="text-xs text-bn-text-dim mt-1">Every live Event Contract window on DreamDEX. Tap straight from a card.</p>
          </div>
          <div className="tf-seg">
            {STAKE_PRESETS.map((n) => (
              <button key={n} data-on={stake === n} onClick={() => setStake(n)}>
                {n} <span className="opacity-60">tUSDC</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="tf-seg">
            <button data-on={asset === "ALL"} onClick={() => setAsset("ALL")}>All</button>
            {ASSETS.map((a) => (
              <button key={a} data-on={asset === a} onClick={() => setAsset(a)}>
                {a}
              </button>
            ))}
          </div>
          <div className="tf-seg">
            <button data-on={cad === 0} onClick={() => setCad(0)}>
              all <span className="opacity-60">{shown.length && cad === 0 ? windows.filter((w) => asset === "ALL" || w.asset === asset).length : windows.filter((w) => asset === "ALL" || w.asset === asset).length}</span>
            </button>
            {allCads.map((c) => (
              <button key={c} data-on={cad === c} onClick={() => setCad(c)}>
                {fmtCadence(c)} <span className="opacity-60">{counts[c] ?? 0}</span>
              </button>
            ))}
          </div>
          {cadences(windows, "BTC").length === 0 && !isLoading ? <span className="text-[11px] text-bn-text-muted">no BTC series live right now</span> : null}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="tf-skeleton h-48" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="tf-card p-6 text-sm text-bn-text-dim">No live windows match. The 5m/15m/1h series run during main trading hours; 4h and 24h are always on.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map((w) => (
              <WindowCard key={w.marketId} w={w} stake={stake} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
