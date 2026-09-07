import React, { useState } from "react";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Bot, Trophy, UserPlus, Zap } from "lucide-react";
import { short, txUrl } from "./lib/ec";
import { COPY, COPY_DEPLOYED } from "./lib/copy";
import type { Leader } from "./lib/api";
import { useAgentFeed, useFollow, useLeaderboard, useStats } from "./tap/useLeaderboard";
import { useFollowerCount } from "./tap/useCopy";
import { FollowModal } from "./tap/FollowModal";

/** Indexer count plus the on-chain MirrorVault count, when the contracts are deployed. */
const FollowerCell: React.FC<{ address: string; offchain: number }> = ({ address, offchain }) => {
  const { data } = useFollowerCount(COPY_DEPLOYED ? address : undefined);
  return (
    <span className="font-mono">
      {offchain}
      {data !== undefined ? (
        <span className="text-accent-soft" title="on-chain followers in MirrorVault">
          {" "}
          · ⛓{Number(data)}
        </span>
      ) : null}
    </span>
  );
};

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);
const ago = (ms: number) => {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
};

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="tf-card p-3 sm:p-4">
    <div className="text-[10px] uppercase tracking-[0.2em] text-bn-text-muted">{label}</div>
    <div className="font-mono font-extrabold text-xl sm:text-2xl tabular mt-0.5">{value}</div>
  </div>
);

export const LeadersView: React.FC = () => {
  const { address } = useAccount();
  const { data: stats } = useStats();
  const { data: leaders, isLoading, isError } = useLeaderboard(50);
  const { data: feed } = useAgentFeed(20);
  const followMut = useFollow();
  const [target, setTarget] = useState<Leader | null>(null);

  const onFollow = (leader: Leader) => {
    if (!address) {
      toast.error("Connect a wallet to follow");
      return;
    }
    if (COPY_DEPLOYED) {
      setTarget(leader);
      return;
    }
    followMut.mutate(
      { follower: address, leader: leader.address },
      {
        onSuccess: () => toast.success(`Following ${leader.label ?? short(leader.address)}`),
        onError: () => toast.error("Follow failed — is the indexer running?"),
      },
    );
  };

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Leaderboard</h1>
          <p className="text-xs text-bn-text-dim mt-1">
            Ranked by realized PnL on settled windows. Follow a tapper and their taps mirror into yours in the same block via Somnia reactivity.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="wallets" value={stats ? String(stats.wallets) : "—"} />
          <StatTile label="taps" value={stats ? String(stats.taps) : "—"} />
          <StatTile label="volume" value={stats ? `${Math.round(stats.volumeUsdc).toLocaleString()}` : "—"} />
          <StatTile label="windows" value={stats ? String(stats.windows) : "—"} />
        </div>

        {leaders?.some((l) => l.isAgent) ? (
          <section className="tf-card p-3 sm:p-4" style={{ borderColor: "rgba(138,166,249,0.35)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Bot size={15} className="text-accent-soft" />
              <h2 className="font-bold text-sm">Agent leaders</h2>
              <span className="text-[10px] text-bn-text-muted">strategies you can follow like any human</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {leaders
                .filter((l) => l.isAgent)
                .map((l) => (
                  <div key={l.address} className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(8,71,247,0.10)", border: "1px solid rgba(138,166,249,0.3)" }}>
                    <Link to={`/leader/${l.address}`} className="font-bold text-accent-soft hover:underline">
                      {l.label ?? short(l.address)}
                    </Link>
                    <span className="font-mono text-bn-text-dim">{l.taps} taps</span>
                    <span className="font-mono text-bn-text-dim">{l.wins}W · {l.losses}L</span>
                    <span className="font-mono text-accent-soft">⚡{l.copies ?? 0} copies</span>
                    <FollowerCell address={l.address} offchain={l.followers} />
                    {!(address && l.address.toLowerCase() === address.toLowerCase()) ? (
                      <button onClick={() => onFollow(l)} disabled={followMut.isPending} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-white font-bold disabled:opacity-50">
                        <UserPlus size={11} /> follow
                      </button>
                    ) : null}
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          {/* leaderboard */}
          <section className="tf-card p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={15} className="text-amber" />
              <h2 className="font-bold text-sm">Top tappers</h2>
            </div>
            {isError ? (
              <div className="text-xs text-bn-text-dim">
                Leaderboard offline. Start the indexer: <code className="text-accent-soft">cd indexer && npm start</code>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="tf-skeleton h-11 w-full" />
                ))}
              </div>
            ) : !leaders?.length ? (
              <div className="text-xs text-bn-text-dim">No settled taps yet. Be the first to build a record.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-bn-text-muted text-left">
                    <tr>
                      <th className="py-1.5 font-medium w-8">#</th>
                      <th className="font-medium">tapper</th>
                      <th className="font-medium text-right">win rate</th>
                      <th className="font-medium text-right">streak</th>
                      <th className="font-medium text-right">PnL</th>
                      <th className="font-medium text-right">followers</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaders.map((l, i) => {
                      const mine = address && l.address.toLowerCase() === address.toLowerCase();
                      return (
                        <tr key={l.address} className="border-t border-white/5 table-row-hover">
                          <td className="py-2 font-mono">{medal(i)}</td>
                          <td>
                            <Link to={`/leader/${l.address}`} className="flex items-center gap-1.5 hover:text-white font-mono">
                              {l.isAgent ? <Bot size={13} className="text-accent-soft" /> : null}
                              <span className={l.isAgent ? "text-accent-soft font-bold" : ""}>{l.label ?? short(l.address)}</span>
                              {mine ? <span className="text-[10px] text-bn-text-muted">(you)</span> : null}
                              {(l.copies ?? 0) > 0 ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent-soft" title="on-chain mirrors of this leader">⚡{l.copies} copies</span> : null}
                            </Link>
                          </td>
                          <td className="text-right font-mono">
                            {Math.round(l.winRate * 100)}%<span className="text-bn-text-muted"> ({l.wins}/{l.wins + l.losses})</span>
                          </td>
                          <td className="text-right font-mono">
                            {l.streak > 0 ? <span className="text-amber font-bold">🔥{l.streak}</span> : "—"}
                          </td>
                          <td className={`text-right font-mono font-bold ${l.pnlUsdc >= 0 ? "text-up" : "text-down"}`}>
                            {l.pnlUsdc >= 0 ? "+" : ""}
                            {l.pnlUsdc.toFixed(2)}
                          </td>
                          <td className="text-right">
                            <FollowerCell address={l.address} offchain={l.followers} />
                          </td>
                          <td className="text-right">
                            {!mine ? (
                              <button
                                onClick={() => onFollow(l)}
                                disabled={followMut.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-accent hover:text-white font-bold disabled:opacity-50"
                              >
                                <UserPlus size={11} /> follow
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[10px] text-bn-text-muted mt-3">
              {COPY_DEPLOYED ? (
                <>
                  Follow deposits a capped budget into <code>MirrorVault</code> ({short(COPY.vault)}); <code>CopyHandler</code> (reactivity sub #{COPY.subscription}) mirrors
                  the leader's taps into your order in the same block.
                </>
              ) : (
                <>Following registers your interest here; the on-chain mirror lights up once the copy contracts are deployed.</>
              )}
            </p>
          </section>
          <FollowModal
            leader={target}
            onClose={() => setTarget(null)}
            onFollowed={() => {
              if (address && target) followMut.mutate({ follower: address, leader: target.address });
            }}
          />

          {/* agent feed */}
          <section className="tf-card p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} className="text-up" />
              <h2 className="font-bold text-sm">TapBot feed</h2>
            </div>
            {!feed?.length ? (
              <div className="text-xs text-bn-text-dim">
                No agent activity yet. Run it: <code className="text-accent-soft">cd agent && npm start</code>
              </div>
            ) : (
              <div className="space-y-2">
                {feed.map((f) => (
                  <a
                    key={f.txHash + f.at}
                    href={txUrl(f.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="block border border-white/5 rounded-lg p-2 hover:border-white/15"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 font-bold">
                        <Bot size={11} className="text-accent-soft" />
                        {f.label ?? short(f.actor)}
                        <span className={f.side === "UP" ? "text-up" : "text-down"}>· {f.side}</span>
                      </span>
                      <span className="text-bn-text-muted">{ago(f.at)}</span>
                    </div>
                    <div className="text-[11px] text-bn-text-dim mt-1 leading-snug">{f.rationale}</div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
