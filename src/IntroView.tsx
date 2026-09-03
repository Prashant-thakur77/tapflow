import React, { useState, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Zap,
  Layers,
  Activity,
  ArrowRightLeft,
  Lock,
  Globe,
  Database,
  Network,
} from "lucide-react";
import { Squares } from "./Squares";
import {
  PriceIntegrityCREWorkflow,
  ProofOfReserveWorkflow,
  RegimeModelCREWorkflow,
  SettlementCREWorkflow,
} from "./WorkflowDiagrams";

const WORKFLOW_TABS = [
  {
    label: "Price Integrity",
    color: "#F472B6",
    Component: PriceIntegrityCREWorkflow,
  },
  {
    label: "Proof of Reserve",
    color: "#6EE7B7",
    Component: ProofOfReserveWorkflow,
  },
  {
    label: "Regime Model",
    color: "#FB923C",
    Component: RegimeModelCREWorkflow,
  },
  { label: "Settlement", color: "#818CF8", Component: SettlementCREWorkflow },
];

const WorkflowDiagramTabs: React.FC = () => {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % WORKFLOW_TABS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const { Component } = WORKFLOW_TABS[active];

  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center mb-6 pb-3 relative">
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[1px] w-[min(92%,640px)] bg-white/10" />
        {WORKFLOW_TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => {
              setActive(i);
              setIsPaused(true);
            }}
            className={`relative px-4 py-1.5 rounded-lg text-[14px] font-mono tracking-wider transition-all border ${
              active === i
                ? "font-black scale-[1.05]"
                : "font-semibold hover:text-white/90 hover:border-white/25 hover:bg-white/[0.06]"
            }`}
            style={{
              background:
                active === i ? `${tab.color}44` : "rgba(255,255,255,0.04)",
              color: active === i ? "#ffffff" : "#8f8f8f",
              borderColor:
                active === i ? `${tab.color}AA` : "rgba(255,255,255,0.08)",
              boxShadow:
                active === i
                  ? `0 0 0 1px ${tab.color}66, 0 10px 26px ${tab.color}55, inset 0 0 20px ${tab.color}33`
                  : "none",
              textShadow: active === i ? `0 0 10px ${tab.color}AA` : "none",
            }}
          >
            {tab.label}
            {active === i && (
              <motion.span
                layoutId="workflow-active-tab-underline"
                className="absolute -bottom-[10px] left-1.5 right-1.5 h-[3.5px] rounded-full"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${tab.color} 22%, ${tab.color} 78%, transparent 100%)`,
                  boxShadow: `0 0 16px ${tab.color}, 0 0 28px ${tab.color}AA`,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
          </button>
        ))}
        {isPaused && (
          <button
            onClick={() => setIsPaused(false)}
            className="absolute px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider transition-all border border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 top-15 -right-[200px] z-99"
          >
            ▶ RESUME AUTO-SWITCH
          </button>
        )}
      </div>
      <Component key={active} />
    </div>
  );
};

export const IntroView: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const workflows = [
    {
      icon: <Activity size={24} />,
      title: "Price Integrity via Streams",
      desc: "High-frequency sub-second BTC/USD market data pulled from Chainlink Data Streams directly to the matching engine.",
      color: "#0847F7",
    },
    {
      icon: <Database size={24} />,
      title: "Batch Submissions",
      desc: "Trades, liquidity events, and oracle reports are aggregated off-chain and submitted as verifiable batches to our smart contracts.",
      color: "#A78BFA",
    },
    {
      icon: <Layers size={24} />,
      title: "Deterministic Settlement",
      desc: "Settlement payloads are built off-chain safely and cleanly. Winners withdraw without locking up large on-chain gas fees per tx.",
      color: "#34D399",
    },
    {
      icon: <ShieldCheck size={24} />,
      title: "Continuous Solvency",
      desc: "Pools are audited constantly by the Chainlink Runtime Environment (CRE). Real-time Proof of Reserve ensures full collateralization.",
      color: "#63B3ED",
    },
    {
      icon: <ArrowRightLeft size={24} />,
      title: "LP & Yield Distribution",
      desc: "Cross-chain logic via CCIP to automatically balance liquidity provider distributions globally, maintaining capital efficiency.",
      color: "#F6AD55",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto w-full relative z-0">
      <div className="absolute inset-0 z-0">
        <Squares
          speed={0.5}
          squareSize={40}
          direction="diagonal" // up, down, left, right, diagonal
          borderColor="rgba(255, 255, 255, 0.05)"
          hoverFillColor="rgba(8, 71, 247, 0.2)"
        />
      </div>
      <div
        className="absolute top-1/4 left-1/3 w-[600px] h-[600px] px-0 opacity-10 pointer-events-none rounded-full blur-[120px] z-0"
        style={{
          background: "radial-gradient(circle, #0847F7 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] px-0 opacity-10 pointer-events-none rounded-full blur-[100px] z-0"
        style={{
          background: "radial-gradient(circle, #2EBD85 0%, transparent 70%)",
        }}
      />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 pb-24 lg:pb-12 relative z-10 pointer-events-none"
      >
        {/* Navigation Header */}
        <div className="flex justify-between items-center mb-12 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #0847F7 0%, #002280 100%)",
                boxShadow: "0 4px 15px rgba(8, 71, 247, 0.4)",
              }}
            >
              <img
                src="/tapl.png"
                alt="tapl"
                className="w-7 h-7 object-contain relative z-10"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic text-[#0847F7]">
              TAPL
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <motion.div
          variants={itemVariants}
          className="text-center mb-16 mt-4 pointer-events-auto"
        >
          <div
            className="inline-block px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest mb-6"
            style={{
              background: "rgba(8, 71, 247, 0.15)",
              color: "#0847F7",
              border: "1px solid rgba(8, 71, 247, 0.3)",
            }}
          >
            Introducing TAPL Protocol
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-[1.15]">
            On-chain Derivatives <br className="hidden md:block" />
            <span style={{ color: "#0847F7" }}>Powered by Chainlink CRE</span>
          </h1>
          <p
            className="max-w-2xl mx-auto text-sm md:text-base leading-relaxed"
            style={{ color: "#a0a0a0" }}
          >
            TAPL brings sub-second market prediction to Web3. Trade without
            limits, provide liquidity safely, and benefit from lightning-fast
            Chainlink decentralized oracle networks executing off-chain
            computations and returning verifiable results on-chain.
          </p>
          <div className="flex justify-center mt-10">
            <Link
              to="/trade"
              className="px-5 py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition-all hover:scale-105 active:scale-95 border border-[#0847F7]/30 hover:border-[#0847F7] w-[200px]"
              style={{
                background: "rgba(8, 71, 247, 0.1)",
                color: "#ffffff",
              }}
            >
              LAUNCH APP
            </Link>
          </div>
        </motion.div>

        {/* CRE Workflow Diagrams — Tabbed */}
        <motion.div
          variants={itemVariants}
          className="mt-20 mb-10 w-full max-w-5xl mx-auto pointer-events-auto"
        >
          <h2 className="text-3xl font-bold mb-2 text-center">
            Powered by CRE{" "}
          </h2>

          <WorkflowDiagramTabs />
        </motion.div>

        {/* How It Works */}
        <motion.div
          variants={itemVariants}
          className="mb-20 pointer-events-auto"
        >
          <h2 className="text-2xl font-bold mb-3 text-center">How It Works</h2>
          <p
            className="max-w-3xl mx-auto text-center text-sm md:text-base leading-relaxed mb-8"
            style={{ color: "#a0a0a0" }}
          >
            TAPL is a prediction trading app where you connect your wallet, pick
            a market direction, and let Chainlink-powered infrastructure handle
            fair pricing, execution, and settlement.
          </p>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              {
                step: "01",
                title: "Connect Wallet",
                desc: "Use any EVM-compatible wallet to access TAPL instantly with no account creation.",
                color: "#0847F7",
              },
              {
                step: "02",
                title: "Place Prediction",
                desc: "Choose market direction and submit your position with transparent on-chain intent.",
                color: "#2EBD85",
              },
              {
                step: "03",
                title: "CRE Processing",
                desc: "Chainlink CRE validates market data, computes outcomes, and prepares secure batches.",
                color: "#A78BFA",
              },
              {
                step: "04",
                title: "Settle & Withdraw",
                desc: "Final results are committed on-chain and eligible winnings can be withdrawn trustlessly.",
                color: "#F6AD55",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl p-5"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <div
                  className="inline-flex items-center justify-center rounded px-2 py-1 text-[11px] font-bold mb-3"
                  style={{
                    background: `${item.color}20`,
                    color: item.color,
                    border: `1px solid ${item.color}30`,
                  }}
                >
                  STEP {item.step}
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#a0a0a0" }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* General App Features */}
        <motion.div
          variants={itemVariants}
          className="mb-20 pointer-events-auto"
        >
          <h2 className="text-2xl font-bold mb-8 text-center">Core Pillars</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Globe size={20} />,
                title: "Permissionless Access",
                desc: "No KYC, no signups. Connect any EVM-compatible wallet to trade transparently.",
                color: "#0847F7",
              },
              {
                icon: <Zap size={20} />,
                title: "Instant Execution",
                desc: "Orders bypass slow blockchain layers thanks to off-chain sequencer networks matching trades in real-time.",
                color: "#2EBD85",
              },
              {
                icon: <Lock size={20} />,
                title: "Self-Custodial",
                desc: "You retain full control over your funds via thoroughly tested, heavily audited EVM smart contracts.",
                color: "#A78BFA",
              },
            ].map((feat, i) => (
              <div
                key={i}
                className="rounded-xl p-6"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div
                  className="w-10 h-10 rounded flex items-center justify-center mb-5"
                  style={{
                    background: `${feat.color}15`,
                    color: feat.color,
                    border: `1px solid ${feat.color}30`,
                  }}
                >
                  {feat.icon}
                </div>
                <h3
                  className="text-base font-semibold mb-2"
                  style={{ color: "#ffffff" }}
                >
                  {feat.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#a0a0a0" }}
                >
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Highlighted section for CRE Workflow */}
        <motion.div
          variants={itemVariants}
          className="my-16 pointer-events-auto"
        >
          <div
            className="rounded-2xl relative overflow-hidden p-8 md:p-12 border border-[#0847F7]/20"
            style={{
              background:
                "linear-gradient(135deg, rgba(8, 71, 247, 0.08) 0%, rgba(22, 20, 42, 0.8) 100%)",
            }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#0847F7]/10 blur-[80px] rounded-full" />

            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-5 flex items-center gap-3">
                  <Network className="text-[#0847F7]" />
                  How CRE Workflows Drive TAPL
                </h3>
                <p
                  className="mb-6 text-sm md:text-base leading-relaxed"
                  style={{ color: "#d0d0d0" }}
                >
                  Traditional DApps struggle with the blockchain trilemma —
                  managing latency, data cost, and security. By integrating the{" "}
                  <b>Chainlink Runtime Environment (CRE)</b>, we offload heavy
                  validation and data ingestion processes into scalable worker
                  networks.
                </p>
                <p
                  className="text-sm md:text-base leading-relaxed"
                  style={{ color: "#d0d0d0" }}
                >
                  This serverless execution layer handles price verification,
                  calculates PnL synchronously, runs pool solvency reports, and
                  compiles Merkle roots of user actions — committing them
                  trustlessly onto the Sepolia blockchain.
                </p>
              </div>

              <div className="space-y-4">
                {workflows.map((wf, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{
                      x: 5,
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                    }}
                    className="flex items-start gap-4 p-4 rounded-lg transition-colors border border-transparent hover:border-white/10"
                    style={{ background: "rgba(255, 255, 255, 0.02)" }}
                  >
                    <div
                      className="w-10 h-10 rounded shrink-0 flex items-center justify-center mt-0.5"
                      style={{
                        background: `${wf.color}20`,
                        color: wf.color,
                      }}
                    >
                      {wf.icon}
                    </div>
                    <div>
                      <h4
                        className="text-sm font-bold mb-1"
                        style={{ color: "#ffffff" }}
                      >
                        {wf.title}
                      </h4>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: "#a0a0a0" }}
                      >
                        {wf.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
