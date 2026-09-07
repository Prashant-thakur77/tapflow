/**
 * @license
 * Adapted from dreamdex-bot-kit/packages/ec-core/src/claim.ts
 * Copyright DreamDEX S.A.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/somnia-chain/dreamdex-bot-kit/blob/main/LICENSE
 */

// Collecting winnings, which nothing else does for you. A settled market pays
// out only when you ask. It is a LOOP call, not a timer: claiming signs with
// the same key the strategy trades with, and two senders on one key race each
// other's nonce. Driving it from the loop serialises it for free.

import type { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { Hex } from "viem";
import { assertTxOk, fmtUsdc, txUrl } from "./ec.js";

let lastSweepAt = 0;

export interface ClaimOutcome {
  claimed: number;
  payoutUsdc: string;
  hash?: Hex;
}

/** Sweep everything claimable for the bot wallet. Throttled; safe to call every tick. */
export async function maybeClaim(ex: SomniaMarkets, opts: { intervalMs?: number; force?: boolean } = {}): Promise<ClaimOutcome | null> {
  const interval = opts.intervalMs ?? 10 * 60_000;
  if (!opts.force && Date.now() - lastSweepAt < interval) return null;
  lastSweepAt = Date.now();
  const addr = ex.walletAddress;
  if (!addr) return null;

  const claimable = await ex.client.getClaimable(addr);
  const winners = claimable.filter((c) => c.amount > 0n && c.estPayout > 0n);
  if (!winners.length) return { claimed: 0, payoutUsdc: "0" };

  const payout = winners.reduce((s, c) => s + c.estPayout, 0n);
  try {
    // one tx for all of them (all-or-nothing) …
    const res = await ex.trader.redeemMany({ entries: winners.map((c) => ({ marketId: c.marketId as Hex, outcomeIdx: c.outcomeIdx, amount: c.amount })) });
    assertTxOk(res, "redeemMany");
    return { claimed: winners.length, payoutUsdc: fmtUsdc(payout), hash: res.hash };
  } catch (e) {
    console.warn("redeemMany failed, falling back to one-by-one:", (e as Error).message.slice(0, 120));
  }
  // … or one by one when a single bad entry poisons the batch.
  let n = 0;
  let last: Hex | undefined;
  for (const c of winners) {
    try {
      const res = await ex.trader.redeem({ marketId: c.marketId as Hex, outcomeIdx: c.outcomeIdx, amount: c.amount });
      assertTxOk(res, `redeem ${c.marketId.slice(-6)}`);
      last = res.hash;
      n++;
      console.log(`claimed ${fmtUsdc(c.estPayout)} tUSDC from …${c.marketId.slice(-6)} → ${txUrl(res.hash)}`);
    } catch (e) {
      console.warn(`claim …${c.marketId.slice(-6)} failed:`, (e as Error).message.slice(0, 120));
    }
  }
  return { claimed: n, payoutUsdc: fmtUsdc(payout), hash: last };
}
