import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  MousePointer2,
  Rocket,
  X,
  ChevronRight,
  Check,
  ArrowDownToLine,
  ArrowUpFromLine,
  PiggyBank,
} from "lucide-react";

export const HowItWorksModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Small delay to make it feel more natural when loading
    const timer = setTimeout(() => {
      const hasSeenOnboarding = localStorage.getItem(
        "hasSeenTradingOnboarding",
      );
      if (!hasSeenOnboarding) {
        setIsOpen(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("hasSeenTradingOnboarding", "true");
    setIsOpen(false);
  };

  const steps = [
    {
      title: "Welcome to TAPL",
      description:
        "Experience the fastest grid-based trading game. Let's walk through how to play and win.",
      icon: <Rocket className="w-10 h-10 text-blue-500" />,
    },
    {
      title: "1. Connect & Login",
      description:
        "Start by connecting your wallet. Then, sign a message to authenticate securely with zero gas fees.",
      icon: <Wallet className="w-10 h-10 text-purple-500" />,
    },
    {
      title: "2. Deposit Tokens",
      description:
        "Deposit your on-chain tokens to receive an instant in-app balance. This powers lightning-fast gameplay without waiting for block confirmations.",
      icon: <ArrowDownToLine className="w-10 h-10 text-yellow-500" />,
    },
    {
      title: "3. Place Your Bet",
      description:
        "Use your in-app balance to place bets on any cell. Each cell represents a unique multiplier and winning odds.",
      icon: <MousePointer2 className="w-10 h-10 text-green-500" />,
    },
    {
      title: "4. Win & Withdraw!",
      description:
        "Winning bets are credited instantly to your in-app balance. You can withdraw your winnings back to on-chain tokens at any time.",
      icon: <ArrowUpFromLine className="w-10 h-10 text-red-500" />,
    },
    {
      title: "5. Provide Liquidity",
      description:
        "Prefer to be the house? You can provide token liquidity to the platform pool and earn a share of the protocol revenue.",
      icon: <PiggyBank className="w-10 h-10 text-pink-500" />,
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0B101C] shadow-2xl"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-600/20 blur-[80px]" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-purple-600/20 blur-[80px]" />

            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 z-10 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative p-6 sm:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`icon-${currentStep}`}
                  initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="mb-6 flex justify-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner backdrop-blur-md">
                    {steps[currentStep].icon}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="text-center min-h-[120px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`text-${currentStep}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h2 className="mb-2 text-2xl font-bold text-white">
                      {steps[currentStep].title}
                    </h2>
                    <p className="text-[15px] leading-relaxed text-white/70">
                      {steps[currentStep].description}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <div className="flex space-x-1.5">
                  {steps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === currentStep
                          ? "w-6 bg-blue-500"
                          : "w-1.5 bg-white/20"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center space-x-3">
                  {currentStep < steps.length - 1 ? (
                    <button
                      onClick={handleDismiss}
                      className="text-sm font-medium text-white/50 transition-colors hover:text-white px-2 py-2"
                    >
                      Skip
                    </button>
                  ) : null}

                  <button
                    onClick={nextStep}
                    className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-105 hover:bg-blue-500 active:scale-95"
                  >
                    <span className="relative z-10">
                      {currentStep === steps.length - 1
                        ? "Start Playing"
                        : "Next"}
                    </span>
                    {currentStep === steps.length - 1 ? (
                      <Check className="relative z-10 h-4 w-4" />
                    ) : (
                      <ChevronRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
