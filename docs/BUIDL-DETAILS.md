https://youtu.be/xzKF1KN3L9E

## Problem

Trading a prediction market is a solo activity. You connect a wallet, approve a token, read an order book, sign, and wait. If you find someone who trades these windows well, there is no way to follow them on chain in time to matter.

Copy trading products solve this with bots and relayers. They watch for the leader's transaction, then send their own, which means the copy lands at least one block later. DreamDEX windows run as short as five minutes, and the price moves inside that gap.

## How TapFlow works

A tap is a real immediate-or-cancel order on the live on-chain book. We quote the stake over the book and size it on the venue's tick and lot grid, so the order is priced the way the venue expects rather than rounded by us. Funding a capped session wallet takes two signatures, after which taps and claims sign themselves without a wallet popup.

Copying works differently from the bot approach. The leader's tap is broadcast through a Router contract. Somnia's reactivity precompile invokes our CopyHandler inside the block that emits the event, and the handler places each follower's proportional order through a capped MirrorVault. There is no keeper process and no relayer, because nothing is watching for the event off chain.

## What is on chain

| Measure | Value |
|---|---|
| Reactive mirrors placed | 102 |
| Landed in the leader's block | 102 (100%) |
| Filled | 71 |
| Declined with an on-chain reason code | 31 |
| Wallets, taps, volume, windows indexed | 416 / 13,696 / 87,230 tUSDC / 772 |
| Foundry tests | 19 of 19 |

Block [485621955](https://shannon-explorer.somnia.network/block/485621955) contains a leader broadcast and the follower's mirror. Opening the reactive transaction shows status Success, method `onEvent`, and the sender is the CopyHandler contract rather than an externally owned account.

The [proof page](https://tapflow-phi.vercel.app/proof) pairs every mirror with the broadcast that triggered it, and links both to the explorer.

## When a mirror does not fill

31 of the 102 mirrors placed no order, and the contract records why. The cause is structural: the leader's own IOC order consumes the book at their limit price, so a follower priced identically finds nothing microseconds later.

The current version pays a bounded cushion over the leader, capped at 15% of the leg, 5 points, and never above 97 cents or below the leader's own price. Quantities are floored to the venue lot so an off-grid size cannot revert silently. Every mirror that fills nothing returns a reason code that the handler writes on chain. A second reactive contract, RiskGuard, pauses a follower once they hit their configured max loss.

## Features

Tap screen with the countdown, price against the window open, crowd odds built from one-minute candles, and the positions on that window read from the pool's own logs. Payout is shown on the button rather than the raw odds. Arrow keys place taps.

Session keys, capped and expiring after 30 minutes, with unspent funds swept back.

Four contracts: Router, MirrorVault, CopyHandler, RiskGuard, with two funded reactivity subscriptions.

An indexer that builds fills, windows and results from pool logs. The upstream indexer times out often enough that we treat it as optional: the app starts both sources together and uses whichever answers first.

TapBot, a momentum agent that trades as a public leader anyone can follow. It runs behind a risk gate and publishes the trades it declines along with the reason, such as price above 90 cents, spread wider than the edge, or a cooldown. It claims its own winnings.

A Telegram bot, [@TapFlowSomniaBot](https://t.me/TapFlowSomniaBot). `/window` reads the live book, `/up 5` places a real order from the chat and replies with the fill and transaction, `/board` is the leaderboard, and the app opens as a mini-app.

Embeddable tap cards, so another Somnia app can drop a live window into an iframe.

## Contracts on Somnia Shannon (chain 50312)

| Contract | Address |
|---|---|
| Router | [`0x512009743f48A924F679907ca9E206b706d499Cc`](https://shannon-explorer.somnia.network/address/0x512009743f48A924F679907ca9E206b706d499Cc) |
| MirrorVault | [`0x535A2F473f073AB27FAd8F65ECD5Fe1203C8aE95`](https://shannon-explorer.somnia.network/address/0x535A2F473f073AB27FAd8F65ECD5Fe1203C8aE95) |
| CopyHandler | [`0x969B4F8c0106379b553232D9aFcf35B77F32b321`](https://shannon-explorer.somnia.network/address/0x969B4F8c0106379b553232D9aFcf35B77F32b321), subscription 16910004 |
| RiskGuard | [`0x03A52EE60b30537fa57C889795576E63CFCaE3b7`](https://shannon-explorer.somnia.network/address/0x03A52EE60b30537fa57C889795576E63CFCaE3b7), subscription 17880662 |

## SDK surface used

`listLiveBinaryMarkets`, `getMarketOnchain`, `getBinaryOrderBook`, `getBinaryBookParams`, `quoteBinaryStakeOverBook`, `trader.placeOrder` with IOC, `trader.faucet`, `getOutcomeBalance`, `getClaimable`, `trader.redeem`, `getUserFills`, `getFills`, `fetchPrice`, `useLivePriceTicks`, and the React live hooks. Reactivity comes from `@somnia-chain/reactivity-contracts`, using `SomniaEventHandler` and `SomniaExtensions.subscribe`.

The repo includes `SDK-FEEDBACK.md`, 20 items covering what was unclear or cost us time in the SDK and the docs.

## Links

App: https://tapflow-phi.vercel.app. No wallet is needed to look around, since every page reads from chain.

Proof: https://tapflow-phi.vercel.app/proof

Telegram: https://t.me/TapFlowSomniaBot

Code: https://github.com/Prashant-thakur77/tapflow

## Limitations

This runs on Somnia Shannon testnet and the keys used in the demo are throwaways. The session key is stored in `localStorage` with a spending cap, which suits a testnet demo but is not the right pattern for mainnet; the non-custodial operator route is researched in the repo but not shipped. 1.30 winning shares are stranded in a retired vault from before an upgrade that added redemption, and the README says so rather than leaving it out.
