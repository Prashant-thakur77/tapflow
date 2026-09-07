import React from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { ONE, fmtCadence, fmtProb, fmtUsdc, getClient, short, txUrl } from "./lib/ec";
import { getLeader } from "./lib/api";

/**
 * On-chain fills for the connected wallet. Primary source: the Somnia
 * indexer's user tape. It can lag by hours or time out, so the TapFlow
 * indexer's chain-scanned taps are shown underneath whenever the tape fails
 * or is empty.
 */
export const HistoryView: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["fills", address],
    enabled: !!address,
    queryFn: () => getClient().getUserFills(address!, { limit: 60 }),
    refetchInterval: 15_000,
    retry: 0,
  });
  const chain = useQuery({
    queryKey: ["tf-mytaps", address],
    enabled: !!address,
    queryFn: () => getLeader(address!) as Promise<{ recent: { at: number; asset: string; intervalSec: number; side: "UP" | "DOWN"; qty: number; price: number; txHash: string; result?: string; pnl?: number }[] }>,
    refetchInterval: 15_000,
    retry: 0,
  });

  if (!isConnected) return <div className="flex-1 flex items-center justify-center text-bn-text-dim text-sm">Connect a wallet to see your fills.</div>;

  const me = address!.toLowerCase();
  const rows = (data ?? []).map((f) => {
    const isTaker = f.taker?.toLowerCase() === me;
    const side = isTaker ? f.takerSide : f.makerSide;
    const up = side === "BUY_YES" || side === "SELL_YES";
    const buy = side === "BUY_YES" || side === "BUY_NO";
    const yesPx = Number(f.fillPrice) / Number(ONE);
    const ownPx = up ? yesPx : 1 - yesPx;
    return { f, up, buy, ownPx, isTaker };
  });

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6">
      <div className="max-w-2xl mx-auto tf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">On-chain fills</h2>
          <span className="text-xs text-bn-text-muted">{rows.length}</span>
        </div>
        {isLoading ? (
          <Loader2 className="animate-spin text-bn-text-muted" size={18} />
        ) : rows.length === 0 ? (
          <div className="text-xs text-bn-text-dim">
            {isError ? "The Somnia tape timed out. " : "No fills on the Somnia tape yet. "}
            {chain.data?.recent?.length ? (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest text-bn-text-muted mb-1.5">your taps, read from pool logs by the TapFlow indexer</div>
                <div className="space-y-1">
                  {chain.data.recent.map((t) => (
                    <div key={t.txHash + t.side} className="flex items-center justify-between font-mono">
                      <span className="text-bn-text-muted">{new Date(t.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="font-bold">{t.asset} {fmtCadence(t.intervalSec)}</span>
                      <span className={t.side === "UP" ? "text-up font-bold" : "text-down font-bold"}>{t.side}</span>
                      <span>{t.qty.toFixed(2)} @ {Math.round(t.price * 100)}%</span>
                      <span className={t.result === "win" ? "text-up" : t.result === "loss" ? "text-down" : "text-bn-text-muted"}>{t.result ?? "open"}</span>
                      <a href={txUrl(t.txHash)} target="_blank" rel="noreferrer" className="text-accent-soft flex items-center gap-1">
                        {short(t.txHash, 4)} <ExternalLink size={10} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              `Nothing for ${short(address!)} yet.`
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-bn-text-muted text-left">
                <tr>
                  <th className="py-1.5 font-medium">time</th>
                  <th className="font-medium">side</th>
                  <th className="font-medium">shares</th>
                  <th className="font-medium">price</th>
                  <th className="font-medium">market</th>
                  <th className="font-medium">tx</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ f, up, buy, ownPx, isTaker }) => (
                  <tr key={f.id} className="border-t border-white/5 table-row-hover">
                    <td className="py-1.5 text-bn-text-muted">{new Date(Number(f.timestamp) * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className={`font-bold ${up ? "text-bn-green" : "text-bn-red"}`}>
                      {buy ? "" : "sell "}
                      {up ? "UP" : "DOWN"} <span className="text-bn-text-muted font-normal">{isTaker ? "tap" : "maker"}</span>
                    </td>
                    <td className="font-mono">{fmtUsdc(BigInt(f.quantity))}</td>
                    <td className="font-mono">{fmtProb(ownPx)}</td>
                    <td className="text-bn-text-dim font-mono">{short(f.market, 5)}</td>
                    <td>
                      <a href={txUrl(f.txHash)} target="_blank" rel="noreferrer" className="text-[#8aa6f9] flex items-center gap-1">
                        {short(f.txHash, 4)} <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
