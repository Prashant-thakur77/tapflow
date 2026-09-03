import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Dialog, DialogPanel } from "@headlessui/react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { useGameStore } from "./store";
import {
  authControllerGetChallenge,
  authControllerLogin,
  authControllerGetWssKey,
  getAccountControllerGetBalanceQueryKey,
  useAccountControllerGetBalance,
} from "./services/queries";
import { io, Socket } from "socket.io-client";
import CryptoJS from "crypto-js";
import { useQueryClient } from "@tanstack/react-query";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { BACKEND_URL } from "./constant";

export const Header: React.FC = () => {
  const balance = useGameStore((state) => state.balance);
  const currentPrice = useGameStore((state) => state.currentPrice);
  const betAmount = useGameStore((state) => state.betAmount);
  const setBetAmount = useGameStore((state) => state.setBetAmount);
  const updatePrice = useGameStore((state) => state.updatePrice);
  const updateGrid = useGameStore((state) => state.updateGrid);
  const setConnection = useGameStore((state) => state.setConnection);
  const updateOrder = useGameStore((state) => state.updateOrder);
  const updateBalance = useGameStore((state) => state.updateBalance);

  const isDemoMode = useGameStore((state) => state.isDemoMode);
  const demoAddress = useGameStore((state) => state.demoAddress);
  const setDemoMode = useGameStore((state) => state.setDemoMode);
  const setDemoAddress = useGameStore((state) => state.setDemoAddress);

  const {
    address: realAddress,
    isConnected: isRealConnected,
    chain,
  } = useAccount();

  const isConnected = isDemoMode || isRealConnected;
  const address = isDemoMode ? demoAddress : realAddress;

  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: isPendingSwitch } = useSwitchChain();
  const isLoggingIn = useRef(false);
  const promptedAddress = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );

  const { data: balanceData, refetch: refetchBalance } =
    useAccountControllerGetBalance();

  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isFunding, setIsFunding] = useState(false);

  useEffect(() => {
    if (
      balanceData &&
      typeof (balanceData as unknown as { free?: string }).free !== "undefined"
    ) {
      updateBalance(Number((balanceData as unknown as { free?: string }).free));
    }
  }, [balanceData, updateBalance]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkTime = () => {
      const storedTime = localStorage.getItem("last-fund-time");
      if (storedTime) {
        const lastTime = parseInt(storedTime, 10);
        const targetTime = lastTime + 30 * 60 * 1000;
        const now = Date.now();
        const diff = targetTime - now;
        if (diff > 0) {
          setTimeRemaining(diff);
        } else {
          setTimeRemaining(0);
        }
      } else {
        setTimeRemaining(0);
      }
    };

    if (isFundModalOpen) {
      checkTime();
      interval = setInterval(checkTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFundModalOpen]);

  const handleLogin = async () => {
    if (!isConnected || !address || isLoggingIn.current) return;

    const token = localStorage.getItem("token");
    const storedAddress = localStorage.getItem("wallet-address");

    if (token && storedAddress === address) return;

    if (promptedAddress.current === address) return;

    isLoggingIn.current = true;
    promptedAddress.current = address;
    try {
      const challengeRes = await authControllerGetChallenge({ address });
      const challenge = (challengeRes as unknown as { challenge: string })
        .challenge;

      let signature: string;
      if (isDemoMode) {
        const demoPk = localStorage.getItem("demo-private-key");
        if (!demoPk) {
          setDemoMode(false);
          return;
        }
        const account = privateKeyToAccount(demoPk as `0x${string}`);
        signature = await account.signMessage({ message: challenge });
      } else {
        signature = await signMessageAsync({ message: challenge });
      }

      const loginRes = await authControllerLogin({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      const accessToken = (loginRes as unknown as { accessToken: string })
        .accessToken;

      localStorage.setItem("token", accessToken);
      setToken(accessToken);
      localStorage.setItem("wallet-address", address);
      refetchBalance();
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      isLoggingIn.current = false;
    }
  };

  useEffect(() => {
    handleLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, isDemoMode]);

  useEffect(() => {
    let socket: Socket | null = null;
    let isActive = true;

    const connectWss = async () => {
      try {
        socket = io(BACKEND_URL);

        socket.on("connect", async () => {
          if (!isActive) return;
          console.log("Header WSS Connected");

          try {
            if (token) {
              const wssKeyRes = await authControllerGetWssKey();
              const wssKey = (wssKeyRes as unknown as { key: string }).key;
              setConnection(socket, wssKey);

              if (address) {
                const challengeRes = await authControllerGetChallenge({
                  address: address as string,
                });
                console.log("challengeRes: ", challengeRes);
                const wssChallenge = (
                  challengeRes as unknown as { challenge: string }
                ).challenge;

                const hmac = CryptoJS.algo.HMAC.create(
                  CryptoJS.algo.SHA256,
                  CryptoJS.enc.Hex.parse(wssKey),
                );
                hmac.update(address);
                hmac.update(wssChallenge);

                const wssSignature = hmac.finalize().toString(CryptoJS.enc.Hex);

                socket?.emit("subscribe_user", {
                  userId: address,
                  signature: wssSignature,
                });
              }
            }
          } catch (e) {
            console.error("WSS Subscription Error:", e);
          }
        });

        const events = [
          "grid_update",
          "balance_update",
          "order_update",
          "price_now",
        ];

        events.forEach((evt) => {
          socket?.on(evt, (data) => {
            switch (evt) {
              case "price_now":
                if (data?.price) {
                  updatePrice(data.price, data.ts);
                }
                break;
              case "grid_update":
                if (Array.isArray(data)) {
                  updateGrid(data);
                }
                break;
              case "balance_update":
                if (data) {
                  queryClient.setQueryData(
                    getAccountControllerGetBalanceQueryKey(),
                    data,
                  );
                }
                break;
              case "order_update":
                updateOrder(data);
                break;
            }
          });
        });

        socket.on("disconnect", () => {
          console.log("Header WSS Disconnected");
        });
      } catch (err) {
        console.error("WebSocket setup failed:", err);
      }
    };

    connectWss();

    return () => {
      isActive = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [
    isConnected,
    address,
    updatePrice,
    updateGrid,
    queryClient,
    setConnection,
    updateOrder,
    token,
  ]);

  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  const startDemo = async () => {
    try {
      setIsDemoLoading(true);
      const newPk = generatePrivateKey();
      const account = privateKeyToAccount(newPk);
      localStorage.setItem("demo-private-key", newPk);

      const newAddress = account.address;
      setDemoAddress(newAddress);

      const challengeRes = await authControllerGetChallenge({
        address: newAddress,
      });
      const challenge = (challengeRes as unknown as { challenge: string })
        .challenge;
      const signature = await account.signMessage({ message: challenge });

      const loginRes = await authControllerLogin({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newAddress, signature }),
      });
      const accessToken = (loginRes as unknown as { accessToken: string })
        .accessToken;

      localStorage.setItem("token", accessToken);
      setToken(accessToken);
      localStorage.setItem("wallet-address", newAddress);

      // Auto faucet
      await fetch(`${BACKEND_URL}/api/payment/debug/deposit`, {
        method: "POST",
        headers: {
          accept: "*/*",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: "100",
          txHash: `0x${Date.now()}`,
          logIndex: 2,
        }),
      });

      setDemoMode(true);
      refetchBalance();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (isDemoMode) {
      setDemoMode(false);
      setDemoAddress(null);
      localStorage.removeItem("demo-private-key");
    } else {
      disconnect();
    }
    localStorage.removeItem("token");
    setToken(null);
    localStorage.removeItem("wallet-address");
    promptedAddress.current = null;
    setWalletMenuOpen(false);
  };

  return (
    <header
      className="xl:h-14 flex flex-col xl:flex-row xl:items-center xl:justify-between px-3 sm:px-4 xl:px-6 sticky top-0 z-40 gap-0 py-2"
      style={{
        background: "rgba(22, 20, 42, 0.4)",
        backdropFilter: "blur(20px)",
        borderBottom: "2px solid rgba(255, 255, 255, 0.05)",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* ── Row 1 (always visible): logo + market + price + wallet ── */}
      <div className="flex items-center gap-3 h-14 xl:h-auto">
        {/* tapl logo */}
        <div className="flex items-center gap-2 mr-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0847F7 0%, #002280 100%)",
              boxShadow: "0 2px 8px rgba(8, 71, 247, 0.3)",
            }}
          >
            <img
              src="/tapl.png"
              alt="tapl"
              className="w-5 h-5 object-contain relative z-10"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <span className="hidden sm:block text-lg font-black tracking-tighter italic mr-2">
            TAPL<span style={{ color: "#0847F7" }}>.</span>
          </span>
        </div>

        {/* Market badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            borderRadius: "4px",
          }}
        >
          <span className="font-semibold text-xs" style={{ color: "#ffffff" }}>
            BTC/USD
          </span>
        </div>

        {/* Live price */}
        <span className="text-sm xl:text-base font-bold font-mono text-white flex items-center gap-1.5 flex-1 min-w-0">
          <span className="truncate" style={{ color: "#2EBD85" }}>
            ${currentPrice.toFixed(2)}
          </span>
          <span className="flex h-1.5 w-1.5 relative shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "#2EBD85" }}
            ></span>
            <span
              className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{ background: "#2EBD85" }}
            ></span>
          </span>
        </span>

        {/* ── Mobile wallet section ── */}
        <div className="xl:hidden ml-auto shrink-0 flex items-center gap-2">
          {!isConnected ? (
            <>
              <button
                onClick={startDemo}
                disabled={isDemoLoading}
                className="px-3 py-1.5 font-bold rounded border border-[#0847F7] text-[#0847F7] active:scale-95 transition-transform text-xs whitespace-nowrap disabled:opacity-50"
              >
                {isDemoLoading ? "STARTING..." : "DEMO"}
              </button>
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="px-3 py-1.5 font-bold rounded bg-[#0847F7] text-white active:scale-95 transition-transform text-xs whitespace-nowrap"
              >
                CONNECT
              </button>
            </>
          ) : chain?.id !== sepolia.id && !isDemoMode ? (
            <button
              onClick={() => switchChain?.({ chainId: sepolia.id })}
              disabled={isPendingSwitch}
              className="px-3 py-1.5 font-bold rounded bg-[#0847F7] text-white active:scale-95 transition-transform text-[11px] whitespace-nowrap disabled:opacity-50"
            >
              {isPendingSwitch ? "SWITCHING..." : "SWITCH NETWORK"}
            </button>
          ) : !token ? (
            <button
              onClick={() => {
                promptedAddress.current = null;
                handleLogin();
              }}
              className="px-3 py-1.5 font-bold rounded bg-[#0847F7] text-white active:scale-95 transition-transform text-xs whitespace-nowrap"
            >
              LOGIN
            </button>
          ) : (
            <div className="relative">
              {walletMenuOpen && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setWalletMenuOpen(false)}
                />
              )}
              {/* Wallet chip button */}
              <button
                onClick={() => setWalletMenuOpen((v) => !v)}
                className="relative z-50 font-semibold px-2.5 py-1.5 active:scale-95 transition-transform flex items-center gap-1.5 text-xs"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  color: "#ffffff",
                  borderRadius: "4px",
                }}
              >
                {address?.slice(0, 4)}..{address?.slice(-3)}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`opacity-60 transition-transform duration-200 ${walletMenuOpen ? "rotate-180" : ""}`}
                  style={{ color: "#d0d0d0" }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {/* Dropdown */}
              {walletMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-52 shadow-2xl overflow-hidden z-50"
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "4px",
                  }}
                >
                  <div
                    className="px-3 pt-3 pb-2"
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <p
                      className="text-[9px] uppercase tracking-wider font-semibold mb-1"
                      style={{ color: "#a0a0a0" }}
                    >
                      {isDemoMode ? "Demo Wallet" : "Connected"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="font-mono text-[11px] truncate min-w-0"
                        style={{ color: "#ffffff" }}
                      >
                        {address?.slice(0, 10)}...{address?.slice(-6)}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (address) {
                              navigator.clipboard.writeText(address);
                              toast.success("Address copied!", {
                                id: "copy-address-mobile",
                                style: {
                                  background: "rgba(255, 255, 255, 0.03)",
                                  color: "#ffffff",
                                  border: "1px solid rgba(255, 255, 255, 0.05)",
                                  fontSize: "12px",
                                },
                                iconTheme: {
                                  primary: "#2EBD85",
                                  secondary: "#ffffff",
                                },
                              });
                            }
                          }}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="Copy Address"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ color: "#d0d0d0" }}
                          >
                            <rect
                              width="14"
                              height="14"
                              x="8"
                              y="8"
                              rx="2"
                              ry="2"
                            />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                        </button>
                        <a
                          href={`https://sepolia.etherscan.io/address/${address}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="View on Explorer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ color: "#d0d0d0" }}
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="w-full text-left px-4 py-3 font-medium transition-colors flex items-center gap-2.5 text-xs"
                    style={{ color: "#F6465D" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(246,70,93,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2 (mobile only): bet + balance + faucet ── */}
      {isConnected && (
        <div
          className="xl:hidden flex items-center gap-2 h-10 overflow-x-auto scrollbar-none"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}
        >
          {/* Bet selector */}
          <div
            className="flex px-2.5 py-1.5 items-center gap-1.5 shrink-0"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "4px",
            }}
          >
            <span
              className="text-[10px] font-medium"
              style={{ color: "#d0d0d0" }}
            >
              Bet
            </span>
            <div className="relative flex items-center">
              <select
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="bg-transparent font-bold font-mono text-xs outline-none cursor-pointer appearance-none pr-4"
                style={{ color: "#0847F7" }}
              >
                <option
                  style={{ background: "#080A0C", color: "#0847F7" }}
                  value={10}
                >
                  $10
                </option>
                <option
                  style={{ background: "#080A0C", color: "#0847F7" }}
                  value={50}
                >
                  $50
                </option>
                <option
                  style={{ background: "#080A0C", color: "#0847F7" }}
                  value={100}
                >
                  $100
                </option>
              </select>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0847F7"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute right-0 pointer-events-none"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Balance */}
          <div
            className="flex px-2.5 py-1.5 items-center gap-1.5 shrink-0"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "4px",
            }}
          >
            <span
              className="text-[10px] font-medium"
              style={{ color: "#d0d0d0" }}
            >
              Balance
            </span>
            <span
              className="font-bold font-mono text-xs"
              style={{ color: "#ffffff" }}
            >
              {"$"}
              {Number(balance).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* ── Desktop right side (xl+): all in one row ── */}
      <div className="hidden xl:flex items-center gap-3">
        {isConnected && (
          <>
            <div
              className="px-3 py-1.5 flex items-center gap-2"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "4px",
              }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "#d0d0d0" }}
              >
                Bet:
              </span>
              <div className="relative flex items-center">
                <select
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="bg-transparent font-bold font-mono text-sm outline-none cursor-pointer appearance-none pr-5"
                  style={{ color: "#0847F7" }}
                >
                  <option
                    style={{ background: "#080A0C", color: "#0847F7" }}
                    value={10}
                  >
                    $10
                  </option>
                  <option
                    style={{ background: "#080A0C", color: "#0847F7" }}
                    value={50}
                  >
                    $50
                  </option>
                  <option
                    style={{ background: "#080A0C", color: "#0847F7" }}
                    value={100}
                  >
                    $100
                  </option>
                </select>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0847F7"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute right-0 pointer-events-none"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            <div
              className="px-4 py-1.5 flex items-center gap-2"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "4px",
              }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "#d0d0d0" }}
              >
                Balance
              </span>
              <span
                className="font-bold font-mono text-sm"
                style={{ color: "#0847F7" }}
              >
                {"$"}
                {Number(balance).toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => setIsFundModalOpen(true)}
              className="px-4 py-1.5 font-bold rounded bg-[#0847F7] text-white transition-all text-sm"
            >
              FAUCET
            </button>
          </>
        )}

        {isConnected ? (
          chain?.id !== sepolia.id && !isDemoMode ? (
            <button
              onClick={() => switchChain({ chainId: sepolia.id })}
              disabled={isPendingSwitch}
              className="flex items-center gap-2 px-4 py-1.5 font-bold rounded bg-[#0847F7] text-white text-sm disabled:opacity-50"
            >
              {isPendingSwitch ? "SWITCHING..." : "SWITCH NETWORK"}
            </button>
          ) : !token ? (
            <button
              onClick={() => {
                promptedAddress.current = null;
                handleLogin();
              }}
              className="flex items-center gap-2 px-4 py-1.5 font-bold rounded bg-[#0847F7] text-white text-sm"
            >
              LOGIN
            </button>
          ) : (
            <div className="relative group">
              <button
                className="font-semibold px-4 py-2 transition-all active:scale-95 flex items-center gap-2 text-sm"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  color: "#ffffff",
                  borderRadius: "4px",
                }}
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
                {isDemoMode && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{
                      background: "rgba(8, 71, 247,0.1)",
                      color: "#0847F7",
                      border: "1px solid rgba(8, 71, 247,0.2)",
                    }}
                  >
                    DEMO
                  </span>
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform group-hover:rotate-180"
                  style={{ color: "#d0d0d0" }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <div
                className="absolute right-0 top-full mt-1 w-52 shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                }}
              >
                <div
                  className="px-4 pt-3 pb-2"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <p
                    className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                    style={{ color: "#a0a0a0" }}
                  >
                    {isDemoMode ? "Demo Wallet" : "Connected"}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="font-mono text-xs truncate min-w-0"
                      style={{ color: "#ffffff" }}
                    >
                      {address}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (address) {
                            navigator.clipboard.writeText(address);
                            toast.success("Address copied!", {
                              id: "copy-address-desktop",
                              style: {
                                background: "rgba(255, 255, 255, 0.03)",
                                color: "#ffffff",
                                border: "1px solid rgba(255, 255, 255, 0.05)",
                                fontSize: "12px",
                              },
                              iconTheme: {
                                primary: "#2EBD85",
                                secondary: "#ffffff",
                              },
                            });
                          }
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="Copy Address"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: "#d0d0d0" }}
                        >
                          <rect
                            width="14"
                            height="14"
                            x="8"
                            y="8"
                            rx="2"
                            ry="2"
                          />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      </button>
                      <a
                        href={`https://sepolia.etherscan.io/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="View on Explorer"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: "#d0d0d0" }}
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full text-left px-4 py-3 font-medium transition-colors flex items-center gap-2 text-sm"
                  style={{ color: "#F6465D" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(246,70,93,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Disconnect
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="flex items-center gap-2 px-4 py-2 font-bold rounded bg-[#0847F7] text-white text-sm"
            >
              CONNECT WALLET
            </button>
          </div>
        )}
      </div>

      <Dialog
        open={isFundModalOpen}
        onClose={() => setIsFundModalOpen(false)}
        className="relative z-50"
      >
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          aria-hidden="true"
        />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel
            className="p-6 max-w-md w-full mx-4 relative"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <button
              onClick={() => setIsFundModalOpen(false)}
              className="absolute top-4 right-4 transition-colors"
              style={{ color: "#a0a0a0" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#a0a0a0";
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <h2 className="text-lg font-bold mb-1" style={{ color: "#ffffff" }}>
              Faucet Account
            </h2>
            <p className="text-sm mb-6" style={{ color: "#d0d0d0" }}>
              Claim $100 in test funds. Request additional funds every 30
              minutes.
            </p>

            <div className="flex flex-col items-center gap-4">
              {timeRemaining > 0 ? (
                <div
                  className="px-6 py-3 font-mono text-lg font-bold flex items-center gap-2 w-full justify-center"
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "4px",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "#d0d0d0" }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Next in {Math.floor(timeRemaining / 1000 / 60)}:
                  {String(Math.floor((timeRemaining / 1000) % 60)).padStart(
                    2,
                    "0",
                  )}
                </div>
              ) : (
                <button
                  onClick={async () => {
                    const token = localStorage.getItem("token");
                    if (!token) return;
                    setIsFunding(true);
                    try {
                      await fetch(`${BACKEND_URL}/api/payment/debug/deposit`, {
                        method: "POST",
                        headers: {
                          accept: "*/*",
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          amount: "100",
                          txHash: `0x${Date.now()}`,
                          logIndex: 2,
                        }),
                      });
                      localStorage.setItem(
                        "last-fund-time",
                        Date.now().toString(),
                      );
                      refetchBalance();
                    } catch (error) {
                      console.error("Deposit failed:", error);
                    } finally {
                      setIsFunding(false);
                    }
                  }}
                  disabled={isFunding}
                  className="w-full font-semibold px-6 py-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm"
                  style={{
                    background: "#0847F7",
                    color: "#ffffff",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (!isFunding)
                      (e.currentTarget as HTMLElement).style.background =
                        "#8AA6F9";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "#0847F7";
                  }}
                >
                  {isFunding ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                      Funding...
                    </>
                  ) : (
                    "Fund $100 Now"
                  )}
                </button>
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </header>
  );
};
