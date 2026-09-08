import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Bot, ExternalLink, Share2, UserPlus } from "lucide-react";
import { addressUrl, fmtCadence, short, txUrl } from "./lib/ec";
import { apiBase, getLeader, type Leader } from "./lib/api";
import { COPY_DEPLOYED } from "./lib/copy";
import { useFollowerCount } from "./tap/useCopy";
import { FollowModal } from "./tap/FollowModal";
import { useFollow } from "./tap/useLeaderboard";

interface TapRow {
  at: number;
  asset: string;
  intervalSec: number;
  marketId: string;
  side: "UP" | "DOWN";
  qty: number;
  price: number;
  txHash: string;
  result?: "win" | "loss" | "void";
  pnl?: number;
}

/** A tapper's public record: stats, on-chain followers, copies, recent taps, follow + share. */
export const LeaderView: React.FC = () => {
  const { address = "" } = useParams();
  const { address: me } = useAccount();
  const { data, isLoading, isError } = useQuery({ queryKey: ["tf-leader", address], queryFn: () => getLeader(address) as Promise<Leader & { recent: TapRow[]; copies?: number }>, enabled: /^0x[0-9a-fA-F]{40}$/.test(address), refetchInterval: 15_000, retry: 1 });
  const onchain = useFollowerCount(COPY_DEPLOYED ? address : undefined);
  const followMut = useFollow();
  const [open, setOpen] = useState(false);

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return <div className="flex-1 flex items-center justify-center text-bn-text-dim text-sm">Not an address.</div>;
  const name = data?.label ?? short(address);
  const share = `https://x.com/intent/tweet?text=${encodeURIComponent(`Following ${name} on TapFlow — their taps mirror into mine in the same block on @Somnia_Network × DreamDEX.\n${window.location.origin}/leader/${address}`)}`;

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="tf-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-bn-text-muted">{data?.isAgent ? "agent leader" : "tapper"}</div>
              <h1 className="font-display font-bold text-2xl flex items-center gap-2">
                {data?.isAgent ? <Bot size={20} className="text-accent-soft" /> : null}
                {name}
              </h1>
              <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-bn-text-muted hover:text-white flex items-center gap-1">
                {address} <ExternalLink size={10} />
              </a>
            </div>
            <div className="flex gap-2">
              <a href={share} target="_blank" rel="noreferrer" className="btn-outline px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5">
                <Share2 size={13} /> Share
              </a>
              {me && me.toLowerCase() !== address.toLowerCase() ? (
                <button
                  onClick={() => (COPY_DEPLOYED ? setOpen(true) : followMut.mutate({ follower: me, leader: address }))}
                  className="btn-primary px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <UserPlus size={13} /> Follow
                </button>
              ) : null}
            </div>
          </div>
          {data ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-center">
              {[
                ["PnL", `${data.pnlUsdc >= 0 ? "+" : ""}${data.pnlUsdc.toFixed(2)}`, data.pnlUsdc >= 0 ? "text-up" : "text-down"],
                ["win rate", `${Math.round(data.winRate * 100)}%`, ""],
                ["record", `${data.wins}W · ${data.losses}L`, ""],
                ["streak", data.streak ? `🔥${data.streak}` : "—", "text-amber"],
                ["followers", `${data.followers}${onchain.data !== undefined ? ` · ⛓${Number(onchain.data)}` : ""}`, ""],
                ["copies", String(data.copies ?? 0), "text-accent-soft"],
              ].map(([k, v, c]) => (
                <div key={k} className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
                  <div className="text-[9px] uppercase tracking-widest text-bn-text-muted">{k}</div>
                  <div className={`font-mono font-bold text-sm mt-0.5 ${c}`}>{v}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <section className="tf-card p-3 sm:p-4">
          <h2 className="font-bold text-sm mb-3">Recent taps</h2>
          {isError ? (
            <div className="text-xs text-bn-text-dim">No taps indexed for this address yet (or the indexer is offline). On-chain follows and mirrors still count.</div>
          ) : isLoading ? (
            <div className="tf-skeleton h-24" />
          ) : !data?.recent?.length ? (
            <div className="text-xs text-bn-text-dim">No taps indexed for this address yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-bn-text-muted text-left">
                  <tr>
                    <th className="py-1.5 font-medium">when</th>
                    <th className="font-medium">window</th>
                    <th className="font-medium">side</th>
                    <th className="font-medium">shares @ price</th>
                    <th className="font-medium">result</th>
                    <th className="font-medium">tx</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((t) => (
                    <tr key={t.txHash + t.side} className="border-t border-white/5 table-row-hover">
                      <td className="py-1.5 text-bn-text-muted">{new Date(t.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="font-bold">
                        {t.asset} {fmtCadence(t.intervalSec)}
                      </td>
                      <td className={`font-bold ${t.side === "UP" ? "text-up" : "text-down"}`}>{t.side}</td>
                      <td className="font-mono">
                        {t.qty.toFixed(2)} @ {Math.round(t.price * 100)}%
                      </td>
                      <td className={`font-mono font-bold ${t.result === "win" ? "text-up" : t.result === "loss" ? "text-down" : "text-bn-text-muted"}`}>
                        {t.result ? `${t.result} ${t.pnl !== undefined ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}` : ""}` : "open"}
                      </td>
                      <td>
                        <a href={txUrl(t.txHash)} target="_blank" rel="noreferrer" className="text-accent-soft flex items-center gap-1">
                          {short(t.txHash, 4)} <ExternalLink size={10} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="text-[11px] text-bn-text-muted">
          Share card: <a className="text-accent-soft" href={`${apiBase()}/api/og/leader/${address}`} target="_blank" rel="noreferrer">/api/og/leader/{short(address)}</a> · <Link to="/leaders" className="text-accent-soft">back to leaderboard</Link>
        </div>
        <FollowModal leader={open ? { address, label: data?.label } : null} onClose={() => setOpen(false)} onFollowed={() => me && followMut.mutate({ follower: me, leader: address })} />
      </div>
    </div>
  );
};
