import React, { useEffect, useRef, useState } from "react";
import { useGameStore, type CellData } from "./store";
import { format } from "date-fns";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import CryptoJS from "crypto-js";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export const TradingGrid: React.FC = () => {
  const cells = useGameStore((state) => state.cells);
  const history = useGameStore((state) => state.history);
  const basePrice = useGameStore((state) => state.basePrice);
  const currentPrice = useGameStore((state) => state.currentPrice);
  const modePriceStep = useGameStore((state) => state.modePriceStep);
  const modeIntervalSeconds = useGameStore(
    (state) => state.modeIntervalSeconds,
  );
  const placeBet = useGameStore((state) => state.placeBet);
  const bets = useGameStore((state) => state.bets);
  const pendingBets = useGameStore((state) => state.pendingBets);
  const pendingWins = useGameStore((state) => state.pendingWins);
  const socket = useGameStore((state) => state.socket);
  const wssKey = useGameStore((state) => state.wssKey);
  const betAmount = useGameStore((state) => state.betAmount);
  const balance = useGameStore((state) => state.balance);

  const { address: realAddress } = useAccount();
  const isDemoMode = useGameStore((state) => state.isDemoMode);
  const demoAddress = useGameStore((state) => state.demoAddress);
  const address = isDemoMode ? demoAddress : realAddress;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [cameraPrice, setCameraPrice] = useState(currentPrice);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [isSmallScreen, setIsSmallScreen] = useState(
    () => window.innerWidth < 1280,
  );

  const triggeredWinsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    cells.forEach((cell) => {
      const isHit = cell.status === "hit";
      const hasBet =
        (bets[cell.id] || 0) > 0 || (pendingBets[cell.id] || 0) > 0;
      if (isHit && hasBet) {
        if (!triggeredWinsRef.current.has(cell.id)) {
          triggeredWinsRef.current.add(cell.id);
          // Vegas style confetti
          const count = 200;
          const defaults = {
            origin: { y: 0.6 },
            zIndex: 10000,
            scalar: 0.5,
            ticks: 60,
          };
          function fire(particleRatio: number, opts: confetti.Options) {
            confetti(
              Object.assign({}, defaults, opts, {
                particleCount: Math.floor(count * particleRatio),
              }),
            );
          }
          fire(0.25, {
            spread: 26,
            startVelocity: 55,
            colors: ["#2ebd85", "#ffffff", "#eab308"],
          });
          fire(0.2, { spread: 60, colors: ["#2ebd85", "#ffffff", "#eab308"] });
          fire(0.35, {
            spread: 100,
            decay: 0.91,
            scalar: 0.4,
            colors: ["#2ebd85", "#ffffff", "#eab308"],
          });
          fire(0.1, {
            spread: 120,
            startVelocity: 25,
            decay: 0.92,
            scalar: 0.6,
            colors: ["#2ebd85", "#ffffff", "#eab308"],
          });
          fire(0.1, {
            spread: 120,
            startVelocity: 45,
            colors: ["#2ebd85", "#ffffff", "#eab308"],
          });
        }
      }
    });
  }, [cells, bets, pendingBets]);

  // Animation loop for perfect smooth scrolling
  useEffect(() => {
    let frameId: number;
    let lastRenderTime = 0;

    // Use a mutable variable for smooth interpolation to avoid dependencies and stale state
    let currentCameraPrice = useGameStore.getState().currentPrice;

    const loop = () => {
      const n = Date.now();
      const target = useGameStore.getState().currentPrice;

      if (currentCameraPrice === 0 && target !== 0) {
        currentCameraPrice = target;
      } else {
        currentCameraPrice += (target - currentCameraPrice) * 0.1; // Smooth camera tracking, snappier follow
      }

      // Throttle React renders to ~60fps (15ms) down from 30fps to make UI buttery smooth
      if (n - lastRenderTime > 15) {
        const state = useGameStore.getState();
        const serverSyncTime = n + state.serverTimeOffset;
        setNow(serverSyncTime);
        setCameraPrice(currentCameraPrice);
        lastRenderTime = n;

        // Check if chart hit grid for remote wins
        if (Object.keys(state.pendingWins).length > 0) {
          state.checkWinEffects(serverSyncTime);
        }
      }

      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handlePlaceBet = (cell: CellData, canBet: boolean) => {
    try {
      if (cell.timeWindowStart > now && cell.timeWindowStart - now <= 5000) {
        const hasBet = bets[cell.id] || pendingBets[cell.id];
        if (!hasBet) {
          toast("Cell closing soon. Select another!", {
            icon: "⏳",
            style: {
              background: "rgba(18, 20, 30, 0.95)",
              color: "#f6465d",
              border: "1px solid rgba(246, 70, 93, 0.5)",
              boxShadow:
                "0 4px 20px rgba(246, 70, 93, 0.25), inset 0 0 10px rgba(246, 70, 93, 0.1)",
              backdropFilter: "blur(8px)",
              fontWeight: "bold",
              fontSize: "13px",
              padding: "12px 16px",
              borderRadius: "8px",
              letterSpacing: "0.02em",
            },
          });
          return;
        }
      }
      if (canBet) {
        if (!localStorage.getItem("token")) {
          toast("Connect wallet & login to trade!", {
            icon: "🔐",
            style: {
              background: "rgba(18, 20, 30, 0.95)",
              color: "#ffffff",
              border: "1px solid rgba(8, 71, 247, 0.5)",
              boxShadow:
                "0 4px 20px rgba(8, 71, 247, 0.25), inset 0 0 10px rgba(8, 71, 247, 0.1)",
              backdropFilter: "blur(8px)",
              fontWeight: "bold",
              fontSize: "13px",
              padding: "12px 16px",
              borderRadius: "8px",
              letterSpacing: "0.02em",
            },
          });
          return;
        }
        if (!betAmount || betAmount <= 0) {
          toast("Invalid bet amount!", {
            icon: "⚠️",
            style: {
              background: "rgba(18, 20, 30, 0.95)",
              color: "#eab308",
              border: "1px solid rgba(234, 179, 8, 0.5)",
              boxShadow:
                "0 4px 20px rgba(234, 179, 8, 0.25), inset 0 0 10px rgba(234, 179, 8, 0.1)",
              backdropFilter: "blur(8px)",
              fontWeight: "bold",
              fontSize: "13px",
              padding: "12px 16px",
              borderRadius: "8px",
              letterSpacing: "0.02em",
            },
          });
          return;
        }

        if (betAmount > balance) {
          toast("Insufficient balance!", {
            icon: "💸",
            style: {
              background: "rgba(18, 20, 30, 0.95)",
              color: "#f6465d",
              border: "1px solid rgba(246, 70, 93, 0.5)",
              boxShadow:
                "0 4px 20px rgba(246, 70, 93, 0.25), inset 0 0 10px rgba(246, 70, 93, 0.1)",
              backdropFilter: "blur(8px)",
              fontWeight: "bold",
              fontSize: "13px",
              padding: "12px 16px",
              borderRadius: "8px",
              letterSpacing: "0.02em",
            },
          });
          return;
        }

        if (socket && wssKey) {
          const amountStr = betAmount.toString();
          const cellOrigin = cell.original;
          const cellId = `${cellOrigin.startTs}:${cellOrigin.endTs}:${cellOrigin.lowerPrice}:${cellOrigin.upperPrice}`;
          const message = `${cellOrigin.gridTs}:${cellId}:${amountStr}`;

          const hmac = CryptoJS.algo.HMAC.create(
            CryptoJS.algo.SHA256,
            CryptoJS.enc.Hex.parse(wssKey),
          );
          hmac.update(message);
          const signature = hmac.finalize().toString(CryptoJS.enc.Hex);

          const payload = {
            userId: address,
            marketId: "BTCUSDT",
            amount: amountStr,
            cell: cellOrigin,
            userSignature: signature,
          };

          socket.emit("place_bet", payload);
        }
        placeBet(cell.id, betAmount);
      }
    } catch (error) {
      console.log("handlePlaceBet() error: ", error);
    }
  };

  // Container dimensions + mobile detection
  useEffect(() => {
    if (!containerRef.current) return;

    let frameId: number;
    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        setDimensions((prev) =>
          prev.width !== w || prev.height !== h
            ? { width: w, height: h }
            : prev,
        );
      } else {
        frameId = requestAnimationFrame(updateSize);
      }
      setIsMobile(window.innerWidth < 640);
      setIsSmallScreen(window.innerWidth < 1280);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      cancelAnimationFrame(frameId);
    };
  }, [cells.length]);

  if (cells.length === 0) return null;

  // Time & Price Span — current line sits ~36% from left, rest is bettable future
  // Mobile (<640px):  ~10s past history + 25s future (5 cols)
  // Tablet (<1280px): ~15s past history + 35s future (7 cols to exact match backend data)
  // Desktop:          ~20s past history + 35s future (7 cols to exact match backend data)
  const pastSpanMs = isMobile ? 10000 : isSmallScreen ? 15000 : 20000;
  const futureSpanMs = isMobile ? 25000 : 35000;
  const timeSpanMs = pastSpanMs + futureSpanMs;

  const firstTime = now - pastSpanMs;
  const lastTime = now + futureSpanMs;

  const priceSpan = 9; // 9 rows (-4 to 4) matches backend data
  const maxPrice = cameraPrice + 4.5 * modePriceStep;
  const minPrice = cameraPrice - 4.5 * modePriceStep;
  const totalPriceSpan = maxPrice - minPrice;

  // Horizontal price levels
  const priceLevels: number[] = [];
  const startLevelIdx = Math.floor((minPrice - basePrice) / modePriceStep) - 1;
  const endLevelIdx = Math.ceil((maxPrice - basePrice) / modePriceStep) + 1;
  for (let i = startLevelIdx; i <= endLevelIdx; i++) {
    priceLevels.push(basePrice + i * modePriceStep);
  }

  // Percentage Helpers
  const getTimeX = (t: number) => ((t - firstTime) / timeSpanMs) * 100;
  const getPriceY = (p: number) => ((maxPrice - p) / totalPriceSpan) * 100;

  const rowHeight = 100 / priceSpan;
  const colWidth = ((modeIntervalSeconds * 1000) / timeSpanMs) * 100;

  // SVG Chart Path
  const getSvgPath = () => {
    if (history.length === 0) return "";
    return history
      .map((pt, i) => {
        const x = (getTimeX(pt.time) * dimensions.width) / 100;
        const y = (getPriceY(pt.price) * dimensions.height) / 100;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const lPt =
    history.length > 0
      ? {
          x:
            (getTimeX(history[history.length - 1].time) * dimensions.width) /
            100,
          y:
            (getPriceY(history[history.length - 1].price) * dimensions.height) /
            100,
        }
      : null;

  // Time labels interval
  const timeLabels = [];
  const labelInterval = 15000; // every 15s
  let tLabel = Math.floor(firstTime / labelInterval) * labelInterval;
  while (tLabel <= lastTime + labelInterval) {
    if (tLabel >= firstTime && tLabel <= lastTime) timeLabels.push(tLabel);
    tLabel += labelInterval;
  }

  return (
    <div className="flex-1 flex flex-col p-2 sm:p-3 lg:p-4 relative overflow-hidden font-mono">
      {/* Dynamic Price Y-Axis (Right side) */}
      <div className="absolute right-0 top-2 sm:top-3 lg:top-4 bottom-2 sm:bottom-3 lg:bottom-4 w-10 sm:w-14 pointer-events-none z-10">
        {priceLevels.map((p) => {
          const top = getPriceY(p);
          if (top < -10 || top > 110) return null;
          return (
            <div
              key={`y_${p}`}
              className="absolute w-full text-[8px] sm:text-[9px] pointer-events-none font-bold"
              style={{
                top: `${top}%`,
                right: 0,
                transform: "translateY(-50%)",
                color: "#d0d0d0",
              }}
            >
              <span
                className="absolute right-1"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              >
                ${p.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden mr-10 sm:mr-14"
        style={{
          background: "#080A0C",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "4px",
        }}
      >
        {/* Horizontal Grid lines */}
        {priceLevels.map((p) => {
          const lineTop = getPriceY(p);
          if (lineTop < -10 || lineTop > 110) return null;
          return (
            <div
              key={`hx_${p}`}
              className="absolute w-full h-px"
              style={{
                top: `${lineTop}%`,
                background: "rgba(255, 255, 255, 0.05)",
              }}
            />
          );
        })}

        {/* Vertical Grid lines (15s intervals) */}
        {timeLabels.map((t) => (
          <div
            key={`vx_${t}`}
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${getTimeX(t)}%`,
              background: "rgba(255, 255, 255, 0.05)",
            }}
          />
        ))}

        {/* Current Time Indicator Line */}
        <div
          className="absolute top-0 bottom-0 w-px z-20"
          style={{
            left: `${getTimeX(now)}%`,
            background: "rgba(8, 71, 247, 0.4)",
          }}
        />

        {/* Main Grid Cells */}
        {(() => {
          return cells.map((cell) => {
            // Optimization: skip rendering cells fully out of viewport
            if (
              cell.timeWindowEnd < firstTime ||
              cell.timeWindowStart > lastTime
            )
              return null;

            const isPast = now >= cell.timeWindowEnd;
            const isHit = cell.status === "hit";
            const betAmountVal = bets[cell.id] || 0;
            const pendingBetAmountVal = pendingBets[cell.id] || 0;
            const hasBet = betAmountVal > 0;
            const isPending = pendingBetAmountVal > 0;
            const hasAnyBet = hasBet || isPending;
            const displayBetAmount = hasBet
              ? betAmountVal
              : pendingBetAmountVal;

            // Khi chart chạm đến cột (tiến vào thời gian của cell) -> Ẩn toàn bộ ô không cược
            if (now >= cell.timeWindowStart && !hasAnyBet) return null;

            // Sau khi chart đi qua cell (quá khứ) -> Ẩn ô đã cược nếu không trúng VÀ không có pending win
            const hasPendingWin = pendingWins[cell.id] !== undefined;
            if (isPast && !isHit && !hasPendingWin) return null;

            const left = getTimeX(cell.timeWindowStart);
            const top = getPriceY(cell.priceLevel + modePriceStep / 2);
            const isFuture = cell.timeWindowStart > now;

            const intervalMs = 5000;
            const isNext = isFuture && cell.timeWindowStart - now <= intervalMs;
            const canBet = isFuture && !isNext && !hasAnyBet;

            return (
              <motion.div
                whileHover={
                  canBet && !hasAnyBet
                    ? { scale: 0.95, backgroundColor: "rgba(255,255,255,0.1)" }
                    : {}
                }
                whileTap={canBet && !hasAnyBet ? { scale: 0.9 } : {}}
                key={cell.id}
                className={cn(
                  "absolute border-t border-l flex flex-col items-center justify-center text-[10px] transition duration-300",
                  canBet && !hasAnyBet && "hover:bg-white/5 cursor-pointer",
                  isNext &&
                    !hasAnyBet &&
                    "opacity-30 cursor-not-allowed animate-pulse",
                  !isPast && hasAnyBet && "cursor-pointer z-10",
                  !isPast && isPending && "animate-pulse",
                  isHit && hasAnyBet && "z-20",
                )}
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${colWidth}%`,
                  height: `${rowHeight}%`,
                  borderColor: "rgba(255, 255, 255, 0.05)",
                  background:
                    isHit && hasAnyBet
                      ? "rgba(46,189,133,0.35)"
                      : !isPast && hasAnyBet
                        ? "linear-gradient(180deg, rgba(22, 40, 81, 0.25) 0%, rgba(9, 22, 53, 0.35) 100%)"
                        : isNext && !hasAnyBet
                          ? "rgba(246,70,93,0.06)"
                          : undefined,
                  boxShadow:
                    isHit && hasAnyBet
                      ? "0 0 20px rgba(46,189,133,0.5), inset 0 0 30px rgba(46,189,133,0.35)"
                      : !isPast && hasAnyBet
                        ? "0 0 15px rgba(50, 110, 255, 0.3), inset 0 0 30px rgba(50, 110, 255, 0.3)"
                        : undefined,
                  outline:
                    isHit && hasAnyBet
                      ? "1px solid #2EBD85"
                      : !isPast && hasAnyBet
                        ? "1px solid #0847F7"
                        : undefined,
                }}
                onClick={() => handlePlaceBet(cell, canBet)}
              >
                <div
                  className={cn(
                    "transition-all duration-300 text-[9px] sm:text-[10px] font-mono",
                    cell.multiplier >= 100
                      ? "font-bold"
                      : cell.multiplier >= 10
                        ? "font-semibold"
                        : "",
                  )}
                  style={{
                    color:
                      hasAnyBet && !isHit
                        ? "#0847F7"
                        : isHit && hasAnyBet
                          ? "#2EBD85"
                          : isNext && !hasAnyBet
                            ? "#F6465D"
                            : cell.multiplier >= 100
                              ? "#F6465D"
                              : cell.multiplier >= 10
                                ? "#0847F7"
                                : "#d0d0d0",
                    textShadow:
                      isHit && hasAnyBet
                        ? "0 0 8px rgba(46,189,133,1)"
                        : hasAnyBet
                          ? "0 0 5px rgba(8, 71, 247, 0.8)"
                          : undefined,
                    transform: hasAnyBet || isHit ? "scale(1.1)" : undefined,
                  }}
                >
                  {hasAnyBet
                    ? cell.multiplier.toFixed(2)
                    : Number(cell.original.rewardRate).toFixed(2)}
                  x
                </div>
                {hasAnyBet && !isHit && (
                  <div
                    className={cn(
                      "text-[9px] sm:text-[10px] mt-0.5 sm:mt-1 font-bold px-1.5 sm:px-2 py-0.5 shadow-md",
                      isPending ? "opacity-80 animate-pulse" : "",
                    )}
                    style={{
                      borderRadius: "6px",
                      background: "#0847F7",
                      color: "#ffffff",
                      boxShadow: "0 0 8px rgba(8, 71, 247, 0.5)",
                    }}
                  >
                    ${displayBetAmount}
                  </div>
                )}
                {isHit &&
                  hasAnyBet &&
                  (() => {
                    const winPayout =
                      displayBetAmount *
                      (cell.multiplier && !isNaN(cell.multiplier)
                        ? cell.multiplier
                        : 0);
                    return (
                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                        <div
                          className="text-[8px] sm:text-[9px] font-black tracking-widest animate-pulse"
                          style={{
                            color: "#2EBD85",
                            textShadow:
                              "0 0 8px #2EBD85, 0 0 16px rgba(46,189,133,0.6)",
                            letterSpacing: "0.15em",
                          }}
                        >
                          WIN!
                        </div>
                        <div
                          className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 shadow-md animate-bounce"
                          style={{
                            borderRadius: "6px",
                            background: "#2EBD85",
                            color: "#ffffff",
                            boxShadow:
                              "0 0 12px #2EBD85, 0 0 24px rgba(46,189,133,0.4)",
                          }}
                        >
                          +$
                          {winPayout > 0
                            ? winPayout.toFixed(2)
                            : displayBetAmount}
                        </div>
                      </div>
                    );
                  })()}
              </motion.div>
            );
          });
        })()}

        {/* SVG UI elements inside container bounds */}
        {history.length > 0 && dimensions.width > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
            <defs>
              <linearGradient id="fadeLeft" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#080A0C" stopOpacity="1" />
                <stop offset="12%" stopColor="#080A0C" stopOpacity="0" />
              </linearGradient>
            </defs>

            <path
              d={getSvgPath()}
              fill="none"
              stroke="#8AA6F9"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* End Point Glow */}
            {lPt && (
              <circle
                cx={lPt.x}
                cy={lPt.y}
                r="3.5"
                fill="#0847F7"
                className="animate-pulse"
              />
            )}

            {/* Fade Out Edge on Left */}
            <rect x="0" y="0" width="12%" height="100%" fill="url(#fadeLeft)" />
          </svg>
        )}
      </div>

      {/* Dynamic Time X-Axis (Bottom) */}
      <div
        className="absolute bottom-1 sm:bottom-4 left-2 sm:left-4 right-12 sm:right-16 h-5 sm:h-6 flex mt-2 text-[7px] sm:text-[9px] overflow-hidden font-bold"
        style={{ color: "#d0d0d0" }}
      >
        {timeLabels.map((t) => (
          <div
            key={`tx_${t}`}
            className="absolute flex justify-center -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${getTimeX(t)}%` }}
          >
            <span style={{ background: "#080A0C", padding: "0 4px" }}>
              {isMobile
                ? format(new Date(t), "HH:mm:ss")
                : format(new Date(t), "HH:mm:ss a")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
