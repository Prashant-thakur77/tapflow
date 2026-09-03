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
