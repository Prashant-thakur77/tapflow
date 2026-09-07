# SDK & docs feedback — from building TapFlow

Concrete things that cost us time with `@somnia-chain/markets-sdk` 0.28.1, the
DreamDEX docs, and the Shannon testnet stack. Each item: what we hit, what we
did, what would have helped. Kept honest and specific; numbers are measured.

## 1. The public indexer is slow enough to shape the UX

`listLiveBinaryMarkets` took 2.1s, 4.0s and 5.5s on three consecutive calls
from Node, and 7–9s from a browser tab. `getOpeningPrices` for three ids took
7.7s. `getBookTops` for ten markets took 9.0s. `listPastBinaryMarkets` was the
fast one at 1.6s.

For a tap-to-trade UI that is the difference between "instant" and "is it
broken?". We ended up caching every on-chain wiring read per `marketId`,
polling the market list every 15s instead of 10s, and reading the book
on-chain instead of via the indexer. A note in the docs that the Shannon
indexer is shared and best-effort, plus a cheaper "live windows" endpoint
(or a WS `markets` channel), would have saved an afternoon.

## 2. `BinaryMarket.strike` is `"0"` on testnet rows

Every live row we saw had `strike: "0"` while `getOpeningPrices` returned the
real opening answer (`"7789395"`). Either populate `strike`, or document that
the opening price lives behind `getOpeningPrices` / `getMarketResolution`.

## 3. The opening price's scale is undocumented

`getOpeningPrices` returns an integer string (`"7789395"` for BTC at
$77,893.95) — two decimals — while `LivePrice.decimals` from the price feed is
a different scale. Nothing says which. We pick the scale that lands closest to
the live spot, which is a guess dressed up as a heuristic. Expose `decimals`
on the opening/resolution answer.

## 4. The live tail takes ~25s to hydrate a pool book

`useWatchMarket(pool)` + `useLiveBinaryOrderBookByMarket(marketId)` reported
`hydrating` for roughly 25 seconds before the first book arrived in a fresh
tab. A first-render UI cannot wait that long, so we poll `getBinaryOrderBook`
on-chain every 3s underneath and switch to the live book when it appears.
Documenting the expected hydration time (and offering a REST snapshot to seed
the store) would let apps skip the fallback.

## 5. `expireTimestampNs` default and the "no GTC" rule are easy to miss

The default expiry is the market's own expiry, and anything later reverts
with `OrderExpiryBeyondMarket`. This is documented in the type's JSDoc but not
in the Event Contracts quick start. A one-liner there would help.

## 6. The SDK does not simulate writes, and a reverted receipt does not throw

`trader.placeOrder` resolves `{ hash, receipt }` even when `receipt.status ===
"reverted"`. The bot kit's `assertTxOk` exists precisely because of this. We
also re-read the market status right before every tap so a locked window
fails locally instead of as a reverted tx. Consider throwing on a reverted
receipt by default, or at least an `assertOk` option.

## 7. Session keys for Event Contracts are documented under Spot only

"Operators & Session Keys" lives at `/trading/readme-1/operators` and talks
about SpotPools. The binary pool ABI has `placeBinaryOrderFor` and the SDK
has `setOperatorApprovalForPool`, but nothing in the Event Contracts section
says whether the same `OperatorPermissionsRegistry` grants cover binary pools.
We had to grep the ABI to find out.

## 8. Venue ids move; the SDK cannot tell you the current one

The bot kit says the venue id changed three times in one week. The SDK has no
"which venue are the live markets on" helper; we copied `resolveVenue` logic
from the bot kit. A `client.listVenues()` or a documented stable alias would
remove a whole class of "why do I see no markets" bugs.

## 9. Reactivity needs 32 STT in the subscribing wallet

Not an SDK issue, but the docs bury it: `subscribe` on `0x0100` reverts unless
the owner holds ≥ 32 SOMI/STT. The public faucet does not hand out that much.
Hackathon docs should say "ask for 32 STT in the faucet topic if you plan to
use reactivity".

## 10. Small things

- `viem/chains.somniaTestnet` points at `api.infra.testnet.somnia.network`;
  the hackathon brief says `dream-rpc.somnia.network`. Both work; say which
  one is preferred.
- Under `tsx`, a `.ts` script with top-level `await` fails to transform
  ("cjs output format") unless the file is `.mts` or the package is
  `"type": "module"`. The starter template avoids this with `.mjs`; a note in
  the SDK README would help TypeScript users.
- `getMarketOnchain` results contain bigints, so `JSON.stringify` throws.
  Expected, but a `toJSON`-friendly variant for logging would be nice.

## 11. No delegated binary write in the SDK (blocks non-custodial session keys)

The owner-side operator admin calls are all there — `setOperatorApprovalForPool`,
`setOperatorApprovalGlobal`, `setManualVaultMode`, `depositVault` — and the
binary pool ABI has `placeBinaryOrderFor(address owner, …)`. But the SDK's
`trader.placeOrder` has no `owner`/`onBehalfOf`, and there is no
`trader.placeBinaryOrderFor` wrapper. So an operator (session) key cannot place
a binary order *for* an owner through the SDK without dropping to raw viem. We
shipped a capped session **wallet** instead and stubbed the operator path
(`src/lib/ec/operator.ts`) pending that wrapper. A `placeOrderFor` on the trader
would make non-custodial session keys a few lines.

## 12. Operators docs are spot-only

`/trading/readme-1/operators` documents the registry against SpotPools. Nothing
in the Event Contracts section confirms the same `OperatorPermissionsRegistry`
grants (`placeOrderFor` selector `0x80054449`) apply to binary pools, or which
registry address to use. We inferred it from the ABI. A one-line note would help.

## 13. Reactivity: the 32-STT floor bites the *contract*, not the EOA

`SomniaExtensions.subscribe` checks `address(this).balance >= 32 ether`, where
`this` is the subscribing **contract**. So each handler contract must itself hold
32 STT at subscribe time — two handlers means ~64 STT, which is a lot of faucet
STT for a hackathon. Worth calling out prominently in the reactivity quickstart,
and the faucet should hand out enough on request.

## 14. Small Foundry/Somnia build notes (reactivity-contracts)

- `@somnia-chain/reactivity-contracts` pins `pragma solidity 0.8.30`, so your
  whole project must be on 0.8.30. Fine, but pin it in the README.
- A public constant on one contract is not readable as `Other.CONST` from another
  contract (Solidity rule, not Somnia) — expose it as a file-level constant or an
  instance getter. Minor, but a copy-paste trap when wiring a handler to an
  emitter's event topic.
- Building a `deployments.json` string with `string.concat` + several
  `vm.toString` in a deploy script hits "stack too deep" without `via_ir`. Ship
  the reactivity examples with `via_ir = true` so newcomers don't chase it.

## 15. The venue's lot size changed to 1000 — and it's only discoverable on-chain

The bot kit's `ec-core/config.ts` says testnet "accepted orders down to 1 raw
unit, i.e. no lot constraint" (measured July). On 7 Sep every live pool reports
`getOrderBookParameters() = (tick 1000, minQuantity 1000, lot 1000)`, and any
off-grid quantity reverts with `InvalidQuantity(qty, 1000)` — a custom error the
SDK does not decode, so it surfaces as "Execution reverted for an unknown
reason". Two asks: (a) decode the pool's custom errors in the SDK's revert path;
(b) have `quoteBinaryStakeOverBook` default to the pool's live
`getBinaryBookParams` rather than caller-supplied constants, or at least have the
docs say "read it, don't hardcode it". Binary market rows still carry no
`tickSize`/`lotSize`, so there is nothing to read from the indexer either.

## 16. `forge script` cannot deploy a reactive handler on Somnia (two separate reasons)

1. Any script that calls `SomniaExtensions.subscribe` fails in Foundry's local
   run with "call to non-contract address 0x…0100": the precompile has no
   bytecode, so Solidity's high-level call reverts on the code-size check
   before a single tx is broadcast. `--skip-simulation` does not help because
   the script itself must execute locally to produce the transactions.
2. Even deploy-only scripts fail: Foundry sizes `CREATE` gas from its local
   EVM and Somnia prices creation ~10× higher (Router used **1,951,982** gas
   against ~200k locally). At the default 130% multiplier and at 400% every
   deployment ran out of gas with status 0.

What worked: `forge create --gas-limit 20000000` per contract, then `cast send`
for wiring/funding/`subscribe` **without** `--gas-limit` so the node's
`eth_estimateGas` sizes it. The reactivity docs should show exactly this, and
ideally ship a `vm.etch` shim for `0x0100` so scripts can at least simulate.

## 17. Somnia's state-creation gas will surprise every hackathon team

Measured on Shannon (all status 1, gas used):

| Action | Gas used | Why it's big |
|---|---|---|
| Plain STT transfer to a never-funded address | 421,000 | account creation |
| tUSDC `transfer` to a first-time holder | 262,180 | fresh balance slot |
| `approve` (fresh allowance slot) | 259,745 | fresh slot |
| `MirrorVault.setWiring` (2 fresh slots) | 451,587 | 2 fresh slots |
| `MirrorVault.setFollow` (struct + mapping + array push) | 1,281,223 | ~6 fresh slots |
| `SomniaExtensions.subscribe` | 459,154 | precompile + storage |

A 21k-pinned transfer or a 300k "safe" limit silently burns the whole limit
with status 0. The docs mention this once under gas differences; it deserves a
box at the top of every quickstart, plus a note that `eth_estimateGas` on the
node pads 2–5× and should be trusted over any client-side estimate.
