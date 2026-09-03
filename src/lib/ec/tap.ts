// TapFlow — the tap primitive: "stake X tUSDC on UP/DOWN" → one IOC order.
//
// Sizing uses the SDK's stake quote over the live YES book: walk the asks
// cheapest-first, keep the escrow at the worst level within the stake, pad the
// protective limit by a slippage cushion so the IOC still crosses a moving
// book, and align to the tick/lot grid. Buying needs no minted set — the pool
// mints the pair from the two sides' collateral when opposite buyers cross.

import {
  ORDER_TYPE,
  quoteBinaryStakeOverBook,
  type BinaryOrderBook,
  type SomniaMarkets,
  type SomniaMarketsClient,
} from "@somnia-chain/markets-sdk";
import type { Hex } from "viem";
import { LOT, ONE, TICK } from "./config";
import { assertTxOk } from "./exchange";
import type { TapWindow } from "./markets";

export type Side = "UP" | "DOWN";

export interface TapQuote {
  side: Side;
  /** Stake in raw collateral units — the max loss. */
  stake: bigint;
  /** Outcome tokens the order will buy (raw). */
  quantity: bigint;
  /** Protective limit in YES terms (raw) — what placeOrder takes. */
  limitYesPrice: bigint;
  /** Worst-case collateral the order can escrow at the protective limit (raw), ≤ stake. */
  escrow: bigint;
  /** Expected cost at today's book (raw), walking the asks for `quantity`. */
  expectedCost: bigint;
  /** Expected average price per share in the side's own terms, in (0,1). */
  avgPrice: number;
  /** Best ask on this side, own terms — the book's implied probability of winning. */
  impliedProb: number;
  /** 1 collateral per winning share. */
  payoutIfWin: bigint;
  /** payoutIfWin − expectedCost. */
  profitIfWin: bigint;
}

export interface TapResult {
  hash: Hex;
  /** Shares filled (raw). 0 = the book moved and the IOC filled nothing. */
  filled: bigint;
  /** Collateral actually paid (raw), valued at each fill's price. */
  paid: bigint;
  /** Average fill price in the side's own terms. */
  avgPrice: number;
  orderId?: bigint;
}

export const sideToBuy = (s: Side): "BUY_YES" | "BUY_NO" => (s === "UP" ? "BUY_YES" : "BUY_NO");

/** Expected cost of buying `qty` by walking the asks cheapest-first (own terms). */
function walkAsks(levels: readonly { price: bigint; quantity: bigint }[], qty: bigint) {
  let remaining = qty;
  let cost = 0n;
  for (const l of levels) {
    if (remaining <= 0n) break;
    const take = remaining < l.quantity ? remaining : l.quantity;
    cost += (take * l.price) / ONE;
    remaining -= take;
  }
  return { cost, filled: qty - remaining };
}

/** Best ask for each side in own-probability terms, from a raw YES book. */
export interface TopOfBook {
  up: number | null;
  down: number | null;
}

export async function readTop(client: SomniaMarketsClient, w: TapWindow): Promise<TopOfBook> {
  const book = await client.getBinaryOrderBook(w.pool, { depth: 1 });
  const yesAsk = book.yesAsks[0]?.price;
  const noAsk = book.noAsks[0]?.price;
  return {
    up: yesAsk !== undefined ? Number(yesAsk) / Number(ONE) : null,
    down: noAsk !== undefined ? Number(noAsk) / Number(ONE) : null,
  };
}

export async function quoteTap(
  client: SomniaMarketsClient,
  w: TapWindow,
  side: Side,
  stake: bigint,
  opts: { slippageBps?: bigint; depth?: number } = {},
): Promise<TapQuote | null> {
  const book = await client.getBinaryOrderBook(w.pool, { depth: opts.depth ?? 10 });
  return quoteFromBook(book, side, stake, opts);
}

/** Pure: size a tap against a book snapshot (the live-store book in the UI). */
export function quoteFromBook(
  book: BinaryOrderBook,
  side: Side,
  stake: bigint,
  opts: { slippageBps?: bigint } = {},
): TapQuote | null {
  const q = quoteBinaryStakeOverBook(book, sideToBuy(side), stake, ONE, {
    tickSize: TICK,
    lotSize: LOT,
    slippageBps: opts.slippageBps ?? 300n,
    slippageMinTicks: 10n,
  });
  if (!q || q.quantity <= 0n) return null;
  const asks = side === "UP" ? book.yesAsks : book.noAsks;
  const { cost } = walkAsks(asks, q.quantity);
  const best = asks[0]?.price;
  return {
    side,
    stake,
    quantity: q.quantity,
    limitYesPrice: q.yesPrice,
    escrow: q.escrow,
    expectedCost: cost,
    avgPrice: Number(cost) / Number(q.quantity),
    impliedProb: best !== undefined ? Number(best) / Number(ONE) : Number(cost) / Number(q.quantity),
    payoutIfWin: q.quantity,
    profitIfWin: q.quantity - cost,
  };
}

/**
 * Send the tap as an IOC order. The SDK approves collateral to the pool on the
 * first tap (autoApprove), simulates nothing, and returns the receipt — so we
 * check it. Expiry is capped at the market's own.
 */
export async function placeTap(
  ex: SomniaMarkets,
  w: TapWindow,
  q: TapQuote,
  opts: { expiresInSec?: number } = {},
): Promise<TapResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = Math.min(nowSec + (opts.expiresInSec ?? 120), w.expiry);
  if (expiresAt <= nowSec) throw new Error("window already closed");

  const res = await ex.trader.placeOrder({
    pool: w.pool,
    side: sideToBuy(q.side),
    price: q.limitYesPrice,
    quantity: q.quantity,
    outcomeToken: w.outcomeToken,
    yesId: w.yesId,
    noId: w.noId,
    collateral: w.collateral,
    orderType: ORDER_TYPE.MARKET,
    expireTimestampNs: BigInt(expiresAt) * 1_000_000_000n,
  });
  assertTxOk(res, `${q.side} ${w.asset} ${w.intervalSec / 60}m`);

  let filled = 0n;
  let paid = 0n;
  for (const f of res.fills ?? []) {
    const own = q.side === "UP" ? f.fillPrice : ONE - f.fillPrice;
    filled += f.quantityFilled;
    paid += (f.quantityFilled * own) / ONE;
  }
  return {
    hash: res.hash,
    filled,
    paid,
    avgPrice: filled > 0n ? Number(paid) / Number(filled) : 0,
    orderId: res.orderId,
  };
}
