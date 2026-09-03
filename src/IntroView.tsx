import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Zap, Users, KeyRound, Bot, ArrowRight } from "lucide-react";
import { useLiveWindows } from "./tap/hooks";
import { useSpot } from "./tap/hooks";

const FEATURES = [
  { Icon: Zap, tag: "STEP 01", color: "#0847F7", title: "One-tap UP / DOWN", body: "Live BTC & ETH windows on DreamDEX Event Contracts. Your stake is an IOC order on a real on-chain book." },
  { Icon: Users, tag: "STEP 02", color: "#2ebd85", title: "Follow the best tappers", body: "Followers' mirrored orders fire in the same block through Somnia on-chain reactivity. No keeper, no lag." },
  { Icon: KeyRound, tag: "STEP 03", color: "#a78bfa", title: "Zero wallet popups", body: "One login grants a capped session key. Every tap after that is signed for you, on your behalf, never with your funds." },
  { Icon: Bot, tag: "STEP 04", color: "#f5a524", title: "Agents can lead", body: "A momentum bot taps as a public leader with a one-line rationale per order. Follow it like anyone else." },
];

export const IntroView: React.FC = () => {
  const { data: windows = [] } = useLiveWindows();
  const btc = useSpot("BTC");
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-14 relative">
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 text-center max-w-3xl">
          <div className="label-tag inline-block mb-5">SOMNIA × DREAMDEX EVENT CONTRACTS</div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
            Tap UP or DOWN.
            <br />
            <span style={{ color: "#0847F7" }}>Follow the best.</span>
          </h1>
          <p className="mt-5 text-bn-text-dim text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Prediction markets are solo and clunky. TapFlow turns every live BTC/ETH window into a one-tap game, lets you copy the top
            tappers block-for-block, and never shows a wallet popup after login.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link to="/tap" className="btn-primary px-6 py-3 rounded font-bold text-sm flex items-center gap-2">
              START TAPPING <ArrowRight size={16} />
            </Link>
            <Link to="/leaders" className="btn-outline px-6 py-3 rounded font-bold text-sm">
              LEADERBOARD
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-bn-text-muted font-mono">
            <span>
              <span className="text-white font-bold">{windows.length}</span> live windows
            </span>
            <span>
              BTC <span className="text-bn-green font-bold">{btc ? `$${btc.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</span>
            </span>
            <span>Shannon · chain 50312</span>
          </div>
        </motion.div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-14 max-w-5xl w-full">
          {FEATURES.map(({ Icon, tag, color, title, body }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="feature-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${color}22`, color }}>
                  {tag}
                </span>
                <Icon size={14} style={{ color }} />
              </div>
              <div className="font-bold text-sm mb-1">{title}</div>
              <div className="text-xs text-bn-text-dim leading-relaxed">{body}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
