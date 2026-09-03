// TapFlow — non-custodial session keys via the OperatorPermissionsRegistry.
//
// The upgrade path from the custodial session wallet in session.ts. The owner
// grants a hot operator key the `placeOrderFor` selector on the venue's pools
// and funds a manual-mode vault; the operator then trades against that vault and
// can never withdraw. Every fill settles to the owner.
//
// STATUS: implemented against the SDK's documented owner-side admin calls, but
// NOT yet verified on-chain (needs a funded Shannon key). The tap path would
// place through `placeBinaryOrderFor(owner, …)` — the ABI is below. Wire this in
// only after confirming the grant + delegated placement against a live pool.

import type { Address, Hex } from "viem";
import type { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { ADDRESSES } from "./config";

/** OperatorPermissionsRegistry (Shannon testnet). */
export const OPERATOR_REGISTRY: Address = "0x15C7e8CE38F021c5b45d098AaD788f63090bF20A";

/** Selector grants (docs.dreamdex.io/trading/readme-1/operators). */
export const SELECTOR = {
  placeOrderFor: "0x80054449" as Hex,
  cancelOrderFor: "0xe37b444b" as Hex,
  reduceOrderFor: "0x364c2587" as Hex,
};

/** placeBinaryOrderFor — the delegated write the operator uses for a tap. */
export const PLACE_BINARY_ORDER_FOR_ABI = [
  {
    type: "function",
    name: "placeBinaryOrderFor",
    stateMutability: "payable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "kind", type: "uint8" },
      { name: "price", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "expireTimestampNs", type: "uint64" },
      { name: "orderType", type: "uint8" },
      { name: "selfMatchingOption", type: "uint8" },
      { name: "builder", type: "address" },
      { name: "builderFeeBpsTimes1k", type: "uint96" },
      { name: "userData", type: "uint64" },
    ],
    outputs: [
      { name: "success", type: "bool" },
      { name: "id", type: "uint128" },
    ],
  },
] as const;

/**
 * Owner-side one-time grant: approve the operator to place (and cancel) for the
 * owner on a pool, put the pool in manual vault mode, and deposit working
 * capital. Signed by the OWNER's wallet. Returns the tx hashes.
 */
export async function grantOperator(
  ex: SomniaMarkets,
  opts: { operator: Address; pool: Address; depositUsdcRaw: bigint },
): Promise<{ grant: Hex; manual: Hex; deposit: Hex }> {
  const grant = await ex.trader.setOperatorApprovalForPool({
    pool: opts.pool,
    operator: opts.operator,
    selectors: [SELECTOR.placeOrderFor, SELECTOR.cancelOrderFor],
    approved: true,
    operatorRegistry: OPERATOR_REGISTRY,
  });
  const manual = await ex.trader.setManualVaultMode({ pool: opts.pool, enabled: true });
  const deposit = await ex.trader.depositVault({
    vault: opts.pool,
    token: ADDRESSES.testUsdc as Address,
    amount: opts.depositUsdcRaw,
  });
  return { grant: grant.hash, manual: manual.hash, deposit: deposit.hash };
}
