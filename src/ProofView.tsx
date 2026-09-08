import React from "react";
import { useQuery } from "@tanstack/react-query";
import { SameBlockDiagram } from "./components/SameBlockDiagram";
import { useBalance, useReadContract } from "wagmi";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, Zap } from "lucide-react";
import { EXPLORER_URL, short } from "./lib/ec";
import { COPY, COPY_DEPLOYED, MIRROR_VAULT_ABI } from "./lib/copy";
import { apiBase, apiReady } from "./lib/api";

interface MirrorRow {
  block: number;
  reactiveTx: string;
  broadcastTx: string | null;
  sameBlock: boolean;
  follower: string;
  leader: string;
  side: "UP" | "DOWN";
  qty: number;
  cost: number | null;
  success: boolean;
  reason?: number | null;
  reasonText?: string | null;
}
interface Proof {
  broadcasts: number;
  mirrors: number;
  successful: number;
  sameBlock: number;
  followers: number;
  leaders: number;
  cursor: number;
  latest: MirrorRow[];
}

const COPY_HANDLER_ABI = [{ type: "function", name: "subscriptionId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const;

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="tf-card p-3 sm:p-4">
    <div className="text-[10px] uppercase tracking-[0.2em] text-bn-text-muted">{label}</div>
    <div className="font-mono font-extrabold text-xl sm:text-2xl tabular mt-0.5">{value}</div>
    {hint ? <div className="text-[10px] text-bn-text-muted mt-0.5">{hint}</div> : null}
  </div>
);

/** The reactivity proof, live: contracts, subscription, and every same-block mirror with both transactions. */
export const ProofView: React.FC = () => {
  const { data: proof, isError } = useQuery({ queryKey: ["tf-proof"], queryFn: async () => { await apiReady; return (await fetch(`${apiBase()}/api/proof`)).json() as Promise<Proof>; }, refetchInterval: 15_000, retry: 1 });
  const handlerBal = useBalance({ address: COPY.copyHandler, query: { enabled: COPY_DEPLOYED, refetchInterval: 30_000 } });
  const sub = useReadContract({ address: COPY.copyHandler, abi: COPY_HANDLER_ABI, functionName: "subscriptionId", query: { enabled: COPY_DEPLOYED } });
  const leaderFollowers = useReadContract({ address: COPY.vault, abi: MIRROR_VAULT_ABI, functionName: "followerCount", args: proof?.latest[0] ? [proof.latest[0].leader as `0x${string}`] : undefined, query: { enabled: COPY_DEPLOYED && !!proof?.latest[0] } });

  const pct = proof && proof.mirrors ? Math.round((proof.sameBlock / proof.mirrors) * 100) : null;

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        <div>
          <div className="label-tag inline-block mb-2">SOMNIA REACTIVITY · VERIFIED ON-CHAIN</div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">Same-block copy trading, live</h1>
          <p className="text-xs sm:text-sm text-bn-text-dim mt-2 max-w-2xl leading-relaxed">
            A leader broadcasts a tap through <code>Router</code>. Somnia validators deliver that event to <code>CopyHandler</code> as a synthetic
            transaction <b>in the same block</b>, and it places every follower's order through <code>MirrorVault</code>. No keeper, no relayer, no
            next-block lag. Every row below is read from chain by the indexer; every link opens the explorer. An amber row means the reactive call landed in the leader's block but the order did not, and the vault says
            why on chain: the leader's own order took the book at that price, the follower's max-loss cap refused it, or their budget ran out.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile label="reactive mirrors" value={proof ? proof.mirrors : "—"} hint={proof ? `${proof.successful} filled · ${proof.mirrors - proof.successful} placed nothing` : undefined} />
          <Tile label="same block" value={pct !== null ? `${pct}%` : "—"} hint={proof ? `${proof.sameBlock} of ${proof.mirrors}` : undefined} />
          <Tile label="leader broadcasts" value={proof ? proof.broadcasts : "—"} />
          <Tile label="handler gas tank" value={handlerBal.data ? `${(Number(handlerBal.data.value) / 1e18).toFixed(1)} STT` : "—"} hint={sub.data !== undefined ? `subscription #${String(sub.data)}` : COPY.subscription ? `subscription #${COPY.subscription}` : undefined} />
        </div>

        <section className="tf-card p-3 sm:p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Zap size={15} className="text-up" /> Latest mirrors
          </h2>
          {isError ? (
            <div className="text-xs text-bn-text-dim">Indexer offline. The contracts still work; start the indexer to see the tape.</div>
          ) : !proof ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="tf-skeleton h-10" />)}</div>
          ) : proof.latest.length === 0 ? (
            <div className="text-xs text-bn-text-dim">No mirrors indexed yet (cursor at block {proof.cursor}).</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-bn-text-muted text-left">
                  <tr>
                    <th className="py-1.5 font-medium">block</th>
                    <th className="font-medium">leader → follower</th>
                    <th className="font-medium">side · shares</th>
                    <th className="font-medium">escrow</th>
                    <th className="font-medium">broadcast tx</th>
                    <th className="font-medium">reactive tx</th>
                    <th className="font-medium">same block</th>
                  </tr>
                </thead>
                <tbody>
                  {proof.latest.map((m) => (
                    <tr key={m.reactiveTx + m.follower} className="border-t border-white/5 table-row-hover font-mono">
                      <td className="py-1.5">
                        <a href={`${EXPLORER_URL}/block/${m.block}`} target="_blank" rel="noreferrer" className="text-accent-soft hover:underline">
                          {m.block}
                        </a>
                      </td>
                      <td>
                        {short(m.leader, 3)} → {short(m.follower, 3)}
                      </td>
                      <td>
                        <span className={m.side === "UP" ? "text-up font-bold" : "text-down font-bold"}>{m.side}</span> {m.qty.toFixed(2)}
                      </td>
                      <td>{m.cost !== null ? `${m.cost.toFixed(2)} tUSDC` : "—"}</td>
                      <td>
                        {m.broadcastTx ? (
                          <a href={`${EXPLORER_URL}/tx/${m.broadcastTx}`} target="_blank" rel="noreferrer" className="text-accent-soft hover:underline flex items-center gap-1">
                            {short(m.broadcastTx, 4)} <ExternalLink size={10} />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <a href={`${EXPLORER_URL}/tx/${m.reactiveTx}`} target="_blank" rel="noreferrer" className="text-accent-soft hover:underline flex items-center gap-1">
                          {short(m.reactiveTx, 4)} <ExternalLink size={10} />
                        </a>
                      </td>
                      <td>
                        {m.sameBlock && m.success ? (
                          <span className="text-up flex items-center gap-1 font-bold">
                            <CheckCircle2 size={12} /> yes
                          </span>
                        ) : m.success ? (
                          <span className="text-amber">mirrored</span>
                        ) : (
                          <span
                            className="text-amber"
                            title={`The reactive call landed in the leader's block; the order did not. Reason from the contract: ${m.reasonText ?? "not recorded (pre-v4 handler)"}.`}
                          >
                            {m.reasonText && m.reasonText !== "filled" ? m.reasonText : "no fill"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tf-card p-3 sm:p-4">
          <SameBlockDiagram block={proof?.latest?.[0]?.block} />
        </section>

        <div className="grid sm:grid-cols-2 gap-3">
          <section className="tf-card p-4 text-xs leading-relaxed">
            <h2 className="font-bold text-sm mb-2">How it's wired</h2>
            <ol className="list-decimal pl-4 space-y-1 text-bn-text-dim">
              <li>
                Leader calls <code>Router.broadcast(marketId, pool, side, qty, price, expiry)</code> → emits <code>PositionOpened</code>.
              </li>
              <li>
                <code>CopyHandler</code> holds a reactivity subscription on that event (owner-funded, ≥32 STT at creation). The precompile at <code>0x0100</code> calls its <code>onEvent</code> in the same block.
              </li>
              <li>
                For each follower of that leader, <code>MirrorVault.mirror</code> sizes the order by ratio, checks the max-loss cap, and places an IOC on the DreamDEX pool from the follower's deposit.
              </li>
              <li>
                <code>RiskGuard</code> (second subscription) pauses a follower who hits their cap.
              </li>
            </ol>
            <div className="mt-3 font-mono text-[11px] space-y-1">
              {(["router", "vault", "copyHandler", "riskGuard"] as const).map((k) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-bn-text-muted">{k}</span>
                  <a href={`${EXPLORER_URL}/address/${COPY[k]}`} target="_blank" rel="noreferrer" className="text-accent-soft hover:underline">
                    {short(COPY[k], 6)}
                  </a>
                </div>
              ))}
              {leaderFollowers.data !== undefined ? (
                <div className="flex justify-between gap-2">
                  <span className="text-bn-text-muted">on-chain followers (latest leader)</span>
                  <span>{String(leaderFollowers.data)}</span>
                </div>
              ) : null}
            </div>
          </section>
          <section className="tf-card p-4 text-xs leading-relaxed">
            <h2 className="font-bold text-sm mb-2">Try it in two minutes</h2>
            <ol className="list-decimal pl-4 space-y-1 text-bn-text-dim">
              <li>
                Open <Link to="/leaders" className="text-accent-soft">Leaders</Link>, pick TapBot, press <b>follow</b>, deposit 5 tUSDC.
              </li>
              <li>Wait for TapBot's next tap (it broadcasts every fill), or tap yourself and press "Broadcast to followers".</li>
              <li>Watch this page: your mirror appears with the block number, and the explorer shows both transactions in it.</li>
            </ol>
            <Link to="/leaders" className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold mt-4">
              Follow a leader <Zap size={14} />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
};
