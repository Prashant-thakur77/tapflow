// Self-contained DreamDEX Event Contracts helpers for TapBot (node-safe mirror
// of the web app's src/lib/ec). Same rules: gate on on-chain status, size a
// stake over the YES/NO book, send an IOC, check the receipt, cap expiry.
//
// `assertTxOk` adapted from dreamdex-bot-kit/packages/ec-core/src/exchange.ts
// (MIT, Copyright DreamDEX S.A.).

import {
  ORDER_TYPE,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
  SomniaMarkets,
  quoteBinaryStakeOverBook,
  type BinaryOrderBook,
  type MarketOnchain,
  type SomniaMarketsClient,
} from "@somnia-chain/markets-sdk";
import { defineChain, type Address, type Hex } from "viem";
import { config } from "./config.js";

export const DECIMALS = 6;
export const ONE = 10n ** BigInt(DECIMALS);
export const TICK = 1_000n;
export const LOT = 1n;
export const COLLATERAL: Address = SOMNIA_TESTNET_ADDRESSES.testUsdc ?? "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E";

export const somniaShannon = defineChain({
  id: config.chainId,
  name: "Somnia Shannon",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl], webSocket: [config.wsRpcUrl] } },
  blockExplorers: { default: { name: "Shannon Explorer", url: config.explorerUrl } },
  testnet: true,
});

let exchange: SomniaMarkets | undefined;
export function getExchange(): SomniaMarkets {
  exchange ??= new SomniaMarkets({
    chain: somniaShannon,
    addresses: SOMNIA_TESTNET_ADDRESSES,
    wsRpcUrl: config.wsRpcUrl,
    indexerUrl: config.indexerUrl,
    priceFeed: SOMNIA_TESTNET_PRICE_FEED,
    privateKey: config.botPrivateKey,
  });
  return exchange;
}
export const getClient = (): SomniaMarketsClient => getExchange().client;
export const canTrade = () => Boolean(config.botPrivateKey);

export function assertTxOk(res: { hash?: string; receipt?: { status?: string } }, label = "transaction"): void {
  if (res?.receipt?.status === "reverted") throw new Error(`${label} reverted on-chain (tx ${res.hash ?? "?"})`);
}

export type Asset = "BTC" | "ETH";
export type Side = "UP" | "DOWN";
export const ASSETS: readonly Asset[] = ["BTC", "ETH"] as const;

export const MARKET_STATUS = { Listed: 0, Trading: 1, Locked: 2, Settling: 3, Resolved: 4, Voided: 5 } as const;

export interface TapWindow {
  marketId: Hex;
  pool: Address;
  marketAddress: Address;
  asset: Asset;
  intervalSec: number;
  expiry: number;
  outcomeToken: Address;
  yesId: bigint;
  noId: bigint;
  collateral: Address;
}

const onchainCache = new Map<string, MarketOnchain>();
async function readOnchain(client: SomniaMarketsClient, marketId: Hex): Promise<MarketOnchain | null> {
  const key = marketId.toLowerCase();
  const hit = onchainCache.get(key);
  if (hit) return hit;
  try {
    const oc = await client.getMarketOnchain(marketId);
    onchainCache.set(key, oc);
    return oc;
  } catch {
    return null;
  }
}

export async function refreshStatus(client: SomniaMarketsClient, marketId: Hex): Promise<number> {
  const oc = await client.getMarketOnchain(marketId);
  onchainCache.set(marketId.toLowerCase(), oc);
  return oc.finalized ? MARKET_STATUS.Resolved : oc.status;
}

export async function listLiveWindows(client: SomniaMarketsClient, opts: { asset?: Asset } = {}): Promise<TapWindow[]> {
  const rows = await client.listLiveBinaryMarkets({ venueId: config.venueId, asset: opts.asset, limit: 40 });
  const onchain = await Promise.all(rows.map((r) => readOnchain(client, r.marketId)));
  const out: TapWindow[] = [];
  rows.forEach((r, i) => {
    const oc = onchain[i];
    const asset = r.asset === "BTC" || r.asset === "ETH" ? (r.asset as Asset) : null;
    if (!oc || !asset) return;
    if (oc.status !== MARKET_STATUS.Trading || oc.finalized) return;
    out.push({
      marketId: r.marketId,
      pool: oc.pool,
      marketAddress: oc.marketAddress,
      asset,
      intervalSec: Number(r.intervalSec ?? r.interval ?? 0),
      expiry: Number(oc.expiry),
      outcomeToken: oc.outcomeToken,
      yesId: oc.yesId,
      noId: oc.noId,
      collateral: oc.collateral,
    });
  });
  return out.sort((a, b) => a.expiry - b.expiry);
}

export const secondsLeft = (w: Pick<TapWindow, "expiry">, nowMs = Date.now()) => Math.max(0, w.expiry - nowMs / 1000);

export function pickWindow(windows: TapWindow[], asset: Asset, intervalSec: number, minLeftSec = 15): TapWindow | undefined {
  const series = windows.filter((w) => w.asset === asset && w.intervalSec === intervalSec).sort((a, b) => a.expiry - b.expiry);
  return series.find((w) => secondsLeft(w) >= minLeftSec) ?? series[0];
}

export interface TapQuote {
  side: Side;
  stake: bigint;
  quantity: bigint;
  limitYesPrice: bigint;
  escrow: bigint;
  expectedCost: bigint;
  avgPrice: number;
  impliedProb: number;
  payoutIfWin: bigint;
  profitIfWin: bigint;
}

const sideToBuy = (s: Side): "BUY_YES" | "BUY_NO" => (s === "UP" ? "BUY_YES" : "BUY_NO");

function walkAsks(levels: readonly { price: bigint; quantity: bigint }[], qty: bigint) {
  let remaining = qty;
  let cost = 0n;
  for (const l of levels) {
    if (remaining <= 0n) break;
    const take = remaining < l.quantity ? remaining : l.quantity;
    cost += (take * l.price) / ONE;
    remaining -= take;
  }
  return cost;
}

export function quoteFromBook(book: BinaryOrderBook, side: Side, stake: bigint): TapQuote | null {
  const q = quoteBinaryStakeOverBook(book, sideToBuy(side), stake, ONE, { tickSize: TICK, lotSize: LOT, slippageBps: 300n, slippageMinTicks: 10n });
  if (!q || q.quantity <= 0n) return null;
  const asks = side === "UP" ? book.yesAsks : book.noAsks;
  const cost = walkAsks(asks, q.quantity);
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

export async function readBook(client: SomniaMarketsClient, w: TapWindow, depth = 10): Promise<BinaryOrderBook> {
  return client.getBinaryOrderBook(w.pool, { depth });
}

export interface TapResult {
  hash: Hex;
  filled: bigint;
  paid: bigint;
  avgPrice: number;
}

export async function placeTap(ex: SomniaMarkets, w: TapWindow, q: TapQuote): Promise<TapResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = Math.min(nowSec + 120, w.expiry);
  if (expiresAt <= nowSec) throw new Error("window already closed");
  const status = await refreshStatus(ex.client, w.marketId);
  if (status !== MARKET_STATUS.Trading) throw new Error(`window is not trading (status ${status})`);

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
  assertTxOk(res, `${q.side} ${w.asset}`);
  let filled = 0n;
  let paid = 0n;
  for (const f of res.fills ?? []) {
    const own = q.side === "UP" ? f.fillPrice : ONE - f.fillPrice;
    filled += f.quantityFilled;
    paid += (f.quantityFilled * own) / ONE;
  }
  return { hash: res.hash, filled, paid, avgPrice: filled > 0n ? Number(paid) / Number(filled) : 0 };
}

export const txUrl = (hash: string) => `${config.explorerUrl}/tx/${hash}`;
export const fmtUsdc = (raw: bigint, dp = 2): string => {
  const abs = raw < 0n ? -raw : raw;
  const frac = (abs % ONE).toString().padStart(DECIMALS, "0").slice(0, dp);
  return `${raw < 0n ? "-" : ""}${abs / ONE}${dp ? "." + frac : ""}`;
};
export const toRaw = (human: number): bigint => {
  const [i, f = ""] = human.toFixed(DECIMALS).split(".");
  return BigInt(i + f.padEnd(DECIMALS, "0"));
};
export const fmtCadence = (sec: number) => (sec >= 3600 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);
