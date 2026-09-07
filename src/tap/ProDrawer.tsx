import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { BinaryOrderBook } from "@somnia-chain/markets-sdk";
import { EXPLORER_URL, ONE, fmtUsdc, short, type Grid, type Side, type TapQuote, type TapWindow } from "../lib/ec";

const cents = (raw: bigint) => `${Math.round((Number(raw) / Number(ONE)) * 100)}¢`;

/** The CLOB underneath the tap: order details, book depth, grid, ids. For the trader-judge. */
export const ProDrawer: React.FC<{ w: TapWindow; book: BinaryOrderBook | null; grid?: Grid; quote: TapQuote | null; side: Side; stake: number }> = ({ w, book, grid, quote, side, stake }) => {
  const [open, setOpen] = useState(false);
  const yesBid = book?.yesBids[0]?.price;
  const yesAsk = book?.yesAsks[0]?.price;
  const spread = yesBid !== undefined && yesAsk !== undefined ? Number(yesAsk - yesBid) / Number(ONE) : null;
  const mid = yesBid !== undefined && yesAsk !== undefined ? Number(yesAsk + yesBid) / 2 / Number(ONE) : null;

  return (
    <div className="tf-card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-bn-text-dim hover:text-white">
        <span className="uppercase tracking-widest">order details · book</span>
        <span className="flex items-center gap-2 font-mono">
          {mid !== null ? `mid ${Math.round(mid * 100)}¢` : "—"}
          {spread !== null ? <span className="text-bn-text-muted">· spread {(spread * 100).toFixed(1)}¢</span> : null}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {open ? (
        <div className="px-3 pb-3 text-[11px] grid sm:grid-cols-2 gap-3">
          <div className="space-y-1 font-mono">
            <Row k={`cost (max loss) · ${side}`} v={quote ? `${fmtUsdc(quote.expectedCost)} of ${stake} tUSDC` : "—"} />
            <Row k="shares" v={quote ? fmtUsdc(quote.quantity) : "—"} />
            <Row k="profit if you win" v={quote ? `+${fmtUsdc(quote.profitIfWin)}` : "—"} />
            <Row k="implied odds" v={quote ? `${Math.round(quote.impliedProb * 100)}%` : "—"} />
            <Row k="protective limit (YES)" v={quote ? cents(quote.limitYesPrice) : "—"} />
            <Row k="order type" v="IOC · taker" />
            <Row k="tick / lot / min" v={grid ? `${cents(grid.tickSize)} / ${fmtUsdc(grid.lotSize, 3)} / ${fmtUsdc(grid.minQuantity, 3)}` : "—"} />
            <Row k="expires" v={new Date(w.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} />
            <Row k="window volume" v={`${w.volumeUsdc.toFixed(2)} tUSDC · ${w.trades} fills`} />
            <Row k="pool" v={<a className="text-accent-soft" href={`${EXPLORER_URL}/address/${w.pool}`} target="_blank" rel="noreferrer">{short(w.pool)}</a>} />
            <Row k="marketId" v={short(w.marketId, 6)} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-bn-text-muted mb-1">YES book (price · size)</div>
            {book ? (
              <div className="font-mono grid grid-cols-2 gap-x-3">
                <div>
                  <div className="text-down text-[10px] mb-0.5">asks</div>
                  {book.yesAsks.slice(0, 5).map((l, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-down">{cents(l.price)}</span>
                      <span className="text-bn-text-dim">{fmtUsdc(l.quantity, 1)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-up text-[10px] mb-0.5">bids</div>
                  {book.yesBids.slice(0, 5).map((l, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-up">{cents(l.price)}</span>
                      <span className="text-bn-text-dim">{fmtUsdc(l.quantity, 1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-bn-text-muted">book loading…</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Row: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex justify-between gap-3">
    <span className="text-bn-text-muted">{k}</span>
    <span className="text-white text-right">{v}</span>
  </div>
);
