import React from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { ONE, fmtProb, fmtUsdc, getClient, short, txUrl } from "./lib/ec";

/** On-chain fills for the connected wallet, straight from the indexer. */
export const HistoryView: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data, isLoading } = useQuery({
    queryKey: ["fills", address],
    enabled: !!address,
    queryFn: () => getClient().getUserFills(address!, { limit: 60 }),
    refetchInterval: 15_000,
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
      <div className="max-w-2xl mx-auto sci-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">On-chain fills</h2>
          <span className="text-xs text-bn-text-muted">{rows.length}</span>
        </div>
        {isLoading ? (
          <Loader2 className="animate-spin text-bn-text-muted" size={18} />
        ) : rows.length === 0 ? (
          <div className="text-xs text-bn-text-dim">No fills yet for {short(address!)}.</div>
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
