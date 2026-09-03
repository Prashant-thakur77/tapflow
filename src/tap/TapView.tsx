import React, { useState } from "react";
import { useAccount, useChainId, useConnect, useSwitchChain } from "wagmi";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { ExternalLink, Droplets, Flame } from "lucide-react";
import { STAKE_PRESETS, statsOf, useTapStore } from "../store";
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
import { useSettlement } from "./useSettlement";
import { WindowRing } from "./WindowRing";
import { TapButton } from "./TapButton";
import { PriceTape } from "./PriceTape";
import { OddsBar } from "./OddsBar";
import { LiveTape } from "./LiveTape";
import { ResultCard } from "./ResultCard";
import { TickNumber } from "./TickNumber";
import { HowItWorksModal } from "../HowItWorksModal";

const fmtPx = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function errText(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  if (/user rejected|denied/i.test(m)) return "Rejected in wallet";
  return m.split("\n")[0].slice(0, 140);
}

export const TapView: React.FC = () => {
  const { asset, intervalSec, stake, taps, setAsset, setIntervalSec, setStake, pushTap } = useTapStore();
  const { window: w, windows, isLoading, error: windowsError } = useCurrentWindow(asset, intervalSec);
  const { left, pct } = useCountdown(w);
  const spot = useSpot(asset);
  const { data: opening } = useOpeningPrice(w);
  const quotes = useTapQuotes(w, stake);
  const { data: pos, refetch: refetchPos } = useWindowPosition(w);
  const { usdc, refetch: refetchBal } = useBalances();
  const refreshAll = useRefreshAfterTx();
  const { unseen, pending } = useSettlement();
  const stats = statsOf(taps);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<Side | null>(null);
  const [lastTx, setLastTx] = useState<{ side: Side; hash: string; filled: bigint; avg: number } | null>(null);

  const available = cadences(windows, asset);
  const spotPx = spot?.price ?? null;
  // The opening answer is an integer in the oracle's own scale (2 dp today).
  // Pick the scale that lands nearest the live spot so a feed change can't
  // silently show $0.00 or a 10^16% move.
  const openPx = (() => {
    if (opening === null || opening === undefined || opening <= 0) return null;
    if (!spotPx) return opening / 100;
    const scales = [1e2, 1e6, 1e8, 1e18, 1];
    return opening / scales.reduce((best, s) => (Math.abs(opening / s - spotPx) < Math.abs(opening / best - spotPx) ? s : best), 1e2);
  })();
  const move = openPx && spotPx ? (spotPx - openPx) / openPx : null;
  const tone: "up" | "down" | "flat" = move === null ? "flat" : move >= 0 ? "up" : "down";
  const locking = !!w && left < 5;
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
            <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline text-accent-soft">
              tx ↗
            </a>
          </span>,
          { id, duration: 8000 },
        );
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.75 }, colors: [side === "UP" ? "#2ebd85" : "#f6465d", "#ffffff", "#0847F7"] });
        pushTap({
          at: Date.now(),
          asset,
          intervalSec: w.intervalSec,
          marketId: w.marketId,
          expiry: w.expiry,
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

  const disabled = !w || locking || busy !== null;

  // Dev-only design preview of the settlement card (?preview=win|loss|void).
  // Stripped from production builds; the real card is driven by useSettlement.
  const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("preview") : null;
  const previewTap =
    preview && w
      ? {
          at: 0,
          asset,
          intervalSec: w.intervalSec,
          marketId: w.marketId,
          expiry: w.expiry,
          side: "UP" as Side,
          stake: 5,
          filled: 6.41,
          paid: 4.86,
          avgPrice: 0.758,
          hash: "0x" + "ab".repeat(32),
          result: preview as "win" | "loss" | "void",
          payout: preview === "win" ? 6.41 : preview === "void" ? 3.2 : 0,
          pnl: preview === "win" ? 1.55 : preview === "void" ? -1.66 : -4.86,
        }
      : null;

  return (
    <div className="flex-1 flex flex-col relative">
      <HowItWorksModal />
      <ResultCard tap={previewTap ?? unseen} />

      <div className="relative z-10 w-full max-w-md xl:max-w-5xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-4 flex flex-col xl:grid xl:grid-cols-[1fr_380px] xl:gap-5 gap-3">
        {/* ── left column: the window ── */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="tf-seg">
              {ASSETS.map((a) => (
                <button key={a} data-on={asset === a} onClick={() => setAsset(a)}>
                  {a}
                </button>
              ))}
            </div>
            <div className="tf-seg">
              {(available.length ? available : [300, 900, 3600]).slice(0, 5).map((s) => (
                <button key={s} data-on={intervalSec === s} onClick={() => setIntervalSec(s)}>
                  {fmtCadence(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="tf-card p-4 sm:p-5">
            <div className="flex items-center gap-4 sm:gap-6">
              <WindowRing
                left={left}
                pct={pct}
                size={150}
                label={w ? `${asset} · ${fmtCadence(w.intervalSec)}` : isLoading ? "loading" : "no window"}
                tone={tone}
                sub={locking && w ? "locking…" : w ? `closes ${new Date(w.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : undefined}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.25em] text-bn-text-muted">{asset} now</div>
                <div className="font-mono font-extrabold text-3xl sm:text-4xl tabular leading-none mt-1 truncate" style={{ color: tone === "up" ? "#2ebd85" : tone === "down" ? "#f6465d" : "#fff" }}>
                  {spotPx ? <TickNumber value={spotPx} format={(n) => `$${fmtPx(n)}`} /> : <span className="tf-skeleton inline-block w-40 h-8 align-middle" />}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-bn-text-muted">open</div>
                    <div className="font-mono text-sm sm:text-base font-bold text-bn-text-dim tabular">{openPx ? `$${fmtPx(openPx)}` : <span className="tf-skeleton inline-block w-20 h-4 align-middle" />}</div>
                  </div>
                  {move !== null ? (
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-bn-text-muted">vs open</div>
                      <div className={`font-mono text-sm sm:text-base font-extrabold tabular ${move >= 0 ? "text-up" : "text-down"}`}>
                        {move >= 0 ? "▲" : "▼"} {(Math.abs(move) * 100).toFixed(3)}%
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <PriceTape asset={asset} open={openPx} />
            </div>
            <div className="mt-4">
              <OddsBar up={quotes.up?.impliedProb ?? null} down={quotes.down?.impliedProb ?? null} />
            </div>
          </div>

          <div className="hidden xl:block">
            <LiveTape w={w} me={address} />
          </div>
        </div>

        {/* ── right column: the decision ── */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="tf-card px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.25em] text-bn-text-muted">stake</span>
            <div className="tf-seg">
              {STAKE_PRESETS.map((n) => (
                <button key={n} data-on={stake === n} onClick={() => setStake(n)}>
                  {n} <span className="opacity-60">tUSDC</span>
                </button>
              ))}
            </div>
          </div>

          <div
            className="sticky bottom-[64px] xl:static z-20 flex gap-3 py-2 xl:py-0 -mx-3 px-3 sm:mx-0 sm:px-0"
            style={{ background: "linear-gradient(180deg, rgba(7,9,15,0) 0%, rgba(7,9,15,0.92) 25%)" }}
          >
            <TapButton side="UP" quote={quotes.up} stake={stake} busy={busy === "UP"} disabled={disabled} onTap={onTap} />
            <TapButton side="DOWN" quote={quotes.down} stake={stake} busy={busy === "DOWN"} disabled={disabled} onTap={onTap} />
          </div>

          <div className="tf-card p-3 text-xs flex flex-col gap-2">
            {!isConnected ? (
              <div className="text-bn-text-dim">Tap UP or DOWN to connect a wallet on Somnia Shannon.</div>
            ) : chainId !== CHAIN_ID ? (
              <div className="text-amber">Wrong network. Tapping switches you to Somnia Shannon (50312).</div>
            ) : lowBalance ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-amber">tUSDC balance {usdc !== undefined ? fmtUsdc(usdc) : "—"} is below your stake.</span>
                <button onClick={faucet} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-white font-bold">
                  <Droplets size={13} /> Faucet
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-bn-text-dim">
                <span>
                  this window: <span className="text-up font-bold">Up {pos ? fmtUsdc(pos.up) : "0.00"}</span> · <span className="text-down font-bold">Down {pos ? fmtUsdc(pos.down) : "0.00"}</span>
                </span>
                <span className="font-mono">{address ? short(address) : ""}</span>
              </div>
            )}
            {stats.taps > 0 ? (
              <div className="flex items-center justify-between text-bn-text-dim border-t border-white/5 pt-2">
                <span className="flex items-center gap-2">
                  {stats.streak > 0 ? (
                    <span className="flex items-center gap-1 text-amber font-bold">
                      <Flame size={12} /> {stats.streak}-streak
                    </span>
                  ) : null}
                  <span>
                    {stats.wins}W · {stats.losses}L
                  </span>
                  {pending.length ? <span className="text-bn-text-muted">· {pending.length} settling</span> : null}
                </span>
                <span className={`font-mono font-bold ${stats.pnl >= 0 ? "text-up" : "text-down"}`}>
                  {stats.pnl >= 0 ? "+" : ""}
                  {stats.pnl.toFixed(2)}
                </span>
              </div>
            ) : null}
            {lastTx ? (
              <div className="flex items-center justify-between text-bn-text-dim border-t border-white/5 pt-2">
                <span>
                  last tap: <span className={lastTx.side === "UP" ? "text-up font-bold" : "text-down font-bold"}>{lastTx.side}</span> {fmtUsdc(lastTx.filled)} @ {fmtProb(lastTx.avg)}
                </span>
                <a href={txUrl(lastTx.hash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent-soft hover:underline font-mono">
                  {short(lastTx.hash, 5)} <ExternalLink size={12} />
                </a>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-[10px] text-bn-text-muted border-t border-white/5 pt-2">
              <span className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${quotes.source === "live" ? "bg-up animate-pulse" : quotes.source === "poll" ? "bg-amber" : "bg-white/20"}`} />
                book {quotes.source === "live" ? "live" : quotes.source === "poll" ? `polled · tail ${quotes.watch}` : "loading…"}
              </span>
              {w ? (
                <a href={`${EXPLORER_URL}/address/${w.pool}`} target="_blank" rel="noreferrer" className="hover:text-white font-mono">
                  pool {short(w.pool)}
                </a>
              ) : null}
            </div>
            {windowsError ? <div className="text-down break-all">Couldn't load windows: {errText(windowsError)}</div> : null}
          </div>

          <div className="xl:hidden">
            <LiveTape w={w} me={address} />
          </div>
        </div>
      </div>
    </div>
  );
};
