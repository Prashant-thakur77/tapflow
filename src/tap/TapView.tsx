import React, { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import toast from "react-hot-toast";
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
import { SessionControl } from "./SessionControl";
import { useSession } from "./useSession";
import { useBroadcast } from "./useCopy";
import { useTap } from "./useTap";
import { SettledStrip } from "./SettledStrip";
import { ProDrawer } from "./ProDrawer";
import { OddsChart } from "./OddsChart";
import { TopPositions } from "./TopPositions";
import { COPY_DEPLOYED } from "../lib/copy";
import type { TapWindow } from "../lib/ec";
import { HowItWorksModal } from "../HowItWorksModal";

const fmtPx = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function errText(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  if (/user rejected|denied/i.test(m)) return "Rejected in wallet";
  return m.split("\n")[0].slice(0, 140);
}

export const TapView: React.FC = () => {
  const { asset, intervalSec, stake, taps, setAsset, setIntervalSec, setStake } = useTapStore();
  const { window: w, windows, isLoading, rolling, error: windowsError } = useCurrentWindow(asset, intervalSec);
  const { left, pct } = useCountdown(w);
  const spot = useSpot(asset);
  const { data: opening } = useOpeningPrice(w);
  const quotes = useTapQuotes(w, stake);
  const { data: pos, refetch: refetchPos } = useWindowPosition(w);
  const { usdc, refetch: refetchBal } = useBalances();
  const refreshAll = useRefreshAfterTx();
  const { unseen, pending } = useSettlement();
  const { active: oneTap } = useSession();
  const stats = statsOf(taps);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { tap, busy: tapBusy } = useTap();
  const busy: Side | null = tapBusy && w && tapBusy.marketId === w.marketId ? tapBusy.side : null;
  const [lastTx, setLastTx] = useState<{ side: Side; hash: string; filled: bigint; avg: number; w: TapWindow; limitYesPrice: bigint; broadcast?: { hash: string; block: bigint | null } } | null>(null);
  const { broadcast, pending: broadcasting } = useBroadcast();

  const onBroadcast = async () => {
    if (!lastTx) return;
    const id = toast.loading("Broadcasting to followers…");
    try {
      const r = await broadcast(lastTx.w, lastTx.side, lastTx.filled, lastTx.limitYesPrice);
      setLastTx({ ...lastTx, broadcast: r });
      toast.success(
        <span>
          Broadcast landed{r.block !== null ? ` in block ${r.block}` : ""} — followers mirrored in the same block.{" "}
          <a href={`${EXPLORER_URL}/block/${r.block ?? ""}`} target="_blank" rel="noreferrer" className="underline text-accent-soft">
            block ↗
          </a>
        </span>,
        { id, duration: 9000 },
      );
    } catch (e) {
      toast.error(errText(e), { id });
    }
  };

  const available = cadences(windows, asset);
  // The short series only run during main trading hours. If the chosen cadence
  // has no live window but others do, fall back to the shortest one that does.
  const availableKey = available.join(",");
  useEffect(() => {
    if (available.length && !available.includes(intervalSec)) setIntervalSec(available[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey, intervalSec]);
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
    if (!w) return;
    const q = side === "UP" ? quotes.up : quotes.down;
    const r = await tap(w, side, stake, q);
    if (r && r.filled > 0n && q) setLastTx({ side, hash: r.hash, filled: r.filled, avg: r.avgPrice, w, limitYesPrice: q.limitYesPrice });
    void refetchPos();
    void refetchBal();
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
                label={w ? `${asset} · ${fmtCadence(w.intervalSec)}` : isLoading ? "loading" : rolling ? `${asset} · ${fmtCadence(intervalSec)}` : "no window"}
                tone={tone}
                sub={
                  locking && w
                    ? "locking…"
                    : w
                      ? `closes ${new Date(w.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : rolling
                        ? "next window opening…"
                        : undefined
                }
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
            <OddsChart w={w} liveUp={quotes.up?.impliedProb ?? null} />
            {w ? (
              <div className="mt-3 text-xs text-bn-text-dim text-center">
                Will {asset} settle{" "}
                <span className="text-white font-semibold">{openPx ? `above $${fmtPx(openPx)}` : "above its opening price"}</span> at{" "}
                {new Date(w.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}?
              </div>
            ) : null}
          </div>

          <SettledStrip asset={asset} intervalSec={w?.intervalSec ?? intervalSec} />

          <div className="hidden xl:flex xl:flex-col gap-3">
            <TopPositions w={w} me={address} />
            <LiveTape w={w} me={address} />
          </div>
        </div>

        {/* ── right column: the decision ── */}
        <div className="flex flex-col gap-3 min-w-0">
          {isConnected ? <SessionControl /> : null}

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
                <span className="font-mono flex items-center gap-1.5">
                  {oneTap ? <span className="text-up" title="one-tap on — no popups">⚡</span> : null}
                  {address ? short(address) : ""}
                </span>
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
              <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                <div className="flex items-center justify-between text-bn-text-dim">
                  <span>
                    last tap: <span className={lastTx.side === "UP" ? "text-up font-bold" : "text-down font-bold"}>{lastTx.side}</span> {fmtUsdc(lastTx.filled)} @ {fmtProb(lastTx.avg)}
                  </span>
                  <a href={txUrl(lastTx.hash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent-soft hover:underline font-mono">
                    {short(lastTx.hash, 5)} <ExternalLink size={12} />
                  </a>
                </div>
                {COPY_DEPLOYED && lastTx.filled > 0n ? (
                  lastTx.broadcast ? (
                    <a href={`${EXPLORER_URL}/block/${lastTx.broadcast.block ?? ""}`} target="_blank" rel="noreferrer" className="text-[11px] text-up font-bold flex items-center gap-1">
                      ⚡ broadcast · followers mirrored in block {String(lastTx.broadcast.block ?? "…")} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <button onClick={onBroadcast} disabled={broadcasting} className="self-start text-[11px] font-bold px-2.5 py-1 rounded-lg bg-accent/20 text-accent-soft hover:bg-accent hover:text-white disabled:opacity-50">
                      {broadcasting ? "broadcasting…" : "⚡ Broadcast to followers (same-block mirror)"}
                    </button>
                  )
                ) : null}
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

          {w ? <ProDrawer w={w} book={quotes.book} grid={quotes.grid} quote={quotes.up ?? quotes.down} side={quotes.up ? "UP" : "DOWN"} stake={stake} /> : null}

          <div className="xl:hidden flex flex-col gap-3">
            <TopPositions w={w} me={address} />
            <LiveTape w={w} me={address} />
          </div>
        </div>
      </div>
    </div>
  );
};
