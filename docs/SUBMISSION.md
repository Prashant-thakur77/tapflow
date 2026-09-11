# DoraHacks submission — the form, field by field

Numbers below were read from chain on 11 Sep 2026, 20:15 IST. Re-check with
`curl -s localhost:8787/api/stats` and `/api/proof` before pasting if time has passed.

---

## BUIDL (project) name

```
TapFlow
```

## BUIDL logo

`docs/media/tapflow-logo-480.png` — 480 × 480 PNG, 9 KB, the app's own mark.

## Vision — "describe the problem which this project solves"

```
Prediction markets are solo. Every trade is connect, approve, read a book, sign, wait — and if you want to copy someone who is good at it, you can't. Not on-chain, and not in time. Copy trading everywhere else runs on bots and relayers that react after the fact, so by the time your copy lands the price has moved. On five-minute windows, a block late is too late.

TapFlow fixes both halves.

One tap. Every live DreamDEX Event Contract becomes a one-tap UP or DOWN call. Your stake becomes a real immediate-or-cancel order on the live on-chain book, sized over the book on the venue's own tick and lot grid. Fund a capped session wallet once and every tap and every claim signs itself — no wallet popup, ever again.

Same block. A leader's tap is broadcast through a Router contract. Somnia's reactivity precompile invokes our CopyHandler inside the very block that emits the event, and it places each follower's proportional order through a capped MirrorVault. No keeper. No relayer. No next-block lag. This is the part that is only possible on Somnia, and it is not a claim: 102 reactive mirrors so far, 102 of them in the leader's own block — 100% — each one paired on our proof page with the broadcast that triggered it, and openable on the explorer. A mirror that places nothing says why on-chain, with a reason code, and a second reactive contract pauses a follower who hits their max-loss cap.

Everything is read from the chain, and everything in the demo is a real transaction. A fills indexer builds the leaderboard from pool logs rather than trusting an upstream one. TapBot, a momentum agent, taps as a public leader you can follow like any human, and publishes every decision it declines to take with its reason. A Telegram bot places real orders from a chat, with the app as its mini-app. And a 20-item feedback report on the DreamDEX SDK and docs ships with the repo.
```

## Category / tags

```
Crypto / Web3 · DeFi · Prediction Markets · Event Contracts · DreamDEX · Somnia · Telegram Mini-App
```

Track: **Open Track**

## Links

| Field | Value |
|---|---|
| GitHub (required) | `https://github.com/Prashant-thakur77/tapflow` |
| Project website | `https://tapflow-phi.vercel.app` |
| Demo video (required) | `https://youtu.be/xzKF1KN3L9E` |

## Social links — at least one required

```
https://t.me/TapFlowSomniaBot
```

Add your X/Twitter and anything else you want on the profile; the bot link alone
satisfies the requirement and is the most useful of the three, because it is a
live thing a judge can press.

---

## What is real — judge checklist

| | |
|---|---|
| Reactive mirrors | **102**, of which **102 in the leader's block (100%)**, 71 filled; the rest declined on-chain with a reason code |
| Contracts | Router, MirrorVault, CopyHandler, RiskGuard on Shannon — reactivity subscriptions `16910004` and `17880662`, both funded |
| Tests | 19/19 Foundry |
| Indexed from chain | **416 wallets · 13,696 taps · 87,230 tUSDC volume · 772 windows** |
| Proven on camera | a wallet connects, funds a session wallet and taps — filled; then a leader tap, its broadcast, and the follower's mirror in [block 485621955](https://shannon-explorer.somnia.network/block/485621955) |
| Mocked | nothing. Testnet keys are throwaways |

## Somnia × DreamDEX surface used

`listLiveBinaryMarkets`, `getMarketOnchain`, `getBinaryOrderBook`,
`getBinaryBookParams`, `quoteBinaryStakeOverBook`, `trader.placeOrder` (IOC),
`trader.faucet`, `getOutcomeBalance`, `getClaimable`, `trader.redeem`,
`getUserFills`/`getFills`, `fetchPrice`/`useLivePriceTicks`, the React live
hooks; and `@somnia-chain/reactivity-contracts` — `SomniaEventHandler` plus
`SomniaExtensions.subscribe`.

Feedback on all of it: [`SDK-FEEDBACK.md`](../SDK-FEEDBACK.md), 20 items.

## After the hackathon

Non-custodial operator session keys (researched, `src/lib/ec/operator.ts`), a
follower-side strategy filter, and mainnet when Event Contracts ship there.
