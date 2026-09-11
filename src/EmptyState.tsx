import React from "react";
import { Link } from "react-router-dom";
import { useConnect } from "wagmi";
import toast from "react-hot-toast";
import { canConnectWallet, pickConnector, WALLET_HELP } from "./lib/wallet";

/**
 * What a page shows when it has nothing to show. A page that answers with one
 * grey sentence in the middle of an empty screen reads as broken; this says
 * what is missing, why, and what to press — and it never dead-ends, because
 * everything except signing works without a wallet.
 */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  body: string;
  connect?: boolean;
  action?: { to: string; label: string };
}> = ({ icon, title, body, connect, action }) => {
  const { connect: doConnect, connectors } = useConnect();
  const onConnect = () => {
    const c = canConnectWallet() ? pickConnector(connectors) : null;
    if (c) doConnect({ connector: c });
    else toast(WALLET_HELP, { duration: 10000, icon: "🦊" });
  };
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="tf-card max-w-sm w-full p-6 text-center flex flex-col items-center gap-3">
        {icon ? <div className="text-bn-text-muted">{icon}</div> : null}
        <div className="font-display text-lg font-bold">{title}</div>
        <p className="text-sm text-bn-text-dim leading-relaxed">{body}</p>
        <div className="flex items-center gap-2 mt-1">
          {connect ? (
            <button onClick={onConnect} className="px-3.5 py-2 rounded-lg bg-accent text-white font-bold text-xs active:scale-95 transition-transform">
              Connect wallet
            </button>
          ) : null}
          {action ? (
            <Link to={action.to} className="px-3.5 py-2 rounded-lg text-xs font-bold text-bn-text-dim border border-white/10 hover:text-white hover:border-white/25">
              {action.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
};
