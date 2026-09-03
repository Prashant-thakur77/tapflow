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

/** Settled positions with a payout, straight from the SDK's derived read. */
export async function listClaimable(client: SomniaMarketsClient, account: Address): Promise<Claimable[]> {
  return client.getClaimable(account);
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
