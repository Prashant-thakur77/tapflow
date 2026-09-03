import React, { useState } from "react";
import { useAccount, useChainId, useConnect, useSwitchChain } from "wagmi";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { ExternalLink, Droplets } from "lucide-react";
import { STAKE_PRESETS, useTapStore } from "../store";
import {
  CHAIN_ID,
  EXPLORER_URL,
  ASSETS,
  cadences,
  fmtCadence,
  fmtProb,
  fmtUsdc,
  getExchange,
  placeTap,
  short,
  toRaw,
  txUrl,
  type Side,
} from "../lib/ec";
import { useBalances, useCountdown, useCurrentWindow, useOpeningPrice, useRefreshAfterTx, useSpot, useTapQuotes, useWindowPosition } from "./hooks";
import { WindowRing } from "./WindowRing";
import { TapButton } from "./TapButton";
import { HowItWorksModal } from "../HowItWorksModal";

const fmtPx = (n: number, decimals = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function errText(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  if (/user rejected|denied/i.test(m)) return "Rejected in wallet";
  return m.split("\n")[0].slice(0, 140);
}

export const TapView: React.FC = () => {
  const { asset, intervalSec, stake, setAsset, setIntervalSec, setStake, pushTap } = useTapStore();
  const { window: w, windows, isLoading, error: windowsError } = useCurrentWindow(asset, intervalSec);
  const { left, pct } = useCountdown(w);
  const spot = useSpot(asset);
  const { data: opening } = useOpeningPrice(w);
  const quotes = useTapQuotes(w, stake);
  const { data: pos, refetch: refetchPos } = useWindowPosition(w);
  const { usdc, refetch: refetchBal } = useBalances();
  const refreshAll = useRefreshAfterTx();

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<Side | null>(null);
  const [lastTx, setLastTx] = useState<{ side: Side; hash: string; filled: bigint; avg: number } | null>(null);

  const available = cadences(windows, asset);
  const feedDecimals = spot?.decimals ?? 2;
  const openPx = opening !== null && opening !== undefined ? opening / 10 ** feedDecimals : null;
  const spotPx = spot?.price ?? null;
  const move = openPx && spotPx ? (spotPx - openPx) / openPx : null;
  const tone: "up" | "down" | "flat" = move === null ? "flat" : move >= 0 ? "up" : "down";
  const locking = left < 5;
  const lowBalance = usdc !== undefined && usdc < toRaw(stake);

  const onTap = async (side: Side) => {
    if (!isConnected || !address) {
      connect({ connector: connectors[0] });
      return;
    }
    if (chainId !== CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: CHAIN_ID });
      } catch (e) {
        toast.error(errText(e));
      }
      return;
    }
    const q = side === "UP" ? quotes.up : quotes.down;
    if (!w || !q) return;
    setBusy(side);
    const id = toast.loading(`${side} · ${stake} tUSDC on ${asset} ${fmtCadence(w.intervalSec)}…`);
    try {
      const r = await placeTap(getExchange(), w, q);
      if (r.filled > 0n) {
        toast.success(
          <span>
            {side} filled: {fmtUsdc(r.filled)} shares @ {fmtProb(r.avgPrice)}{" "}
            <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline text-[#8aa6f9]">
              tx ↗
            </a>
          </span>,
          { id, duration: 8000 },
        );
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: [side === "UP" ? "#2ebd85" : "#f6465d", "#ffffff", "#0847F7"] });
        pushTap({
          at: Date.now(),
          asset,
          intervalSec: w.intervalSec,
          marketId: w.marketId,
          side,
          stake,
          filled: Number(r.filled) / 1e6,
          paid: Number(r.paid) / 1e6,
          avgPrice: r.avgPrice,
          hash: r.hash,
        });
        setLastTx({ side, hash: r.hash, filled: r.filled, avg: r.avgPrice });
      } else {
        toast(
          <span>
            Book moved, nothing filled.{" "}
            <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline">
              tx ↗
            </a>
          </span>,
          { id, icon: "↩" },
        );
      }
      refreshAll();
      void refetchPos();
      void refetchBal();
    } catch (e) {
      toast.error(errText(e), { id });
    } finally {
      setBusy(null);
    }
  };

  const faucet = async () => {
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
      void refetchBal();
    } catch (e) {
      toast.error(errText(e), { id });
    }
  };

  const segBtn = (active: boolean) =>
    `px-3 py-1.5 rounded text-xs font-bold transition-all ${active ? "bg-[#0847F7] text-white shadow-[0_0_12px_rgba(8,71,247,0.4)]" : "text-bn-text-dim hover:text-white hover:bg-white/5"}`;

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-4 md:p-6 relative overflow-hidden">
      <HowItWorksModal />
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none opacity-40" style={{ background: "radial-gradient(circle, rgba(8,71,247,0.08) 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-3 sm:gap-4">
        {/* asset + cadence */}
        <div className="sci-card p-2 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {ASSETS.map((a) => (
              <button key={a} className={segBtn(asset === a)} onClick={() => setAsset(a)}>
                {a}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(available.length ? available : [300, 900, 3600]).slice(0, 4).map((s) => (
              <button key={s} className={segBtn(intervalSec === s)} onClick={() => setIntervalSec(s)}>
                {fmtCadence(s)}
              </button>
            ))}
          </div>
        </div>

        {/* ring + price */}
        <div className="sci-card p-4 sm:p-5">
          <WindowRing
            left={left}
            pct={pct}
            label={w ? `${asset} ${fmtCadence(w.intervalSec)} window` : isLoading ? "loading" : "no window"}
            tone={tone}
            sub={locking && w ? "locking…" : w ? `closes ${new Date(w.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : undefined}
          />
          <div className="mt-3 flex items-end justify-center gap-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">{asset} now</div>
              <div className="font-mono text-xl sm:text-2xl font-black" style={{ color: tone === "up" ? "#2ebd85" : tone === "down" ? "#f6465d" : "#fff" }}>
                {spotPx ? `$${fmtPx(spotPx)}` : "—"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">opened at</div>
              <div className="font-mono text-base sm:text-lg font-bold text-bn-text-dim">{openPx ? `$${fmtPx(openPx)}` : "—"}</div>
            </div>
            {move !== null ? (
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">move</div>
                <div className={`font-mono text-base sm:text-lg font-bold ${move >= 0 ? "text-bn-green" : "text-bn-red"}`}>
                  {move >= 0 ? "▲" : "▼"} {(Math.abs(move) * 100).toFixed(3)}%
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* stake */}
        <div className="sci-card p-2 flex items-center justify-between">
          <span className="text-xs text-bn-text-muted pl-2 uppercase tracking-widest">stake</span>
          <div className="flex gap-1">
            {STAKE_PRESETS.map((n) => (
              <button key={n} className={segBtn(stake === n)} onClick={() => setStake(n)}>
                {n} tUSDC
              </button>
            ))}
          </div>
        </div>

        {/* tap */}
        <div className="flex gap-3">
          <TapButton side="UP" quote={quotes.up} busy={busy === "UP"} disabled={!w || locking || busy !== null} onTap={onTap} />
          <TapButton side="DOWN" quote={quotes.down} busy={busy === "DOWN"} disabled={!w || locking || busy !== null} onTap={onTap} />
        </div>

        {/* status strip */}
        <div className="sci-card p-3 text-xs flex flex-col gap-2">
          {!isConnected ? (
            <div className="text-bn-text-dim">Tap UP or DOWN to connect a wallet on Somnia Shannon.</div>
          ) : chainId !== CHAIN_ID ? (
            <div className="text-[#f5a524]">Wrong network. Tapping switches you to Somnia Shannon (50312).</div>
          ) : lowBalance ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#f5a524]">tUSDC balance {usdc !== undefined ? fmtUsdc(usdc) : "—"} is below your stake.</span>
              <button onClick={faucet} className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0847F7] text-white font-bold">
                <Droplets size={13} /> Faucet
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-bn-text-dim">
              <span>
                this window: <span className="text-bn-green font-semibold">Up {pos ? fmtUsdc(pos.up) : "0.00"}</span> ·{" "}
                <span className="text-bn-red font-semibold">Down {pos ? fmtUsdc(pos.down) : "0.00"}</span>
              </span>
              <span>{address ? short(address) : ""}</span>
            </div>
          )}
          {lastTx ? (
            <div className="flex items-center justify-between text-bn-text-dim border-t border-white/5 pt-2">
              <span>
                last tap: <span className={lastTx.side === "UP" ? "text-bn-green font-bold" : "text-bn-red font-bold"}>{lastTx.side}</span> {fmtUsdc(lastTx.filled)} shares @ {fmtProb(lastTx.avg)}
              </span>
              <a href={txUrl(lastTx.hash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#8aa6f9] hover:underline">
                {short(lastTx.hash, 5)} <ExternalLink size={12} />
              </a>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-[10px] text-bn-text-muted border-t border-white/5 pt-2">
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${quotes.source === "live" ? "bg-bn-green animate-pulse" : quotes.source === "poll" ? "bg-[#f5a524]" : "bg-white/20"}`} />
              book {quotes.source === "live" ? "live" : quotes.source === "poll" ? "polled (tail " + quotes.watch + ")" : "loading…"}
            </span>
            {w ? (
              <a href={`${EXPLORER_URL}/address/${w.pool}`} target="_blank" rel="noreferrer" className="hover:text-white font-mono">
                pool {short(w.pool)}
              </a>
            ) : null}
          </div>
          {windowsError ? <div className="text-bn-red break-all">Couldn't load windows: {errText(windowsError)}</div> : null}
        </div>
      </div>
    </div>
  );
};
