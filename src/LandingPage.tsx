import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  BarChart2,
  Globe,
  Lock,
} from "lucide-react";

/* ─────────────────────────── helpers ─────────────────────────── */

const features = [
  {
    icon: TrendingUp,
    title: "Real-time Trading",
    highlight: "Real-time",
    desc: "Predict price movements on live BTC/USD feeds powered by Chainlink Data Streams.",
  },
  {
    icon: Shield,
    title: "On-chain Security",
    highlight: "Security",
    desc: "Every deposit and withdrawal is trustlessly settled via audited smart contracts on Sepolia.",
  },
  {
    icon: Zap,
    title: "Instant Execution",
    highlight: "Instant",
    desc: "Sub-second order placement with real-time balance updates through our WebSocket engine.",
  },
  {
    icon: BarChart2,
    title: "Advanced Analytics",
    highlight: "Analytics",
    desc: "Full trade history, PnL tracking and visual dashboards to measure your edge.",
  },
  {
    icon: Globe,
    title: "Permissionless Access",
    highlight: "Permissionless",
    desc: "Connect any EVM wallet. No KYC, no accounts — just sign and trade.",
  },
  {
    icon: Lock,
    title: "Liquidity Pools",
    highlight: "Liquidity",
    desc: "Become an LP and earn yield from trader activity while backstopping the protocol.",
  },
];

const TICKER_ITEMS = [
  { label: "BTC/USD", value: "$84,231.20", change: "+2.34%", up: true },
  { label: "ETH/USD", value: "$3,241.80", change: "+1.12%", up: true },
  { label: "SOL/USD", value: "$142.50", change: "-0.87%", up: false },
  { label: "BNB/USD", value: "$412.30", change: "+0.55%", up: true },
  { label: "AVAX/USD", value: "$38.72", change: "-1.23%", up: false },
  { label: "LINK/USD", value: "$18.94", change: "+3.21%", up: true },
  { label: "MATIC/USD", value: "$0.892", change: "+0.43%", up: true },
  { label: "ARB/USD", value: "$1.234", change: "-0.65%", up: false },
];

/* ─────────────────────────── component ─────────────────────────── */

export const LandingPage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen text-white overflow-x-hidden relative"
      style={{ background: "#080A0C", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(circle, #0847F7 0%, transparent 70%)",
        }}
      />
      {/* ── Navigation ── */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300`}
        style={{
          background: scrolled ? "rgba(11,14,17,0.97)" : "rgba(11,14,17,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: scrolled
            ? "1px solid rgba(255, 255, 255, 0.05)"
            : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #0847F7 0%, #002280 100%)",
                boxShadow: "0 4px 12px rgba(8, 71, 247, 0.4)",
              }}
            >
              <img
                src="/tapl.png"
                alt="tapl"
                className="w-6 h-6 object-contain relative z-10"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-lg font-black tracking-tighter uppercase italic text-white">
              TAPL<span style={{ color: "#0847F7" }}>.</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div
            className="hidden md:flex items-center gap-6 text-sm font-medium"
            style={{ color: "#d0d0d0" }}
          >
            <a
              href="#features"
              className="hover:text-white transition-colors duration-150"
            >
              Features
            </a>
            <a
              href="#how"
              className="hover:text-white transition-colors duration-150"
            >
              How It Works
            </a>
            <a
              href="#stats"
              className="hover:text-white transition-colors duration-150"
            >
              Stats
            </a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="hidden md:flex items-center text-sm font-medium transition-colors duration-150"
              style={{ color: "#ffffff" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#0847F7")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#ffffff")
              }
            >
              Log In
            </Link>
            <Link
              to="/app"
              className="sci-btn sci-btn-primary group tracking-wide text-xs px-5 py-2"
              style={{ padding: "8px 16px" }}
            >
              <span className="sci-btn-corners" />
              Launch App{" "}
              <ArrowRight
                size={14}
                className="ml-1.5 group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Live Price Ticker ── */}
      <div
        className="fixed top-16 w-full z-40 overflow-hidden"
        style={{
          background: "rgba(22, 20, 42, 0.4)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <div
          ref={tickerRef}
          className="flex gap-0 whitespace-nowrap py-2"
          style={{ animation: "marquee 30s linear infinite" }}
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-3 px-8 text-xs"
            >
              <span className="font-semibold" style={{ color: "#ffffff" }}>
                {item.label}
              </span>
              <span
                className="font-mono font-medium"
                style={{ color: "#ffffff" }}
              >
                {item.value}
              </span>
              <span
                className="font-medium"
                style={{ color: item.up ? "#2EBD85" : "#F6465D" }}
              >
                {item.change}
              </span>
              <span style={{ color: "rgba(255, 255, 255, 0.05)" }}>|</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="relative z-10 pt-52 pb-24 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          {/* Eyebrow tag */}
          <div className="label-tag mb-7">
            Built on Web3 · Powered by Chainlink
          </div>

          {/* Headline */}
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1]"
            style={{ color: "#ffffff" }}
          >
            Trade BTC/USD with{" "}
            <span style={{ color: "#0847F7" }}>On-chain</span>
            <br />
            Price Precision
          </h1>

          <p
            className="text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "#d0d0d0" }}
          >
            Predict price movements on live BTC/USD feeds powered by Chainlink
            Data Streams. Deposit, bet, and withdraw with full on-chain
            transparency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-10">
            <Link
              to="/app"
              className="sci-btn sci-btn-primary group tracking-widest text-[14px]"
            >
              <span className="sci-btn-corners" />
              REGISTER
            </Link>
            <a
              href="#features"
              className="sci-btn sci-btn-outline group tracking-widest text-[14px]"
            >
              <span className="sci-btn-corners" />
              ABOUT US
            </a>
          </div>

          {/* Hero sub note */}
          <p className="mt-6 text-xs" style={{ color: "#a0a0a0" }}>
            Demo mode available — no wallet required to get started.
          </p>
        </motion.div>

        {/* Floating status badge */}
        <motion.div
          className="mt-14 animate-float flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div
            className="glass rounded px-6 py-3 flex items-center gap-5"
            style={{ border: "1px solid rgba(255, 255, 255, 0.05)" }}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: "#2EBD85" }}
              >
                LIVE
              </span>
            </div>
            <div
              className="w-px h-4"
              style={{ background: "rgba(255, 255, 255, 0.05)" }}
            />
            <span className="text-xs font-mono" style={{ color: "#d0d0d0" }}>
              BTC/USD · Real-time via Chainlink
            </span>
          </div>
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <section
        id="stats"
        className="relative z-10 py-16 px-6"
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          background: "rgba(22, 20, 42, 0.4)",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">
          {[
            { label: "Days on the market", val: "1839", color: "#0847F7" },
            { label: "Members", val: "5812", color: "#f6ad55" },
            { label: "Arbitrage pools", val: "$374 103", color: "#2ebd85" },
            { label: "Total paid", val: "$100 812", color: "#63b3ed" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="sci-card p-6 flex-1 text-center"
            >
              {/* Top Left Circle & Dots */}
              <div
                className="absolute top-4 left-4 w-[10px] h-[10px] rounded-full border-2"
                style={{
                  borderColor: item.color,
                  boxShadow: `0 0 10px ${item.color}`,
                }}
              />
              <div className="absolute top-9 left-[1.15rem] flex flex-col gap-[3px]">
                <div
                  className="w-[3px] h-[3px] rounded-full opacity-80"
                  style={{ background: item.color }}
                />
                <div
                  className="w-[3px] h-[3px] rounded-full opacity-50"
                  style={{ background: item.color }}
                />
                <div
                  className="w-[3px] h-[3px] rounded-full opacity-20"
                  style={{ background: item.color }}
                />
              </div>

              {/* Top Right Circle */}
              <div
                className="absolute top-4 right-4 w-[10px] h-[10px] rounded-full border-2"
                style={{
                  borderColor: item.color,
                  boxShadow: `0 0 10px ${item.color}`,
                }}
              />

              <div
                className="text-3xl font-bold text-white mt-1 mb-2 font-mono"
                style={{ textShadow: "0 0 15px rgba(255,255,255,0.2)" }}
              >
                {item.val}
              </div>
              <div className="text-xs text-[#a0a0a0]">{item.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="label-tag mb-5">Accessible for Everyone</div>
            <h2
              className="text-3xl md:text-5xl font-bold mb-5"
              style={{ color: "#ffffff" }}
            >
              Crypto Trading{" "}
              <span style={{ color: "#0847F7" }}>Made Accessible</span>
            </h2>
            <p
              className="max-w-xl mx-auto text-sm"
              style={{ color: "#d0d0d0" }}
            >
              Everything you need to trade smarter, safer, and faster — all
              powered by Chainlink oracle data.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="sci-card p-6 group"
                >
                  <div
                    className="absolute top-4 left-4 w-[10px] h-[10px] rounded-full border-2"
                    style={{
                      borderColor: "#0847F7",
                      boxShadow: "0 0 10px #0847F7",
                    }}
                  />
                  <div className="absolute top-9 left-[1.15rem] flex flex-col gap-[3px]">
                    <div
                      className="w-[3px] h-[3px] rounded-full opacity-80"
                      style={{ background: "#0847F7" }}
                    />
                    <div
                      className="w-[3px] h-[3px] rounded-full opacity-50"
                      style={{ background: "#0847F7" }}
                    />
                    <div
                      className="w-[3px] h-[3px] rounded-full opacity-20"
                      style={{ background: "#0847F7" }}
                    />
                  </div>
                  <div
                    className="absolute top-4 right-4 w-[10px] h-[10px] rounded-full border-2"
                    style={{
                      borderColor: "#0847F7",
                      boxShadow: "0 0 10px #0847F7",
                    }}
                  />

                  <div
                    className="w-12 h-12 rounded mt-3 mb-5 flex items-center justify-center bg-[#0847F7]/10"
                    style={{ border: "1px solid rgba(8, 71, 247, 0.2)" }}
                  >
                    <Icon size={24} style={{ color: "#0847F7" }} />
                  </div>
                  <h3
                    className="text-xl font-bold mb-2 ml-1"
                    style={{ color: "#ffffff" }}
                  >
                    {feat.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed ml-1"
                    style={{ color: "#a0a0a0" }}
                  >
                    {feat.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        id="how"
        className="relative z-10 py-24 px-6"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}
      >
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="label-tag mb-5">How It Works</div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-10"
              style={{ color: "#ffffff" }}
            >
              Start Trading in{" "}
              <span style={{ color: "#0847F7" }}>3 Simple</span> Steps
            </h2>

            <div className="space-y-6">
              {[
                {
                  step: "01",
                  title: "Connect Your Wallet",
                  desc: "Link any EVM-compatible wallet or start instantly with demo mode — no commitment required.",
                },
                {
                  step: "02",
                  title: "Deposit Tokens",
                  desc: "Deposit ERC-20 tokens into the Pool Reserve contract. Your balance is credited instantly.",
                },
                {
                  step: "03",
                  title: "Trade & Earn",
                  desc: "Predict BTC price direction on each candle. Win and grow your balance, then withdraw anytime.",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div
                    className="shrink-0 w-10 h-10 rounded flex items-center justify-center font-bold font-mono text-xs"
                    style={{
                      background: "rgba(8, 71, 247,0.06)",
                      border: "1px solid rgba(8, 71, 247,0.15)",
                      color: "#0847F7",
                    }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <h4
                      className="font-semibold mb-1 text-sm"
                      style={{ color: "#ffffff" }}
                    >
                      {item.title}
                    </h4>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#d0d0d0" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div
              className="rounded-lg p-6"
              style={{
                background: "rgba(22, 20, 42, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-6"
                style={{ color: "#0847F7" }}
              >
                Platform Stats · Live
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Active Traders", val: "2,400+" },
                  { label: "Bets Placed", val: "180K+" },
                  { label: "Avg Win Rate", val: "52.4%" },
                  { label: "Chainlink Feeds", val: "1" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="rounded pa-4 text-center"
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      padding: "18px 12px",
                    }}
                  >
                    <div
                      className="text-2xl font-bold font-mono mb-1"
                      style={{ color: "#0847F7" }}
                    >
                      {item.val}
                    </div>
                    <div
                      className="text-xs uppercase tracking-wider"
                      style={{ color: "#a0a0a0" }}
                    >
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              <p
                className="text-xs text-center mb-4"
                style={{ color: "#a0a0a0" }}
              >
                $49,232,300 contribution received
              </p>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  height: "4px",
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: "72%", background: "#0847F7" }}
                />
              </div>
              <div
                className="flex justify-between mt-2 text-xs"
                style={{ color: "#a0a0a0" }}
              >
                <span>72% funded</span>
                <span>Goal: $68M</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section
        className="relative z-10 py-24 px-6 text-center"
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          background: "rgba(22, 20, 42, 0.4)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <div className="label-tag mb-7">Start for Free</div>
          <h2
            className="text-3xl md:text-5xl font-bold mb-6 leading-tight"
            style={{ color: "#ffffff" }}
          >
            Ready to trade the{" "}
            <span style={{ color: "#0847F7" }}>smarter way</span>?
          </h2>
          <p className="mb-10 text-sm" style={{ color: "#d0d0d0" }}>
            Join thousands of traders experiencing the future of on-chain
            prediction markets. No sign-up. Just connect and trade.
          </p>
          <Link
            to="/app"
            className="sci-btn sci-btn-primary group tracking-widest text-[14px] mt-2"
          >
            <span className="sci-btn-corners" />
            GET STARTED FREE <ArrowRight size={15} className="ml-2" />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 py-10 px-6"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold" style={{ color: "#0847F7" }}>
              TAPL
            </span>
            <span className="text-xs" style={{ color: "#a0a0a0" }}>
              · Powered by Chainlink
            </span>
          </div>
          <div
            className="flex items-center gap-6 text-xs uppercase tracking-wider"
            style={{ color: "#a0a0a0" }}
          >
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how" className="hover:text-white transition-colors">
              How It Works
            </a>
            <Link to="/app" className="hover:text-white transition-colors">
              App
            </Link>
          </div>
          <div className="text-xs" style={{ color: "#a0a0a0" }}>
            © 2024 TAPL. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
