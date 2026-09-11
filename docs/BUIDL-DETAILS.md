# The Details field — paste this markdown into DoraHacks

Everything below the line goes into the "Details" box. It is plain markdown;
the YouTube link on its own line becomes an embedded player.

---

https://youtu.be/xzKF1KN3L9E

## The problem

Prediction markets are solo and slow to act on. Every trade is connect, approve, read an order book, sign, wait. And if you want to copy someone who is good at it, you can't — not on-chain, and not in time.

Copy trading everywhere else runs on bots and relayers that react **after** the leader's trade is already on chain. By the time your copy lands, the price has moved. On a five-minute window, a block late is too late.

## What TapFlow does

**One tap.** Every live DreamDEX Event Contract becomes a one-tap UP or DOWN call. Your stake becomes a real immediate-or-cancel order on the live on-chain book, quoted over the book and sized on the venue's own tick and lot grid. Fund a capped session wallet once — two signatures — and every tap and every claim after that signs itself. No wallet popup.

**Same block.** A leader's tap is broadcast through a `Router` contract. Somnia's reactivity precompile invokes our `CopyHandler` **inside the very block that emits the event**, and it places each follower's proportional order through a capped `MirrorVault`. No keeper. No relayer. No next-block lag.

That is the part only Somnia makes possible, and it is not a claim:

| | |
|---|---|
| Reactive mirrors | **102** |
| Landed in the leader's own block | **102 — 100%** |
| Filled | 71; the rest declined **on-chain, with a reason code** |
| Indexed from chain | 416 wallets · 13,696 taps · 87,230 tUSDC · 772 windows |
| Foundry tests | 19 / 19 |

A worked example, openable right now: [block 485621955](https://shannon-explorer.somnia.network/block/485621955) — the leader's broadcast and the follower's mirror, in one block. Open the reactive transaction and it says `Success`, method `onEvent`, **sent from the CopyHandler contract**. No externally owned account signed it.

Every mirror is paired with the broadcast that triggered it on the live proof page: **https://tapflow-phi.vercel.app/proof**

## Honest about the failure path

A mirror that places nothing is not hidden. The leader's own IOC order consumes the book at their limit, so a follower priced identically can find no liquidity microseconds later. v4 pays a bounded cushion over the leader (15% of the leg, at most 5 points, never above 97 cents, never below the leader), floors the size to the venue lot, and returns a **reason code that the handler puts on chain** for every mirror that fills nothing. A second reactive contract, `RiskGuard`, pauses a follower who hits their max-loss cap.

## What is built

- **Tap screen** — countdown, price against the window's open, crowd odds from one-minute candles, top positions read from the pool's own logs, payout on the chip rather than just the odds. Arrow keys tap.
- **Session keys** — a capped, 30-minute session wallet; unspent funds sweep back.
- **Four contracts** — `Router`, `MirrorVault`, `CopyHandler`, `RiskGuard`. Two live reactivity subscriptions, both funded.
- **Indexer** — builds fills, windows and results from pool logs rather than trusting the upstream indexer, which times out regularly. The app races both sources and takes whichever answers first.
- **TapBot** — a momentum agent that taps as a public leader you can follow like any human, behind a risk gate that **publishes every trade it declines to take, with a reason code** (price above 90¢, spread wider than the edge, cooling down, exposure cap). It auto-claims its winnings.
- **Telegram bot** — [@TapFlowSomniaBot](https://t.me/TapFlowSomniaBot). `/window` reads the live book, `/up 5` places a **real** immediate-or-cancel order from the chat and replies with the fill and its transaction, `/board` is the chain-built leaderboard, and the app opens as a mini-app.
- **Embeddable cards** — any Somnia dapp can drop a live tap card into an iframe.

## Contracts (Somnia Shannon, chain 50312)

| Contract | Address |
|---|---|
| Router | [`0x512009743f48A924F679907ca9E206b706d499Cc`](https://shannon-explorer.somnia.network/address/0x512009743f48A924F679907ca9E206b706d499Cc) |
| MirrorVault | [`0x535A2F473f073AB27FAd8F65ECD5Fe1203C8aE95`](https://shannon-explorer.somnia.network/address/0x535A2F473f073AB27FAd8F65ECD5Fe1203C8aE95) |
| CopyHandler | [`0x969B4F8c0106379b553232D9aFcf35B77F32b321`](https://shannon-explorer.somnia.network/address/0x969B4F8c0106379b553232D9aFcf35B77F32b321) — reactivity subscription `16910004` |
| RiskGuard | [`0x03A52EE60b30537fa57C889795576E63CFCaE3b7`](https://shannon-explorer.somnia.network/address/0x03A52EE60b30537fa57C889795576E63CFCaE3b7) — subscription `17880662` |

## DreamDEX surface used

`listLiveBinaryMarkets`, `getMarketOnchain`, `getBinaryOrderBook`, `getBinaryBookParams`, `quoteBinaryStakeOverBook`, `trader.placeOrder` (IOC), `trader.faucet`, `getOutcomeBalance`, `getClaimable`, `trader.redeem`, `getUserFills` / `getFills`, `fetchPrice` / `useLivePriceTicks` and the React live hooks — plus `@somnia-chain/reactivity-contracts`: `SomniaEventHandler` and `SomniaExtensions.subscribe`.

We wrote up everything that cost us time in a **20-item feedback report on the SDK and docs**, in the repo as `SDK-FEEDBACK.md`.

## Try it

- **App:** https://tapflow-phi.vercel.app — no wallet needed to look around; every page reads live from chain
- **Proof:** https://tapflow-phi.vercel.app/proof
- **Telegram:** https://t.me/TapFlowSomniaBot — `/up 5` places a real order with no wallet at all
- **Code:** https://github.com/Prashant-thakur77/tapflow

## Scope, honestly

Somnia Shannon testnet only, and the keys in the demo are throwaways. The session-key pattern stores a capped key in `localStorage`, which is right for a testnet demo and wrong for mainnet — the non-custodial operator path is researched but not shipped. 1.30 winning shares from before a contract upgrade are stranded in a retired vault that had no redeem function; we left the note in the README rather than quietly dropping it.
