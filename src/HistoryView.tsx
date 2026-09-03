import React, { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";
import { BACKEND_URL } from "./constant";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Order {
  settledAt?: string;
  createdAt?: string;
  marketId?: string;
  rewardRate?: string | number;
  amount: string | number;
  settledWin?: boolean | null;
  status?: string;
}

export const HistoryView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const fetchHistory = async (pageIdx: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      const limit = 20;
      const offset = pageIdx * limit;
      const res = await axios.get(
        `${BACKEND_URL}/api/orders/user?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "*/*",
          },
        },
      );
      const data = res.data?.data || res.data;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page);
  }, [page]);

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 relative min-h-0">
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-h-0 sci-card">
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "#ffffff" }}>
            Trading History
          </h2>
        </div>

        <div className="flex-1 overflow-auto w-full">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[500px]">
            <thead className="z-10">
              <tr
                className="text-xs uppercase tracking-wider"
                style={{
                  color: "#a0a0a0",
                }}
              >
                <th
                  className="sticky top-0 z-20 py-4 px-4 whitespace-nowrap bg-[#080A0C]"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  Settled Date
                </th>
                <th
                  className="sticky top-0 z-20 py-4 px-4 bg-[#080A0C]"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  Market
                </th>
                <th
                  className="sticky top-0 z-20 py-4 px-4 whitespace-nowrap bg-[#080A0C]"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  Reward Rate
                </th>
                <th
                  className="sticky top-0 z-20 py-4 px-4 text-right bg-[#080A0C]"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  Amount
                </th>
                <th
                  className="sticky top-0 z-20 py-4 px-4 text-center bg-[#080A0C]"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2
                      className="w-8 h-8 animate-spin mx-auto"
                      style={{ color: "#0847F7" }}
                    />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-20 text-center text-[#9c9994] text-lg"
                  >
                    No order history found.
                  </td>
                </tr>
              ) : (
                orders.map((order, i) => (
                  <tr
                    key={i}
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                    }}
                  >
                    <td
                      className="py-4 px-4 text-sm whitespace-nowrap"
                      style={{ color: "#d0d0d0" }}
                    >
                      {order.settledAt
                        ? format(new Date(order.settledAt), "MMM d, HH:mm:ss")
                        : order.createdAt
                          ? format(new Date(order.createdAt), "MMM d, HH:mm:ss")
                          : "-"}
                    </td>
                    <td
                      className="py-4 px-4 text-sm font-mono whitespace-nowrap"
                      style={{ color: "#ffffff" }}
                    >
                      {order.marketId || "BTCUSDT"}
                    </td>
                    <td
                      className="py-4 px-4 text-sm font-mono whitespace-nowrap"
                      style={{ color: "#ffffff" }}
                    >
                      {order.rewardRate
                        ? Number(order.rewardRate).toFixed(3) + "x"
                        : "-"}
                    </td>
                    <td
                      className="py-4 px-4 font-bold text-right whitespace-nowrap font-mono"
                      style={{ color: "#0847F7" }}
                    >
                      $
                      {typeof order.amount === "number"
                        ? order.amount.toFixed(2)
                        : Number(order.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span
                        className={cn("px-3 py-1 text-xs font-semibold")}
                        style={{
                          borderRadius: "4px",
                          background:
                            order.settledWin === true
                              ? "rgba(46,189,133,0.12)"
                              : order.settledWin === false
                                ? "rgba(246,70,93,0.12)"
                                : "rgba(255,255,255,0.06)",
                          color:
                            order.settledWin === true
                              ? "#2EBD85"
                              : order.settledWin === false
                                ? "#F6465D"
                                : "#d0d0d0",
                        }}
                      >
                        {order.settledWin === true
                          ? "WIN"
                          : order.settledWin === false
                            ? "LOSE"
                            : order.status || "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div
          className="flex items-center justify-between px-5 py-4 mt-auto"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}
        >
          <button
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="bg-[#0847F7] flex items-center gap-1 px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span className="relative z-10 flex items-center gap-1">
              <ChevronLeft size={15} /> Previous
            </span>
          </button>
          <span className="text-xs font-medium" style={{ color: "#d0d0d0" }}>
            Page {page + 1}
          </span>
          <button
            disabled={orders.length !== 20 || loading}
            onClick={() => setPage((p) => p + 1)}
            className="bg-[#0847F7] flex items-center gap-1 px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span className="relative z-10 flex items-center gap-1">
              Next <ChevronRight size={15} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
