import React, { useState } from "react";
import toast from "react-hot-toast";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ChevronDown, Droplets, ExternalLink, Flame, LogOut } from "lucide-react";
import { statsOf, useTapStore } from "./store";
import { CHAIN_ID, addressUrl, fmtUsdc, getExchange, short, txUrl } from "./lib/ec";
import { useBalances, useRefreshAfterTx, useSpot } from "./tap/hooks";
import { hasInjectedWallet, WALLET_HELP } from "./lib/wallet";

const fmtPx = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const Header: React.FC = () => {
  const asset = useTapStore((s) => s.asset);
  const taps = useTapStore((s) => s.taps);
  const stats = statsOf(taps);
  const spot = useSpot(asset);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { stt, usdc, refetch } = useBalances();
  const refreshAll = useRefreshAfterTx();
  const [open, setOpen] = useState(false);
  const [minting, setMinting] = useState(false);

  const faucet = async () => {
    setMinting(true);
    const id = toast.loading("Minting tUSDC…");
    try {
      const r = await getExchange().trader.faucet();
      toast.success(
        <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline">
          tUSDC minted ↗
        </a>,
        { id },
      );
      refreshAll();
      refetch();
    } catch (e) {
      toast.error(((e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "failed").split("\n")[0].slice(0, 120), { id });
    } finally {
      setMinting(false);
    }
  };

  const chip = "font-semibold px-2.5 py-1.5 flex items-center gap-1.5 text-xs rounded";
  const chipStyle = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" };

  return (
    <header
      className="h-14 flex items-center justify-between px-3 sm:px-4 xl:px-6 sticky top-0 z-40 gap-3"
      style={{ background: "rgba(22, 20, 42, 0.4)", backdropFilter: "blur(20px)", borderBottom: "2px solid rgba(255,255,255,0.05)", fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 xl:hidden">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black" style={{ background: "linear-gradient(135deg, #0847F7 0%, #002280 100%)", boxShadow: "0 2px 8px rgba(8,71,247,0.3)" }}>
            ⚡
          </div>
          <span className="hidden sm:block font-display font-bold text-lg tracking-tight">
            TapFlow<span style={{ color: "#0847F7" }}>.</span>
          </span>
        </div>
        <div className={chip} style={chipStyle}>
          {asset}/USD
        </div>
        <span className="text-sm xl:text-base font-bold font-mono flex items-center gap-1.5 min-w-0">
          <span className="truncate" style={{ color: "#2EBD85" }}>{spot ? `$${fmtPx(spot.price)}` : "—"}</span>
          <span className="flex h-1.5 w-1.5 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#2EBD85" }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#2EBD85" }} />
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {stats.streak > 0 ? (
          <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-amber" style={{ background: "rgba(245,165,36,0.12)", border: "1px solid rgba(245,165,36,0.3)" }}>
            <Flame size={12} /> {stats.streak}
          </span>
        ) : null}
        {stats.taps > 0 ? (
          <span className={`hidden sm:inline font-mono text-xs font-bold ${stats.pnl >= 0 ? "text-up" : "text-down"}`}>
            {stats.pnl >= 0 ? "+" : ""}
            {stats.pnl.toFixed(2)}
          </span>
        ) : null}
        {!isConnected ? (
          <button
            onClick={() => (hasInjectedWallet() ? connect({ connector: connectors[0] }) : toast(WALLET_HELP, { duration: 10000, icon: "🦊" }))}
            className="px-3 py-1.5 font-bold rounded bg-[#0847F7] text-white active:scale-95 transition-transform text-xs whitespace-nowrap"
          >
            CONNECT
          </button>
        ) : chainId !== CHAIN_ID ? (
          <button onClick={() => switchChain({ chainId: CHAIN_ID })} disabled={switching} className="px-3 py-1.5 font-bold rounded bg-[#f5a524] text-black active:scale-95 transition-transform text-[11px] whitespace-nowrap disabled:opacity-50">
            {switching ? "SWITCHING…" : "SWITCH TO SOMNIA"}
          </button>
        ) : (
          <div className="relative">
            {open ? <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} /> : null}
            <button onClick={() => setOpen((v) => !v)} className={`${chip} relative z-50 active:scale-95 transition-transform`} style={chipStyle}>
              <span className="hidden sm:inline text-bn-green font-mono">{usdc !== undefined ? fmtUsdc(usdc) : "…"} tUSDC</span>
              <span className="font-mono">{address ? short(address) : ""}</span>
              <ChevronDown size={13} />
            </button>
            {open ? (
              <div className="absolute right-0 mt-2 w-64 tf-card p-3 z-50 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-bn-text-muted">tUSDC</span>
                  <span className="font-mono text-bn-green">{usdc !== undefined ? fmtUsdc(usdc) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bn-text-muted">STT (gas)</span>
                  <span className="font-mono">{stt !== undefined ? (Number(stt) / 1e18).toFixed(3) : "—"}</span>
                </div>
                <button onClick={faucet} disabled={minting} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#0847F7] text-white font-bold disabled:opacity-50">
                  <Droplets size={13} /> {minting ? "Minting…" : "Get tUSDC (faucet)"}
                </button>
                <a href={address ? addressUrl(address) : "#"} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-1.5 rounded border border-white/10 text-bn-text-dim hover:text-white">
                  Explorer <ExternalLink size={12} />
                </a>
                <button onClick={() => { disconnect(); setOpen(false); }} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-bn-red hover:bg-white/5">
                  <LogOut size={13} /> Disconnect
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
};
