import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Zap, Users, KeyRound, Bot, ArrowRight, ShieldCheck, LayoutGrid } from "lucide-react";
import { useCountdown, useCurrentWindow, useLiveWindows, useNow, useSpot } from "./tap/hooks";
import { WindowRing } from "./tap/WindowRing";
import { fmtCadence, fmtCountdown } from "./lib/ec";
import { useProof, useStats } from "./tap/useLeaderboard";
import { SameBlockDiagram } from "./components/SameBlockDiagram";

const FEATURES = [
  { Icon: Zap, tag: "01", color: "#0847F7", title: "One tap. Real order.", body: "Every window is a DreamDEX Event Contract. Your stake becomes an IOC order on a live on-chain book. No mock, no house." },
  { Icon: Users, tag: "02", color: "#2ebd85", title: "Follow the best tappers.", body: "Your mirrored order fires in the same block as the leader's, through Somnia on-chain reactivity. No keeper, no lag." },
  { Icon: KeyRound, tag: "03", color: "#a78bfa", title: "Zero popups after login.", body: "One signature grants a capped session key. It can place and cancel for you. It can never move your funds." },
  { Icon: Bot, tag: "04", color: "#f5a524", title: "Agents can lead.", body: "A momentum bot taps as a public leader with a one-line rationale per order. Follow it like any human." },
];

export const IntroView: React.FC = () => {
  const { data: windows = [] } = useLiveWindows();
  const btc = useSpot("BTC");
  const { window: w5 } = useCurrentWindow("BTC", 300);
  // No 5m window live? Show the soonest-closing real window of any cadence instead of a spinner.
  const w = w5 ?? [...windows].sort((a, b) => a.expiry - b.expiry)[0];
  const { left, pct } = useCountdown(w);
  const now = useNow(1000);
  const { data: proof } = useProof();
  const { data: stats } = useStats();
  const samePct = proof && proof.mirrors ? Math.round((proof.sameBlock / proof.mirrors) * 100) : null;
  const strip = windows.map((x) => `${x.asset} ${fmtCadence(x.intervalSec)} · closes in ${fmtCountdown(x.expiry - now / 1000)}`);

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="min-h-full flex flex-col px-5 sm:px-8 py-10 sm:py-14 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #0847F7 0%, #002280 100%)" }}>
              ⚡
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              TapFlow<span className="text-accent">.</span>
            </span>
          </div>
          <Link to="/tap" className="text-xs font-bold text-bn-text-dim hover:text-white">
            Open app →
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center mt-14 sm:mt-20">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="label-tag inline-block mb-5">SOMNIA × DREAMDEX EVENT CONTRACTS</div>
            <h1 className="font-display font-bold text-5xl sm:text-7xl tracking-[-0.03em] leading-[0.98]">
              Tap the next
              <br />
              <span className="text-accent">five minutes.</span>
            </h1>
            <p className="mt-6 text-bn-text-dim text-base sm:text-lg max-w-xl leading-relaxed">
              Prediction markets are solo and clunky. TapFlow turns every live BTC and ETH window into a one-tap call, lets you copy the top tappers
              block-for-block, and never shows a wallet popup after login.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/tap" className="btn-primary px-6 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2">
                START TAPPING <ArrowRight size={16} />
              </Link>
              <Link to="/leaders" className="btn-outline px-6 py-3.5 rounded-xl font-bold text-sm">
                LEADERBOARD
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-bn-text-muted font-mono">
              <span>
                <span className="text-white font-bold">{windows.length || "—"}</span> live windows
              </span>
              <span>
                BTC <span className="text-up font-bold">{btc ? `$${btc.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</span>
              </span>
              <span>Shannon · 50312</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.5 }} className="tf-card p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(70% 60% at 50% 0%, rgba(8,71,247,0.25), transparent 70%)" }} />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.3em] text-bn-text-muted text-center mb-4">live right now</div>
              <WindowRing left={left} pct={pct} size={200} label={w ? `${w.asset} · ${fmtCadence(w.intervalSec)}` : "loading"} sub={w ? "this is a real window" : undefined} />
              <Link to="/tap" className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl py-3 text-center font-display font-bold text-up" style={{ background: "rgba(46,189,133,0.12)", border: "1px solid rgba(46,189,133,0.35)" }}>
                  UP
                </div>
                <div className="rounded-xl py-3 text-center font-display font-bold text-down" style={{ background: "rgba(246,70,93,0.12)", border: "1px solid rgba(246,70,93,0.35)" }}>
                  DOWN
                </div>
              </Link>
            </div>
          </motion.div>
        </div>

        {strip.length ? (
          <div className="mt-14 overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] py-2">
            <div className="tf-marquee text-[11px] font-mono text-bn-text-dim">
              {[...strip, ...strip].map((s, i) => (
                <span key={i} className="px-5 whitespace-nowrap">
                  <span className="text-white/40 mr-3">●</span>
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* the differentiator, with live numbers from the indexer */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-10 tf-card p-5 sm:p-6 relative overflow-hidden" style={{ borderColor: "rgba(46,189,133,0.35)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(60% 80% at 0% 50%, rgba(46,189,133,0.12), transparent 70%)" }} />
          <div className="relative grid lg:grid-cols-[1.1fr_1fr] gap-6 items-center">
            <div>
              <div className="label-tag inline-block mb-3" style={{ borderColor: "rgba(46,189,133,0.5)", color: "#2ebd85" }}>PROVEN ON SHANNON</div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight leading-tight">
                Copy-trades that land in the <span className="text-up">same block</span> as the leader.
              </h2>
              <p className="mt-3 text-sm text-bn-text-dim max-w-lg leading-relaxed">
                A leader's tap emits an event. Somnia's reactivity precompile invokes our CopyHandler inside that block, and MirrorVault places every follower's order right behind it. No bot, no keeper, no race.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/proof" className="btn-outline px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2">
                  <ShieldCheck size={14} /> See every mirror on-chain
                </Link>
                <Link to="/markets" className="btn-outline px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2">
                  <LayoutGrid size={14} /> All live windows
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "same block", value: samePct !== null ? `${samePct}%` : "—", hint: proof ? `${proof.sameBlock} of ${proof.mirrors} mirrors` : "indexer offline", up: true },
                { label: "reactive mirrors", value: proof ? String(proof.mirrors) : "—", hint: proof ? `${proof.successful} filled` : "" },
                { label: "broadcasts", value: proof ? String(proof.broadcasts) : "—", hint: proof ? `${proof.leaders} leaders` : "" },
                { label: "wallets", value: stats ? String(stats.wallets) : "—", hint: "on the venue" },
                { label: "taps indexed", value: stats ? String(stats.taps) : "—", hint: "from pool logs" },
                { label: "volume", value: stats ? `${Math.round(stats.volumeUsdc).toLocaleString()}` : "—", hint: "tUSDC" },
              ].map((t) => (
                <div key={t.label} className="rounded-xl p-3 bg-white/[0.03] border border-white/5">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-bn-text-muted">{t.label}</div>
                  <div className={`font-mono font-extrabold text-xl tabular mt-0.5 ${t.up ? "text-up" : ""}`}>{t.value}</div>
                  <div className="text-[10px] text-bn-text-muted mt-0.5">{t.hint}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-4 hidden sm:block">
            <SameBlockDiagram block={(proof?.latest?.[0] as { block?: number } | undefined)?.block} compact />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
          {FEATURES.map(({ Icon, tag, color, title, body }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.07 }} className="tf-card p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[11px] text-bn-text-muted">{tag}</span>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, color }}>
                  <Icon size={15} />
                </span>
              </div>
              <div className="font-display font-bold text-base leading-tight">{title}</div>
              <div className="text-xs text-bn-text-dim leading-relaxed mt-2">{body}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-[11px] text-bn-text-muted font-mono flex flex-wrap gap-x-6 gap-y-1">
          <span>no wallet needed to look around — every page reads live from chain</span>
          <span>built on @somnia-chain/markets-sdk</span>
          <span>every number on this page is read from Somnia Shannon</span>
        </div>
      </div>
    </div>
  );
};
