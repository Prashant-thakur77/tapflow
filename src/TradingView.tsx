import React, { useEffect, useState } from "react";
import { TradingGrid } from "./TradingGrid";
import { useGameStore } from "./store";
import { useAccount } from "wagmi";
import { useOrderControllerGetUserOrders } from "./services/queries";
import { HowItWorksModal } from "./HowItWorksModal";

const generateRandomAddress = () => {
  let address = "0x";
  for (let i = 0; i < 40; i++) {
    address += Math.floor(Math.random() * 16).toString(16);
  }
  return address;
};

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const truncateAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

export const TradingView: React.FC = () => {
  const ensureCells = useGameStore((state) => state.ensureCells);
  const tickTime = useGameStore((state) => state.tickTime);
  const setOpenBets = useGameStore((state) => state.setOpenBets);
  const { address } = useAccount();
  const [feedNotification, setFeedNotification] = useState<{
    id: number;
    user: string;
    amount: string;
  } | null>(null);

  const { data: openOrdersData } = useOrderControllerGetUserOrders(
    {
      limit: 100,
      offset: 0,
    },
    {
      query: {
        enabled: !!address,
        queryKey: ["open-orders", address],
      },
    },
  );

  useEffect(() => {
    if (openOrdersData && Array.isArray(openOrdersData)) {
      setOpenBets(openOrdersData);
    }
  }, [openOrdersData, setOpenBets]);

  useEffect(() => {
    // Generate initial grid and start simulation
    ensureCells();

    // Mock grid tick every 1000ms
    const tickInterval = setInterval(() => {
      tickTime();
    }, 1000);

    return () => {
      clearInterval(tickInterval);
    };
  }, [ensureCells, tickTime]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let isUnmounted = false;

    const pushFakeWinNotification = () => {
      if (isUnmounted) return;

      const user = generateRandomAddress();
      const amount = (Math.random() * 500 + 10).toFixed(2); // random amount between 10 and 510

      setFeedNotification({
        id: Date.now(),
        user,
        amount,
      });

      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isUnmounted) setFeedNotification(null);
      }, 4500);

      timer = setTimeout(pushFakeWinNotification, randomInt(2000, 13000));
    };

    timer = setTimeout(pushFakeWinNotification, randomInt(2000, 13000));

    return () => {
      isUnmounted = true;
      if (timer) clearTimeout(timer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col p-2 sm:p-4 md:p-6 relative overflow-hidden">
      <HowItWorksModal />
      {/* Ambient Purple Glow */}
      <div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(8, 71, 247,0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(8, 71, 247,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10 sci-card">
        {feedNotification ? (
          <div className="pointer-events-none absolute left-3 top-3 z-30 sm:left-4 sm:top-4">
            <div
              key={feedNotification.id}
              className="wallet-win-toast w-fit rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur-md ml-3 mt-3"
              style={{
                background: "rgba(11, 16, 28, 0.8)",
                borderColor: "rgba(46, 189, 133, 0.4)",
                boxShadow:
                  "0 4px 12px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(46, 189, 133, 0.1)",
              }}
            >
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded bg-bn-green/20 text-[12px] sm:text-[14px] leading-none border border-bn-green/30 shadow-[0_0_10px_rgba(46,189,133,0.2)]">
                  🚀
                </div>

                <span className="text-[13px] font-medium leading-none text-white/90 sm:text-[14px]">
                  {truncateAddress(feedNotification.user)}
                </span>

                <span className="rounded bg-bn-green/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-bn-green sm:text-[11px]">
                  WIN
                </span>

                <span className="text-[13px] font-bold leading-none text-bn-green sm:text-[14px]">
                  +${feedNotification.amount}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <TradingGrid />
      </div>
    </div>
  );
};
