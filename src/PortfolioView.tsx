import { EmptyState } from "./EmptyState";
import React, { useState } from "react";
import { useAccount } from "wagmi";
import { useQueries } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ExternalLink, Gift, Wallet } from "lucide-react";
import { claim, fmtCadence, fmtProb, fmtUsdc, getClient, getExchange, short, txUrl, windowPosition, type TapWindow } from "./lib/ec";
import { useBalances, useClaimable, useLiveWindows, useRefreshAfterTx } from "./tap/hooks";
import { useTapStore } from "./store";
import { CopyVaultCard } from "./tap/CopyVaultCard";

export const PortfolioView: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { stt, usdc } = useBalances();
  const { data: windows = [] } = useLiveWindows();
  const { data: claimable = [], refetch: refetchClaimable } = useClaimable();
  const taps = useTapStore((s) => s.taps);
  const refreshAll = useRefreshAfterTx();
  const [claiming, setClaiming] = useState<string | null>(null);

  const positions = useQueries({
    queries: windows.map((w: TapWindow) => ({
      queryKey: ["position", address, w.marketId],
      enabled: !!address,
      queryFn: () => windowPosition(getClient(), address!, w),
      refetchInterval: 8_000,
    })),
  });
  const open = windows
    .map((w, i) => ({ w, p: positions[i]?.data }))
    .filter((x) => x.p && (x.p.up > 0n || x.p.down > 0n));

  const onClaim = async (posId: string, idx: number) => {
    const pos = claimable[idx];
    setClaiming(posId);
    const id = toast.loading("Claiming…");
    try {
      const r = await claim(getExchange(), pos);
      toast.success(
        <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline">
          claimed +{fmtUsdc(pos.estPayout)} tUSDC ↗
        </a>,
        { id, duration: 8000 },
      );
      refreshAll();
      void refetchClaimable();
    } catch (e) {
      toast.error(((e as { shortMessage?: string }).shortMessage ?? (e as Error).message).split("\n")[0].slice(0, 120), { id });
    } finally {
      setClaiming(null);
    }
  };

  if (!isConnected) {
    return (
      <EmptyState
        icon={<Wallet size={26} />}
        title="No wallet connected"
        body="Positions, your copy vault and claimable winnings all live against an address. Connect one, or look around first — every page reads live from Somnia Shannon without a wallet."
        connect
        action={{ to: "/markets", label: "Browse markets" }}
      />
    );
  }

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="tf-card p-4">
            <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">tUSDC</div>
            <div className="font-mono text-2xl font-black text-bn-green">{usdc !== undefined ? fmtUsdc(usdc) : "—"}</div>
          </div>
          <div className="tf-card p-4">
            <div className="text-[10px] uppercase tracking-widest text-bn-text-muted">STT gas</div>
            <div className="font-mono text-2xl font-black">{stt !== undefined ? (Number(stt) / 1e18).toFixed(3) : "—"}</div>
          </div>
        </div>

        <CopyVaultCard />

        <section className="tf-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Gift size={15} className="text-[#8aa6f9]" /> Claimable winnings
            </h2>
            <span className="text-xs text-bn-text-muted">{claimable.length}</span>
          </div>
          {claimable.length === 0 ? (
            <div className="text-xs text-bn-text-dim">Nothing to claim yet. Settled windows you won show up here.</div>
          ) : (
            <div className="space-y-2">
              {claimable.map((c, i) => (
                <div key={`${c.marketId}-${c.outcomeIdx}`} className="flex items-center justify-between text-xs border border-white/5 rounded p-2">
                  <div>
                    <span className={c.outcomeIdx === 0 ? "text-bn-green font-bold" : "text-bn-red font-bold"}>{c.outcomeIdx === 0 ? "UP" : "DOWN"}</span>{" "}
                    <span className="text-bn-text-dim">{fmtUsdc(c.amount)} shares · {short(c.marketId, 6)} · {c.status}</span>
                  </div>
                  <button
                    disabled={claiming !== null}
                    onClick={() => onClaim(`${c.marketId}-${c.outcomeIdx}`, i)}
                    className="px-3 py-1 rounded bg-[#0847F7] text-white font-bold disabled:opacity-50"
                  >
                    {claiming === `${c.marketId}-${c.outcomeIdx}` ? "…" : `Claim +${fmtUsdc(c.estPayout)}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="tf-card p-4">
          <h2 className="font-bold text-sm mb-3">Open positions (live windows)</h2>
          {open.length === 0 ? (
            <div className="text-xs text-bn-text-dim">No shares in any open window. Go tap.</div>
          ) : (
            <div className="space-y-2">
              {open.map(({ w, p }) => (
                <div key={w.marketId} className="flex items-center justify-between text-xs border border-white/5 rounded p-2">
                  <span className="font-bold">
                    {w.asset} {fmtCadence(w.intervalSec)}
                  </span>
                  <span>
                    <span className="text-bn-green">Up {fmtUsdc(p!.up)}</span> · <span className="text-bn-red">Down {fmtUsdc(p!.down)}</span>
                  </span>
                  <span className="text-bn-text-muted">closes {new Date(w.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="tf-card p-4">
          <h2 className="font-bold text-sm mb-3">Your taps (this device)</h2>
          {taps.length === 0 ? (
            <div className="text-xs text-bn-text-dim">No taps yet.</div>
          ) : (
            <div className="space-y-1.5">
              {taps.slice(0, 30).map((t) => (
                <div key={t.hash} className="flex items-center justify-between text-xs">
                  <span className="text-bn-text-muted w-16">{new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-bold w-16">
                    {t.asset} {fmtCadence(t.intervalSec)}
                  </span>
                  <span className={`${t.side === "UP" ? "text-bn-green" : "text-bn-red"} font-bold w-12`}>{t.side}</span>
                  <span className="text-bn-text-dim flex-1">
                    {t.filled.toFixed(2)} @ {fmtProb(t.avgPrice)} for {t.paid.toFixed(2)}
                  </span>
                  <a href={txUrl(t.hash)} target="_blank" rel="noreferrer" className="text-[#8aa6f9] flex items-center gap-1">
                    tx <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
