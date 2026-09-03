import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Actors ────────────────────────────────────────────────────────────────────
// Lane order mirrors the Mermaid diagram: DS | BE | L | FE | W | RF | CRE | SC | POOL | POR
const ACTORS = [
  { id: "ds", label: "Chainlink\nData Streams", color: "#F472B6" },
  { id: "be", label: "Backend\nServer", color: "#F6AD55" },
  { id: "l", label: "In-app\nLedger", color: "#34D399" },
  { id: "fe", label: "Frontend\n(User)", color: "#60A5FA" },
  { id: "w", label: "Withdraw\n.sol", color: "#38BDF8" },
  { id: "rf", label: "Chainlink\nRef Feeds", color: "#FBBF24" },
  { id: "cre", label: "Chainlink CRE\n(DON)", color: "#FB923C" },
  { id: "sc", label: "Settlement\nCommit.sol", color: "#E879F9" },
  { id: "pool", label: "Liquidity\nPool.sol", color: "#818CF8" },
  { id: "por", label: "Pool\nReserve.sol", color: "#6EE7B7" },
];

// ─── Section groups (mirrors Mermaid "Note over" blocks) ───────────────────────
const GROUPS = [
  {
    label: "Real-time pricing input",
    startStep: 0,
    endStep: 2,
    color: "#F472B6",
  },
  { label: "Bet placement + lock", startStep: 3, endStep: 5, color: "#60A5FA" },
  {
    label: "Fast settlement + UX credit",
    startStep: 6,
    endStep: 9,
    color: "#34D399",
  },
  {
    label: "Periodic on-chain audit + withdraw gating",
    startStep: 10,
    endStep: 13,
    color: "#FB923C",
  },
  {
    label: "Withdraw uses committed cap",
    startStep: 14,
    endStep: 15,
    color: "#38BDF8",
  },
];

// ─── Steps  ────────────────────────────────────────────────────────────────────
// style: "solid"  = ->>   (open arrowhead)
//        "dashed" = -->>  (dashed open arrowhead, return / async)
// "self" arrows: from === to  → rendered as loop
const STEPS = [
  // ── Group 1: Real-time pricing ───────────────────────────────────────────────
  {
    id: 1,
    from: "ds",
    to: "be",
    label: "1s OHLC ticks",
    style: "dashed" as const,
    note: "①",
  },
  {
    id: 2,
    from: "be",
    to: "be",
    label: "state update (EWMA + jumps)",
    style: "solid" as const,
    note: "②",
  },
  {
    id: 3,
    from: "be",
    to: "fe",
    label: "grid + multipliers (100ms)",
    style: "dashed" as const,
    note: "③",
  },
  // ── Group 2: Bet placement ───────────────────────────────────────────────────
  {
    id: 4,
    from: "fe",
    to: "be",
    label: "PlaceBet(cell, amount)",
    style: "solid" as const,
    note: "④",
  },
  {
    id: 5,
    from: "be",
    to: "ds",
    label: "anchor lock tick (s_lock)",
    style: "solid" as const,
    note: "⑤",
  },
  {
    id: 6,
    from: "be",
    to: "fe",
    label: "BetLocked(multiplier, window)",
    style: "dashed" as const,
    note: "⑥",
  },
  // ── Group 3: Fast settlement ─────────────────────────────────────────────────
  {
    id: 7,
    from: "ds",
    to: "be",
    label: "OHLC ticks for window",
    style: "dashed" as const,
    note: "⑦",
  },
  {
    id: 8,
    from: "be",
    to: "be",
    label: "touch test (H/L vs band)",
    style: "solid" as const,
    note: "⑧",
  },
  {
    id: 9,
    from: "be",
    to: "l",
    label: "credit in-app balance (if WIN)",
    style: "solid" as const,
    note: "⑨",
  },
  {
    id: 10,
    from: "be",
    to: "fe",
    label: "result + updated in-app balance",
    style: "dashed" as const,
    note: "⑩",
  },
  // ── Group 4: On-chain audit ──────────────────────────────────────────────────
  {
    id: 11,
    from: "cre",
    to: "rf",
    label: "read reference price",
    style: "solid" as const,
    note: "⑪",
  },
  {
    id: 12,
    from: "cre",
    to: "sc",
    label: "commit outcomes + withdrawable caps",
    style: "solid" as const,
    note: "⑫",
  },
  {
    id: 13,
    from: "cre",
    to: "pool",
    label: "read pool balance",
    style: "solid" as const,
    note: "⑬",
  },
  {
    id: 14,
    from: "cre",
    to: "por",
    label: "publish solvency report",
    style: "solid" as const,
    note: "⑭",
  },
  // ── Group 5: Withdrawal ──────────────────────────────────────────────────────
  {
    id: 15,
    from: "fe",
    to: "w",
    label: "withdraw(amount)",
    style: "solid" as const,
    note: "⑮",
  },
  {
    id: 16,
    from: "w",
    to: "fe",
    label: "allow up to committed withdrawable",
    style: "dashed" as const,
    note: "⑯",
  },
];

// ─── Layout constants ─────────────────────────────────────────────────────────
const LANE_W = 110;
const TOTAL_W = ACTORS.length * LANE_W;
const HEADER_H = 64;
const ROW_H = 64;
const PADDING = 8; // gap from lifeline to arrow start/end
const DIAGRAM_H = HEADER_H + STEPS.length * ROW_H + 60;

function laneX(id: string) {
  const idx = ACTORS.findIndex((a) => a.id === id);
  return idx * LANE_W + LANE_W / 2;
}

function actorColor(id: string) {
  return ACTORS.find((a) => a.id === id)?.color ?? "#888";
}

// ─── SVG Arrow marker ─────────────────────────────────────────────────────────
// We create two markers: one pointing right (default), one pointing left.
// Then pick based on arrow direction—no relying on orient="auto" rotation.
const Defs: React.FC = () => (
  <defs>
    {ACTORS.map((a) => (
      <React.Fragment key={a.id}>
        {/* Right-pointing arrowhead */}
        <marker
          id={`arr-r-${a.id}`}
          markerWidth="9"
          markerHeight="9"
          refX="8"
          refY="4"
          orient="0"
        >
          <path d="M0,0 L0,8 L9,4 z" fill={a.color} />
        </marker>
        {/* Left-pointing arrowhead */}
        <marker
          id={`arr-l-${a.id}`}
          markerWidth="9"
          markerHeight="9"
          refX="1"
          refY="4"
          orient="0"
        >
          <path d="M9,0 L9,8 L0,4 z" fill={a.color} />
        </marker>
      </React.Fragment>
    ))}
    {/* Dashed variants use gray */}
    <marker
      id="arr-r-dashed"
      markerWidth="9"
      markerHeight="9"
      refX="8"
      refY="4"
      orient="0"
    >
      <path d="M0,0 L0,8 L9,4 z" fill="#666" />
    </marker>
    <marker
      id="arr-l-dashed"
      markerWidth="9"
      markerHeight="9"
      refX="1"
      refY="4"
      orient="0"
    >
      <path d="M9,0 L9,8 L0,4 z" fill="#666" />
    </marker>
  </defs>
);

// ─── Animated arrow path ──────────────────────────────────────────────────────
const AnimArrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dashed?: boolean;
  goRight: boolean;
  actorId: string;
  isActive: boolean;
}> = ({ x1, y1, x2, y2, color, dashed, goRight, actorId, isActive }) => {
  const markerId = dashed
    ? goRight
      ? "arr-r-dashed"
      : "arr-l-dashed"
    : goRight
      ? `arr-r-${actorId}`
      : `arr-l-${actorId}`;

  const strokeColor = dashed ? "#666" : color;
  const pathData = `M ${x1} ${y1} L ${x2} ${y2}`;

  return (
    <g>
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isActive ? 2 : 1.2}
        strokeDasharray={dashed ? "5,4" : undefined}
        markerEnd={`url(#${markerId})`}
        opacity={isActive ? 1 : 0.45}
        className="transition-all duration-300"
      />
      {isActive && (
        <circle r={3} fill="#fff" filter={`drop-shadow(0 0 6px ${color})`}>
          <animateMotion dur="1s" repeatCount="indefinite" path={pathData} />
        </circle>
      )}
    </g>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const CreWorkflowAnimation: React.FC = () => {
  const [step, setStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setStep((p) => (p >= STEPS.length - 1 ? -1 : p + 1));
    }, 1800);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  const currentStep = step;

  return (
    <div
      className="w-full relative rounded-2xl overflow-hidden border border-white/5"
      style={{
        background: "linear-gradient(160deg, #08090D 0%, #0d0f18 100%)",
        fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
      }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-white/5"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          </div>
          <span className="text-[11px] text-gray-400 tracking-wider">
            cre-workflow / sequence-diagram.ts
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: isPlaying ? "#2EBD85" : "#555" }}
          />
          <span
            className="text-[10px] font-mono"
            style={{ color: isPlaying ? "#2EBD85" : "#555" }}
          >
            {isPlaying ? "LIVE" : "PAUSED"}
          </span>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="px-2 py-0.5 text-[10px] font-bold rounded border"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              color: "#aaa",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
          </button>
          <button
            onClick={() => setStep(-1)}
            className="px-2 py-0.5 text-[10px] font-bold rounded border"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              color: "#aaa",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            ↩ RESET
          </button>
        </div>
      </div>

      {/* ── Diagram ── */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: TOTAL_W + 40, padding: "0 20px" }}>
          <svg
            width={TOTAL_W}
            height={DIAGRAM_H}
            viewBox={`0 0 ${TOTAL_W} ${DIAGRAM_H}`}
            style={{ display: "block" }}
          >
            <Defs />

            {/* Actor boxes & lifelines */}
            {ACTORS.map((actor) => {
              const x = laneX(actor.id);
              const lines = actor.label.split("\n");
              const twoLine = lines.length > 1;
              return (
                <g key={actor.id}>
                  {/* Top header */}
                  <rect
                    x={x - 44}
                    y={4}
                    width={88}
                    height={48}
                    rx={6}
                    fill={`${actor.color}14`}
                    stroke={`${actor.color}40`}
                    strokeWidth={1}
                  />
                  {lines.map((ln, li) => (
                    <text
                      key={li}
                      x={x}
                      y={twoLine ? (li === 0 ? 23 : 37) : 32}
                      textAnchor="middle"
                      fontSize={9}
                      fill={actor.color}
                      fontFamily="inherit"
                      fontWeight="700"
                    >
                      {ln}
                    </text>
                  ))}
                  {/* Lifeline */}
                  <line
                    x1={x}
                    y1={54}
                    x2={x}
                    y2={DIAGRAM_H - 56}
                    stroke={`${actor.color}22`}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                  {/* Bottom header */}
                  <rect
                    x={x - 44}
                    y={DIAGRAM_H - 52}
                    width={88}
                    height={48}
                    rx={6}
                    fill={`${actor.color}14`}
                    stroke={`${actor.color}40`}
                    strokeWidth={1}
                  />
                  {lines.map((ln, li) => (
                    <text
                      key={li}
                      x={x}
                      y={DIAGRAM_H - 52 + (twoLine ? (li === 0 ? 20 : 34) : 28)}
                      textAnchor="middle"
                      fontSize={9}
                      fill={actor.color}
                      fontFamily="inherit"
                      fontWeight="700"
                    >
                      {ln}
                    </text>
                  ))}
                </g>
              );
            })}

            {/* ── Section group banners (Note over …) ── */}
            {GROUPS.map((grp) => {
              const topY = HEADER_H + grp.startStep * ROW_H - 10;
              const botY = HEADER_H + (grp.endStep + 1) * ROW_H + 10;
              const isActiveGroup =
                currentStep >= grp.startStep && currentStep <= grp.endStep;
              return (
                <g key={grp.label} className="transition-all duration-300">
                  {/* Background band */}
                  <rect
                    x={4}
                    y={topY}
                    width={TOTAL_W - 8}
                    height={botY - topY}
                    rx={6}
                    fill={`${grp.color}${isActiveGroup ? "10" : "07"}`}
                    stroke={`${grp.color}${isActiveGroup ? "40" : "28"}`}
                    strokeWidth={1}
                    strokeDasharray="6,4"
                    className="transition-all duration-300"
                  />
                  {/* Label pill */}
                  <rect
                    x={10}
                    y={topY + 4}
                    width={Math.min(grp.label.length * 5.5 + 12, TOTAL_W - 24)}
                    height={14}
                    rx={3}
                    fill={`${grp.color}${isActiveGroup ? "30" : "20"}`}
                    className="transition-all duration-300"
                  />
                  <text
                    x={16}
                    y={topY + 14}
                    fontSize={8}
                    fill={grp.color}
                    fontFamily="inherit"
                    fontWeight="bold"
                    opacity={isActiveGroup ? 1 : 0.6}
                    className="transition-all duration-300"
                  >
                    {grp.label}
                  </text>
                </g>
              );
            })}

            {/* Messages */}
            {STEPS.map((msg, idx) => {
              const isActive = idx === currentStep;
              const rowY = HEADER_H + idx * ROW_H + ROW_H / 2;
              const isSelf = msg.from === msg.to;
              const color = actorColor(msg.from);
              const isDashed = msg.style === "dashed";

              if (isSelf) {
                // Self-loop curves to the RIGHT of the actor
                const fx = laneX(msg.from);
                const loopW = 38;
                const pathData = `M ${fx} ${rowY - 8} C ${fx + loopW} ${rowY - 8}, ${fx + loopW} ${rowY + 8}, ${fx} ${rowY + 8}`;
                return (
                  <g key={msg.id} className="transition-all duration-300">
                    <path
                      d={pathData}
                      fill="none"
                      stroke={color}
                      strokeWidth={isActive ? 2 : 1.2}
                      opacity={isActive ? 1 : 0.45}
                      markerEnd={`url(#arr-l-${msg.from})`}
                      className="transition-all duration-300"
                    />
                    {isActive && (
                      <circle
                        r={3}
                        fill="#fff"
                        filter={`drop-shadow(0 0 6px ${color})`}
                      >
                        <animateMotion
                          dur="1s"
                          repeatCount="indefinite"
                          path={pathData}
                        />
                      </circle>
                    )}
                    {/* Label left of loop */}
                    <text
                      x={fx - 6}
                      y={rowY - 12}
                      textAnchor="end"
                      fontSize={9.5}
                      fill={isActive ? "#e5e7eb" : "#525252"}
                      fontFamily="inherit"
                      fontWeight={isActive ? "600" : "400"}
                      className="transition-all duration-300"
                    >
                      {msg.label}
                    </text>
                    {/* Badge dot on loop */}
                    {msg.note && (
                      <g>
                        <circle
                          cx={fx + loopW + 10}
                          cy={rowY}
                          r={8}
                          fill={`${color}30`}
                          stroke={`${color}60`}
                          strokeWidth={1}
                          opacity={isActive ? 1 : 0.3}
                          className="transition-all duration-300"
                        />
                        <text
                          x={fx + loopW + 10}
                          y={rowY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={7}
                          fill={color}
                          fontFamily="inherit"
                          fontWeight="bold"
                          opacity={isActive ? 1 : 0.3}
                          className="transition-all duration-300"
                        >
                          {msg.note}
                        </text>
                      </g>
                    )}
                  </g>
                );
              }

              const fromX = laneX(msg.from);
              const toX = laneX(msg.to);
              const goRight = toX > fromX;

              // Arrow start / end x — leave PADDING gap from lifeline centre
              const x1 = goRight ? fromX + PADDING : fromX - PADDING;
              const x2 = goRight ? toX - PADDING : toX + PADDING;

              // Badge position: just before the arrowhead
              const badgeX = goRight ? x2 - 10 : x2 + 10;

              // Label centred between actors
              const labelX = (fromX + toX) / 2;

              return (
                <g key={msg.id} className="transition-all duration-300">
                  {/* Arrow line (path so pathLength works) */}
                  <AnimArrow
                    x1={x1}
                    y1={rowY}
                    x2={x2}
                    y2={rowY}
                    color={color}
                    dashed={isDashed}
                    goRight={goRight}
                    actorId={msg.from}
                    isActive={isActive}
                  />

                  {/* Label above arrow */}
                  <text
                    x={labelX}
                    y={rowY - 8}
                    textAnchor="middle"
                    fontSize={9.5}
                    fill={isActive ? color : "#525252"}
                    fontFamily="inherit"
                    fontWeight={isActive ? "700" : "400"}
                    className="transition-all duration-300"
                  >
                    {msg.label}
                  </text>

                  {/* Numbered badge at arrowhead */}
                  {msg.note && (
                    <g>
                      <circle
                        cx={badgeX}
                        cy={rowY}
                        r={8}
                        fill={`${color}28`}
                        stroke={`${color}55`}
                        strokeWidth={1}
                        opacity={isActive ? 1 : 0.3}
                        className="transition-all duration-300"
                      />
                      <text
                        x={badgeX}
                        y={rowY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={7}
                        fill={color}
                        fontFamily="inherit"
                        fontWeight="bold"
                        opacity={isActive ? 1 : 0.3}
                        className="transition-all duration-300"
                      >
                        {msg.note}
                      </text>
                    </g>
                  )}

                  {/* Active pulse dot on source lifeline */}
                  {isActive && (
                    <motion.circle
                      cx={fromX}
                      cy={rowY}
                      r={4}
                      fill={color}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ scale: [1, 1.8, 1], opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div className="border-t border-white/5 mx-5 mb-5 mt-1">
        <AnimatePresence mode="wait">
          {currentStep >= 0 && currentStep < STEPS.length ? (
            (() => {
              const msg = STEPS[currentStep];
              const fc = actorColor(msg.from);
              const tc = actorColor(msg.to);
              return (
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 rounded-xl p-4 flex items-start gap-3"
                  style={{ background: `${fc}0d`, border: `1px solid ${fc}25` }}
                >
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                    style={{
                      background: `${fc}22`,
                      color: fc,
                      border: `1px solid ${fc}40`,
                    }}
                  >
                    {currentStep + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                      <span style={{ color: fc }}>
                        {ACTORS.find((a) => a.id === msg.from)?.label.replace(
                          "\n",
                          " ",
                        )}
                      </span>
                      <span className="text-gray-600">→</span>
                      <span style={{ color: tc }}>
                        {ACTORS.find((a) => a.id === msg.to)?.label.replace(
                          "\n",
                          " ",
                        )}
                      </span>
                      {(() => {
                        const grp = GROUPS.find(
                          (g) =>
                            currentStep >= g.startStep &&
                            currentStep <= g.endStep,
                        );
                        return grp ? (
                          <span
                            className="ml-1 px-2 py-0.5 rounded text-[9px] font-black tracking-widest"
                            style={{
                              background: `${grp.color}18`,
                              color: grp.color,
                            }}
                          >
                            {grp.label}
                          </span>
                        ) : null;
                      })()}
                      {msg.style === "dashed" && (
                        <span
                          className="ml-1 px-2 py-0.5 rounded text-[9px] font-black tracking-widest"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            color: "#888",
                          }}
                        >
                          ASYNC
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-300 leading-relaxed">
                      {msg.label}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-gray-500 font-mono">
                    {currentStep + 1}/{STEPS.length}
                  </span>
                </motion.div>
              );
            })()
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-xl p-4 flex items-center gap-3"
              style={{
                background: "rgba(251,146,60,0.06)",
                border: "1px solid rgba(251,146,60,0.2)",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-lg"
                style={{ background: "rgba(251,146,60,0.15)" }}
              >
                🔄
              </div>
              <div>
                <p className="text-xs font-bold text-[#FB923C]">
                  CRE Workflow Ready
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Press Play to animate the Chainlink CRE settlement sequence.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Metrics footer ── */}
      <div className="border-t border-white/5 grid grid-cols-5 divide-x divide-white/5">
        {[
          {
            label: "Price Feed",
            value: "Data Streams",
            sub: "1s OHLC ticks",
            color: "#F472B6",
          },
          {
            label: "Settlement",
            value: "BackEnd",
            sub: "EWMA + touch test",
            color: "#F6AD55",
          },
          {
            label: "Ledger",
            value: "Off-Chain",
            sub: "WAL + balance",
            color: "#34D399",
          },
          {
            label: "Audit",
            value: "CRE (DON)",
            sub: "SettlementCommit",
            color: "#FB923C",
          },
          {
            label: "Withdrawal",
            value: "On-Chain",
            sub: "Merkle-gated",
            color: "#38BDF8",
          },
        ].map((m) => (
          <div key={m.label} className="px-4 py-3 text-center">
            <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">
              {m.label}
            </div>
            <div className="text-[13px] font-bold" style={{ color: m.color }}>
              {m.value}
            </div>
            <div className="text-[9px] text-gray-500 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      <div className="h-0.5 w-full bg-white/5">
        <motion.div
          className="h-full"
          style={{
            background:
              "linear-gradient(90deg, #60A5FA, #F472B6, #FB923C, #34D399, #38BDF8)",
          }}
          animate={{
            width: `${currentStep < 0 ? 0 : ((currentStep + 1) / STEPS.length) * 100}%`,
          }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};
