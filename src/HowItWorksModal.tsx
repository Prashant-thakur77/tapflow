import React from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Zap, Users, KeyRound, Coins } from "lucide-react";
import { useTapStore } from "./store";

const STEPS = [
  { Icon: Coins, title: "Pick a window", body: "BTC or ETH, 5 minutes to a day. Each window is a DreamDEX Event Contract: will the price close above where it opened?" },
  { Icon: Zap, title: "Tap UP or DOWN", body: "Your stake becomes an immediate-or-cancel order on the live order book. Every winning share pays 1 tUSDC. The number on the button is the book's implied probability." },
  { Icon: Users, title: "Follow the best", body: "Leaders' fills fire your mirrored order in the same block via Somnia on-chain reactivity. Coming up in this build." },
  { Icon: KeyRound, title: "Claim winnings", body: "When the window settles, redeem from Portfolio. Everything is a real transaction on Somnia Shannon — check the explorer links." },
];

export const HowItWorksModal: React.FC = () => {
  const seen = useTapStore((s) => s.seenHowItWorks);
  const setSeen = useTapStore((s) => s.setSeenHowItWorks);
  return (
    <Dialog open={!seen} onClose={() => setSeen(true)} className="relative z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="tf-card w-full max-w-md p-5 sm:p-6">
          <div className="label-tag inline-block mb-3">HOW TAPFLOW WORKS</div>
          <div className="space-y-3">
            {STEPS.map(({ Icon, title, body }, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: "rgba(8,71,247,0.15)", color: "#8aa6f9" }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{title}</div>
                  <div className="text-xs text-bn-text-dim leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setSeen(true)} className="btn-primary w-full mt-5 py-2.5 rounded font-bold text-sm">
            Start tapping
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
