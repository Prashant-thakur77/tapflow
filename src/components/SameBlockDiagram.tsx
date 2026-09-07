import React from "react";
import { motion } from "framer-motion";

const NODES = [
  { id: "leader", label: "Leader taps", sub: "IOC on the pool", color: "#0847F7" },
  { id: "router", label: "Router.broadcast", sub: "emits PositionOpened", color: "#8aa6f9" },
  { id: "precompile", label: "Reactivity 0x0100", sub: "invokes the handler", color: "#a78bfa" },
  { id: "handler", label: "CopyHandler.onEvent", sub: "for each follower", color: "#f5a524" },
  { id: "vault", label: "MirrorVault.mirror", sub: "follower's IOC fills", color: "#2ebd85" },
];

/**
 * The same-block story as one animated line: a pulse leaves the leader's tap
 * and lands in the follower's fill without leaving the block bracket.
 */
export const SameBlockDiagram: React.FC<{ block?: string | number; compact?: boolean }> = ({ block, compact }) => {
  const W = 860;
  const H = compact ? 120 : 150;
  const x0 = 40;
  const gap = (W - 2 * x0) / (NODES.length - 1);
  const y = compact ? 52 : 66;
  const pathD = `M${x0},${y} L${W - x0},${y}`;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ minHeight: compact ? 110 : 140 }} aria-label="same-block mirror flow">
        <defs>
          <filter id="tf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* the block bracket: everything inside happens in one block */}
        <rect x={x0 + gap - 40} y={y - 40} width={gap * 3 + 80} height={80} rx="14" fill="rgba(46,189,133,0.05)" stroke="rgba(46,189,133,0.35)" strokeDasharray="5 4" />
        <text x={x0 + gap - 30} y={y - 46} fontSize="10" fontFamily="monospace" fill="#2ebd85" letterSpacing="2">
          {block ? `BLOCK ${block}` : "ONE BLOCK"} · NO KEEPER · NO RACE
        </text>
        <path d={pathD} stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" />
        <motion.circle r="5" fill="#2ebd85" filter="url(#tf-glow)" initial={{ cx: x0 }} animate={{ cx: [x0, W - x0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }} cy={y} />
        {NODES.map((n, i) => {
          const cx = x0 + i * gap;
          return (
            <g key={n.id}>
              <motion.circle cx={cx} cy={y} r="9" fill="#0b101c" stroke={n.color} strokeWidth="2" animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6, delay: (i / (NODES.length - 1)) * 2.4 }} style={{ transformOrigin: `${cx}px ${y}px` }} />
              <circle cx={cx} cy={y} r="3.5" fill={n.color} />
              <text x={cx} y={y + 30} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Manrope, sans-serif">
                {n.label}
              </text>
              <text x={cx} y={y + 44} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.5)" fontFamily="monospace">
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
