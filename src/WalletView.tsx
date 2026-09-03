import React, { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { toast } from "react-hot-toast";
import {
  POOL_RESERVE_ADDRESS,
  POOL_RESERVE_ABI,
  ERC20_ABI,
} from "./contracts/abi";
import {
  paymentControllerDebugDeposit,
  paymentControllerRequestWithdrawal,
  paymentControllerGetActiveWithdrawalSession,
  paymentControllerDebugFinalizeWithdrawal,
  useAccountControllerGetBalance,
} from "./services/queries";

// Conversion rate: 0.001 token = 1000 in-app balance
// => 1 token = 1,000,000 in-app balance
// => 1 in-app balance = 0.000001 token
const IN_APP_PER_TOKEN = 1_000_000;

export const WalletView: React.FC = () => {
  const { address, isConnected, chain } = useAccount();
  const { switchChain, isPending: isPendingSwitch } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  // Deposit tab: token amount string
  const [depositAmountStr, setDepositAmountStr] = useState("");
  // Withdraw tab: in-app balance amount string
  const [withdrawInAppStr, setWithdrawInAppStr] = useState("");

  // Get asset address
  const { data: assetAddress } = useReadContract({
    address: POOL_RESERVE_ADDRESS,
    abi: POOL_RESERVE_ABI,
    functionName: "asset",
  });

  // Get asset info
  const { data: decimals = 18 } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!assetAddress,
    },
  });
  const { data: symbol } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: {
      enabled: !!assetAddress,
    },
  });
  const { data: name } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "name",
    query: {
      enabled: !!assetAddress,
    },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!assetAddress && !!address,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, POOL_RESERVE_ADDRESS] : undefined,
    query: {
      enabled: !!assetAddress && !!address,
    },
  });

  const { data: offChainBalanceData, refetch: refetchOffChainBalance } =
    useAccountControllerGetBalance();
  const offChainBalance = Number(
    (offChainBalanceData as { free?: string })?.free ?? 0,
  );

  // Contract Writes
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
  } = useWriteContract();
  const { isLoading: isWaitingApprove, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const {
    writeContract: writeDepositTrader,
    data: depositTxHash,
    isPending: isDepositingOnChain,
  } = useWriteContract();

  const {
    writeContract: writeClaimTrader,
    data: claimTxHash,
    isPending: isClaimingTrader,
  } = useWriteContract();
  const { isLoading: isWaitingClaim, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  const [isSubmittingApi, setIsSubmittingApi] = useState(false);

  // --------------- Computed values ---------------

  // Deposit: token amount
  const depositTokenAmountRaw = depositAmountStr
    ? parseUnits(depositAmountStr, decimals as number)
    : 0n;
  const rawDepositAmount = depositAmountStr ? parseFloat(depositAmountStr) : 0;

  // Deposit: equivalent in-app balance display
  const depositInAppEquivalent = depositAmountStr
    ? (parseFloat(depositAmountStr) * IN_APP_PER_TOKEN).toLocaleString()
    : "0";

  // Withdraw: user inputs in-app balance
  const rawWithdrawInApp = withdrawInAppStr ? parseFloat(withdrawInAppStr) : 0;

  // Withdraw: convert in-app balance → token amount (for smart contract)
  // tokenAmount = inAppBalance / IN_APP_PER_TOKEN
  const withdrawTokenFloat = rawWithdrawInApp / IN_APP_PER_TOKEN;
  // Format to 18 decimals for parseUnits (avoid floating point issues with toFixed)
  const withdrawTokenStr = withdrawTokenFloat.toFixed(18);
  const withdrawTokenAmountRaw =
    rawWithdrawInApp > 0
      ? parseUnits(withdrawTokenStr, decimals as number)
      : 0n;

  // Withdraw: display equivalent token amount
  const withdrawTokenEquivalent =
    rawWithdrawInApp > 0 ? withdrawTokenFloat.toFixed(6) : "0";

  const needApproval =
    activeTab === "deposit" &&
    allowance !== undefined &&
    (allowance as bigint) < depositTokenAmountRaw;

  // --------------- Effect: approval success ---------------
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
      toast.success("Approval successful!");
    }
  }, [isApproveSuccess, refetchAllowance]);

  // --------------- Effect: deposit tx confirmed → call API ---------------
  useEffect(() => {
    const handleDepositApi = async () => {
      if (depositTxHash && depositTokenAmountRaw > 0n) {
        try {
          setIsSubmittingApi(true);

          const tokenAmountFloat = parseFloat(depositAmountStr);
          // Rate: 0.001 token = 1000 in-app balance → in-app balance = tokenAmount * 1,000,000
          const apiAmount = Math.floor(
            tokenAmountFloat * IN_APP_PER_TOKEN,
          ).toString();

          const token = localStorage.getItem("token");

          await paymentControllerDebugDeposit(
            {
              amount: apiAmount,
              txHash: depositTxHash,
              logIndex: 0,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
          toast.success("Deposit processed off-chain successfully!");
          refetchBalance();
          refetchOffChainBalance();
          setDepositAmountStr("");
        } catch (error) {
          console.error("API error", error);
          toast.error("Transaction sent but API call failed.");
        } finally {
          setIsSubmittingApi(false);
        }
      }
    };
    if (depositTxHash) {
      handleDepositApi();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTxHash]);

  // --------------- Effect: claim (withdraw) tx confirmed → finalize ---------------
  useEffect(() => {
    if (!isClaimSuccess || !claimTxHash) return;

    const handleFinalizeWithdrawal = async () => {
      try {
        setIsSubmittingApi(true);

        const token = localStorage.getItem("token");
        const authHeader = { Authorization: `Bearer ${token}` };

        // Step 3a: Get active withdrawal session to obtain sessionId
        const sessionResponse =
          await paymentControllerGetActiveWithdrawalSession({
            headers: authHeader,
          });

        // The session data is in sessionResponse.data (typed as void by generated code,
        // but at runtime it contains the actual object)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionData = sessionResponse as any as
          | { sessionId: string }
          | null
          | undefined;

        if (!sessionData?.sessionId) {
          toast.error("Could not retrieve withdrawal session ID.");
          return;
        }

        const sessionId = sessionData.sessionId;

        // Step 3b: Finalize withdrawal
        await paymentControllerDebugFinalizeWithdrawal(
          {
            sessionId,
            txHash: claimTxHash,
            logIndex: 0,
          },
          {
            headers: {
              ...authHeader,
              "Content-Type": "application/json",
            },
          },
        );

        toast.success("Withdrawal finalized successfully!");
        refetchBalance();
        refetchOffChainBalance();
        setWithdrawInAppStr("");
      } catch (error) {
        console.error("Finalize withdrawal error", error);
        toast.error("On-chain claim sent but finalization failed.");
      } finally {
        setIsSubmittingApi(false);
      }
    };

    handleFinalizeWithdrawal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClaimSuccess, claimTxHash]);

  // --------------- Handlers ---------------

  const handleDeposit = async () => {
    if (!depositAmountStr || rawDepositAmount <= 0) {
      return toast.error("Enter a valid amount");
    }
    if ((balance as bigint) < depositTokenAmountRaw) {
      return toast.error("Insufficient balance");
    }

    if (needApproval) {
      writeApprove({
        address: assetAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [POOL_RESERVE_ADDRESS, maxUint256],
      });
    } else {
      writeDepositTrader({
        address: POOL_RESERVE_ADDRESS,
        abi: POOL_RESERVE_ABI,
        functionName: "depositTrader",
        args: [depositTokenAmountRaw],
      });
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawInAppStr || rawWithdrawInApp <= 0) {
      return toast.error("Enter a valid in-app balance amount");
    }

    const token = localStorage.getItem("token");
    const authHeader = { Authorization: `Bearer ${token}` };

    try {
      setIsSubmittingApi(true);

      // Step 1: Request withdrawal via API
      await paymentControllerRequestWithdrawal(
        { amount: withdrawInAppStr },
        { headers: { ...authHeader, "Content-Type": "application/json" } },
      );

      toast.success("Withdrawal request submitted. Processing on-chain...");
    } catch (error) {
      console.error("Request withdrawal error", error);
      toast.error("Failed to initiate withdrawal request.");
      setIsSubmittingApi(false);
      return;
    } finally {
      setIsSubmittingApi(false);
    }

    // Step 2: Call smart contract claimTrader with converted token amount
    writeClaimTrader({
      address: POOL_RESERVE_ADDRESS,
      abi: POOL_RESERVE_ABI,
      functionName: "claimTrader",
      args: [withdrawTokenAmountRaw],
    });
  };

  const isInsufficientDeposit =
    activeTab === "deposit" &&
    depositTokenAmountRaw > (balance ? (balance as bigint) : 0n);
  const isInsufficientWithdraw =
    activeTab === "withdraw" && rawWithdrawInApp > offChainBalance;

  const isPending =
    isApproving ||
    isWaitingApprove ||
    isDepositingOnChain ||
    isClaimingTrader ||
    isWaitingClaim ||
    isSubmittingApi;

  const isDisabled =
    !isConnected ||
    isPending ||
    (activeTab === "deposit"
      ? isInsufficientDeposit
      : isInsufficientWithdraw) ||
    (activeTab === "deposit" ? rawDepositAmount <= 0 : rawWithdrawInApp <= 0);

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto w-full relative z-10">
      {/* Page heading */}
      <div className="flex items-center gap-4 mb-8 pt-4 lg:pt-0">
        <h1
          className="text-3xl font-extrabold tracking-tight"
          style={{ color: "#FFFFFF" }}
        >
          Wallet
        </h1>
        <span
          className="text-xs px-2.5 py-1 font-semibold uppercase tracking-wider backdrop-blur-md"
          style={{
            background: "rgba(55,91,210,0.15)",
            color: "#d0d0d0",
            border: "1px solid rgba(55,91,210,0.3)",
            borderRadius: "6px",
          }}
        >
          Testnet
        </span>
      </div>

      {/* Balance overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <div className="p-6 sci-card group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0847F7] opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-opacity"></div>
          <p className="text-sm mb-2 font-medium" style={{ color: "#d0d0d0" }}>
            On-Chain Token Balance
          </p>
          <p
            className="text-4xl font-black font-mono tracking-tight"
            style={{ color: "#FFFFFF" }}
          >
            {balance !== undefined
              ? Number(
                  formatUnits(balance as bigint, decimals as number),
                ).toLocaleString(undefined, { maximumFractionDigits: 6 })
              : "—"}
          </p>
        </div>
        <div className="p-6 sci-card group">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#0847F7] opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-opacity"></div>
          <p className="text-sm mb-2 font-medium" style={{ color: "#d0d0d0" }}>
            Token Info
          </p>
          <p
            className="text-lg font-bold truncate mb-3"
            style={{ color: "#FFFFFF" }}
          >
            {name ? `${name} (${symbol})` : "—"}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] uppercase font-bold tracking-widest py-1 px-2 rounded-md"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "#d0d0d0",
              }}
            >
              Contract
            </span>
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/20 hover:bg-black/40 transition-colors cursor-pointer"
              onClick={() => {
                if (assetAddress) {
                  navigator.clipboard.writeText(assetAddress as string);
                  toast.success("Token address copied!");
                }
              }}
            >
              <p
                className="text-[11px] font-mono truncate"
                style={{ color: "#d0d0d0" }}
              >
                {(assetAddress as string)?.slice(0, 8)}...
                {(assetAddress as string)?.slice(-6)}
              </p>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d0d0d0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="sci-card">
        {/* Tab switcher */}
        <div
          className="flex relative"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          {(["deposit", "withdraw"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setDepositAmountStr("");
                setWithdrawInAppStr("");
              }}
              className={`flex-1 py-4 px-6 text-sm font-bold transition-all duration-300 capitalize relative overflow-hidden
                  ${activeTab === tab ? "text-white" : "text-[#a0a0a0] hover:text-[#d0d0d0]"}`}
            >
              {activeTab === tab && (
                <div className="absolute inset-0 bg-gradient-to-t from-[#0847F7]/20 to-transparent opacity-50"></div>
              )}
              <span className="relative z-10">{tab} Activity</span>
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0847F7] animate-pulse">
                  <div className="absolute inset-0 bg-[#0847F7] blur-sm"></div>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="p-6 md:p-8 space-y-8 relative">
          {/* Background elements inside the form */}
          <div className="absolute top-1/2 left-0 w-64 h-64 bg-[#0847F7] rounded-full blur-[120px] opacity-10 pointer-events-none -translate-y-1/2"></div>

          {/* ---- DEPOSIT TAB ---- */}
          {activeTab === "deposit" && (
            <div className="relative z-10 animate-[fadeIn_0.3s_ease-out]">
              <div className="mb-6">
                <div className="flex justify-between mb-3 items-end">
                  <label
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#d0d0d0" }}
                  >
                    Amount to Deposit
                  </label>
                  {balance !== undefined && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "#d0d0d0" }}
                    >
                      Available:{" "}
                      <strong className="text-white font-mono">
                        {Number(
                          formatUnits(balance as bigint, decimals as number) ||
                            0,
                        ).toFixed(2)}
                      </strong>{" "}
                      {symbol}
                    </span>
                  )}
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    value={depositAmountStr}
                    onChange={(e) => setDepositAmountStr(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.001"
                    className="w-full p-4 pl-5 pr-20 text-2xl font-black font-mono outline-none transition-all duration-300"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      color: "#FFFFFF",
                    }}
                    onFocus={(e) => {
                      (e.target as HTMLElement).style.borderColor = "#0847F7";
                      (e.target as HTMLElement).style.boxShadow =
                        "0 0 0 3px rgba(8, 71, 247,0.2)";
                    }}
                    onBlur={(e) => {
                      (e.target as HTMLElement).style.borderColor =
                        "rgba(255,255,255,0.08)";
                      (e.target as HTMLElement).style.boxShadow = "none";
                    }}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-bold rounded-md bg-[#0847F7]/20 text-[#d0d0d0] hover:bg-[#0847F7]/40 transition-colors uppercase tracking-wider"
                    onClick={() => {
                      if (balance !== undefined && balance > 0n) {
                        setDepositAmountStr(
                          formatUnits(balance as bigint, decimals as number),
                        );
                      }
                    }}
                  >
                    Max
                  </button>
                </div>

                {depositAmountStr && parseFloat(depositAmountStr) > 0 && (
                  <div className="mt-4 flex items-center justify-between text-sm p-3 rounded-lg bg-[#0847F7]/5 border border-[#0847F7]/10">
                    <span className="text-[#d0d0d0]">You will receive:</span>
                    <span className="font-bold text-[#d0d0d0] flex items-center gap-1.5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {depositInAppEquivalent} In-App Balance
                    </span>
                  </div>
                )}
              </div>

              {isConnected && chain?.id !== sepolia.id ? (
                <button
                  onClick={() => switchChain?.({ chainId: sepolia.id })}
                  disabled={isPendingSwitch}
                  className="w-full py-4 rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 uppercase tracking-wider"
                  style={{ background: "#0847F7", color: "#ffffff" }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.5 2v6h-6M2.13 15.57a9 9 0 1 0 3.87-8.91L2 9"></path>
                    </svg>
                    {isPendingSwitch
                      ? "Switching Network..."
                      : "Switch to Sepolia"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={!isConnected || isPending || isDisabled}
                  className="w-full py-4 rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 uppercase tracking-wider"
                  style={{ background: "#0847F7", color: "#ffffff" }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {!isConnected ? (
                      "Wallet Not Connected"
                    ) : isInsufficientDeposit ? (
                      "Insufficient Balance"
                    ) : isApproving || isWaitingApprove ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Approving...
                      </>
                    ) : isDepositingOnChain || isSubmittingApi ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Depositing...
                      </>
                    ) : needApproval ? (
                      "Approve Tokens"
                    ) : (
                      "Confirm Deposit"
                    )}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* ---- WITHDRAW TAB ---- */}
          {activeTab === "withdraw" && (
            <div className="relative z-10 animate-[fadeIn_0.3s_ease-out]">
              <div className="mb-6">
                <div className="flex justify-between mb-3 items-end">
                  <label
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#d0d0d0" }}
                  >
                    Amount to Withdraw (In-App)
                  </label>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#d0d0d0" }}
                  >
                    App Balance:{" "}
                    <strong className="text-white font-mono">
                      {offChainBalance.toLocaleString()}
                    </strong>
                  </span>
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    value={withdrawInAppStr}
                    onChange={(e) => setWithdrawInAppStr(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full p-4 pl-5 pr-20 text-2xl font-black font-mono outline-none transition-all duration-300"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      color: "#FFFFFF",
                    }}
                    onFocus={(e) => {
                      (e.target as HTMLElement).style.borderColor = "#0847F7";
                      (e.target as HTMLElement).style.boxShadow =
                        "0 0 0 3px rgba(8, 71, 247,0.2)";
                    }}
                    onBlur={(e) => {
                      (e.target as HTMLElement).style.borderColor =
                        "rgba(255,255,255,0.08)";
                      (e.target as HTMLElement).style.boxShadow = "none";
                    }}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-bold rounded-md bg-[#0847F7]/20 text-[#d0d0d0] hover:bg-[#0847F7]/40 transition-colors uppercase tracking-wider"
                    onClick={() => {
                      setWithdrawInAppStr(offChainBalance.toString());
                    }}
                  >
                    Max
                  </button>
                </div>

                {withdrawInAppStr && rawWithdrawInApp > 0 && (
                  <div className="mt-4 flex flex-col gap-2 p-4 rounded-xl bg-black/40 border border-white/5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#d0d0d0]">
                        You will receive on-chain:
                      </span>
                      <span className="font-bold text-[#d0d0d0] font-mono text-base bg-[#0847F7]/10 px-2 py-1 rounded">
                        ≈ {withdrawTokenEquivalent} {symbol}
                      </span>
                    </div>
                    <div className="w-full h-px bg-white/5 my-1"></div>
                    <div className="flex justify-between items-center text-xs text-[#a0a0a0]">
                      <span>Conversion Rate</span>
                      <span>1000 In-App = 0.001 {symbol}</span>
                    </div>
                  </div>
                )}
              </div>

              {isConnected && chain?.id !== sepolia.id ? (
                <button
                  onClick={() => switchChain?.({ chainId: sepolia.id })}
                  disabled={isPendingSwitch}
                  className="w-full py-4 rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 uppercase tracking-wider"
                  style={{ background: "#0847F7", color: "#ffffff" }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.5 2v6h-6M2.13 15.57a9 9 0 1 0 3.87-8.91L2 9"></path>
                    </svg>
                    {isPendingSwitch ? "Switching..." : "Switch to Sepolia"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleWithdraw}
                  disabled={!isConnected || isPending || isDisabled}
                  className="w-full py-4 rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 uppercase tracking-wider"
                  style={{ background: "#0847F7", color: "#ffffff" }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {!isConnected ? (
                      "Wallet Not Connected"
                    ) : isInsufficientWithdraw ? (
                      "Insufficient Balance"
                    ) : isSubmittingApi ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Requesting...
                      </>
                    ) : isClaimingTrader ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Claiming On-Chain...
                      </>
                    ) : isWaitingClaim ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Confirming...
                      </>
                    ) : (
                      "Confirm Withdraw"
                    )}
                  </span>
                </button>
              )}
            </div>
          )}

          <div
            className="mt-8 rounded-xl p-5 relative overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#0847F7] to-transparent"></div>
            <h3
              className="text-xs font-bold mb-3 uppercase tracking-widest flex items-center gap-2"
              style={{ color: "#d0d0d0" }}
            >
              <div className="p-1.5 rounded-md bg-[#0847F7]/10 text-[#d0d0d0]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              How it works
            </h3>
            <p className="text-[#d0d0d0] text-sm leading-relaxed pl-1">
              Tokens deposited to the Pool Reserve will be updated on the
              backend. By design,{" "}
              <strong className="text-white">
                0.001 token = 1000 in-app balance
              </strong>
              .
              {activeTab === "withdraw"
                ? " Enter your in-app balance to withdraw equivalent tokens from the pool."
                : " Withdrawing tokens from Trader balance relies on demo mockings. Off-chain state must be claimed through API for production."}
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
