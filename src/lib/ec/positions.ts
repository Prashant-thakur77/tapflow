// TapFlow — what a wallet holds: open Up/Down in a window, and settled
// windows with winnings waiting to be claimed. Winnings are claimed, not
// received: a settled market pays out only when someone asks it to.

import type { SomniaMarkets, SomniaMarketsClient, ClaimablePosition } from "@somnia-chain/markets-sdk";
import type { Address, Hex } from "viem";
import { assertTxOk } from "./exchange";
import type { TapWindow } from "./markets";

export interface WindowPosition {
  up: bigint;
  down: bigint;
}

export async function windowPosition(
  client: SomniaMarketsClient,
  account: Address,
  w: TapWindow,
): Promise<WindowPosition> {
  const [up, down] = await Promise.all([
    client.getOutcomeBalance({ outcomeToken: w.outcomeToken, account, id: w.yesId }),
    client.getOutcomeBalance({ outcomeToken: w.outcomeToken, account, id: w.noId }),
  ]);
  return { up, down };
}

export type Claimable = ClaimablePosition;

/**
 * Settled positions with a payout. The SDK's derived read is indexer-backed and
 * goes dark with it, so when it fails we rebuild the list from the taps this
 * wallet made (their marketIds) and chain reads only.
 */
export async function listClaimable(client: SomniaMarketsClient, account: Address, knownTaps: { marketId: string; side: "UP" | "DOWN" }[] = []): Promise<Claimable[]> {
  try {
    return await client.getClaimable(account);
  } catch (e) {
    if (!knownTaps.length) throw e;
    console.warn(`[tapflow] getClaimable failed (${String(e).slice(0, 80)}) — rebuilding from chain`);
    return listClaimableFromTaps(client, account, knownTaps);
  }
}

/** Chain-only claimables: for each window this wallet tapped, read the result and the outcome balance. */
export async function listClaimableFromTaps(client: SomniaMarketsClient, account: Address, taps: { marketId: string; side: "UP" | "DOWN" }[]): Promise<Claimable[]> {
  const ids = [...new Set(taps.map((t) => t.marketId.toLowerCase()))].slice(0, 40);
  const out: Claimable[] = [];
  await Promise.all(
    ids.map(async (marketId) => {
      try {
        const oc = await client.getMarketOnchain(marketId as Hex);
        if (!oc.isResolved && !oc.isVoided) return;
        const sides: (0 | 1)[] = oc.isVoided ? [0, 1] : [oc.winningOutcome === 0 ? 0 : 1];
        for (const outcomeIdx of sides) {
          const amount = await client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account, id: outcomeIdx === 0 ? oc.yesId : oc.noId });
          if (amount <= 0n) continue;
          out.push({ marketId, pool: oc.pool.toLowerCase(), outcomeIdx, amount, estPayout: oc.isVoided ? amount / 2n : amount, status: oc.isVoided ? "Voided" : "Resolved" });
        }
      } catch {
        /* skip this market this time */
      }
    }),
  );
  return out;
}

/** Redeem one settled position. Redeeming a loser succeeds and pays nothing, so only pass winners. */
export async function claim(ex: SomniaMarkets, pos: Claimable) {
  const res = await ex.trader.redeem({
    marketId: pos.marketId as Hex,
    amount: pos.amount,
    outcomeIdx: pos.outcomeIdx,
  });
  assertTxOk(res, `claim ${pos.marketId}`);
  return res;
}

/**
 * Redeem every winner in one transaction (all-or-nothing); if the batch
 * reverts, fall back to one redeem per position so one bad entry can't block
 * the rest. Adapted from dreamdex-bot-kit's claim sweep (MIT, DreamDEX S.A.).
 */
export async function claimAll(ex: SomniaMarkets, positions: Claimable[]): Promise<{ claimed: number; hash?: Hex }> {
  // The claimable list is indexer-backed and can offer a position that was
  // already redeemed; redeeming it reverts and still costs gas. Confirm on chain.
  const checked = await Promise.all(
    positions
      .filter((p) => p.amount > 0n && p.estPayout > 0n)
      .map(async (p) => {
        try {
          const oc = await ex.client.getMarketOnchain(p.marketId as Hex);
          const held = await ex.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account: ex.walletAddress!, id: p.outcomeIdx === 0 ? oc.yesId : oc.noId });
          if (held === 0n) return null;
          return held < p.amount ? { ...p, amount: held } : p;
        } catch {
          return null;
        }
      }),
  );
  const winners = checked.filter((p): p is Claimable => p !== null);
  if (!winners.length) return { claimed: 0 };
  try {
    const res = await ex.trader.redeemMany({ entries: winners.map((p) => ({ marketId: p.marketId as Hex, outcomeIdx: p.outcomeIdx, amount: p.amount })) });
    assertTxOk(res, "redeemMany");
    return { claimed: winners.length, hash: res.hash as Hex };
  } catch (e) {
    if (winners.length === 1) throw e;
  }
  let n = 0;
  let last: Hex | undefined;
  for (const p of winners) {
    const res = await claim(ex, p);
    last = res.hash as Hex;
    n++;
  }
  return { claimed: n, hash: last };
}
