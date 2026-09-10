# Demo script

Target length: about 2 minutes 15 seconds, 1280×800. The recording is driven by
Playwright against the **live** site and the **live** chain: every number on
screen is real, and scene 5 places a real leader tap, broadcasts it, and shows
the follower's mirror landing in the same block while the camera rolls.

The silent cut has these lines burned in as captions, so it stands on its own.
To narrate, play the mp4 full screen and read the lines over it; the caption
timings are the cue.

---

## 1 · Landing (0:00)

> This is TapFlow. Every live DreamDEX Event Contract becomes a one-tap Up or
> Down call on Somnia Shannon. Real orders on a real on-chain book. Nothing
> simulated.

*(scroll: the proof strip and the flow diagram)*

> And this is the part nobody else has: when a leader taps, followers are
> filled in the **same block**, by Somnia's reactivity precompile calling our
> contract. No keeper. No relayer. No next-block lag.

## 2 · The tap screen (0:12)

> One window. The countdown, the price against where the window opened, and the
> crowd's odds. Tap Up or Down and your stake becomes an immediate-or-cancel
> order on the live book, sized on the venue's own tick and lot grid.

*(scroll: crowd-odds line, top positions)*

> This line is what the crowd paid for Up through the window, from one-minute
> candles. Below it, who holds what — read from the pool's own logs, because the
> upstream indexer lags by up to a hundred minutes and drops wallets.

*(hover Up, hover Down, switch to ETH)*

> The chips show your payout, not just the odds. Fund a capped session wallet
> once and every tap and every claim signs itself. No popups. On desktop the
> arrow keys tap.

## 3 · Markets (0:34)

> Every live window on the venue as a card, with quick taps. Any Somnia app can
> embed one of these cards in an iframe — the embed button copies the snippet.

## 4 · Leaders (0:42)

> The leaderboard is built from chain and ranked by realized profit on settled
> windows. TapBot is our agent: a momentum strategy that taps as a public leader
> you can follow like any human. Over fifty real taps, a settled win-loss
> record, and every copy it triggered is on-chain.

*(scroll: the feed with "holding" rows)*

> And when it does *not* trade, it says why. Price above ninety cents, spread
> wider than the edge, already in this window, cooling down. Every hold is
> published with its reason code, so a follower knows what they are following.

## 5 · Live proof (0:58)

*(the proof page: tiles, the mirrors table)*

> This page pairs every reactive mirror with the broadcast that triggered it.
> Let's add one now, live.

*(overlay appears; the demo script runs: leader tap → broadcast → mirror)*

> A leader tap goes in. It fills. The tap is broadcast through the Router …
> and there is the follower's order — placed by the CopyHandler contract, from
> the follower's vault, in the **same block**. The row lands at the top of the
> table with both transactions and the block number.

> A row that placed nothing is the safety rail working: the vault checked the
> follower's own max-loss cap and declined, and RiskGuard — a second reactive
> subscription — pauses a follower who hits their cap.

## 6 · The explorer (1:38)

*(the block)*

> Here is that block on the Shannon explorer.

*(the reactive transaction)*

> And the mirror itself. Status success, method `onEvent`, sent **from the
> CopyHandler contract**. No externally owned account signed this. That is
> Somnia reactivity placing a follower's trade in the leader's block.

## 7 · Close (2:00)

*(back to the landing proof strip)*

> Followers redeem their mirrored winnings through the vault. A Telegram bot
> exposes the same flow. Everything you have seen is a real transaction on
> Shannon, and the code, the contracts, and a twenty-item feedback report on
> the DreamDEX SDK are all in the repo. TapFlow.

---

## If you would rather demo live (about two minutes)

1. Open the app, Connect (MetaMask on Somnia Shannon, chain 50312), press
   **Get tUSDC** in the header — a real on-chain faucet mint.
2. Press **Start one-tap session**, fund it, then tap **Up** or **Down**. Show the
   fill toast and open the transaction.
3. Go to **Leaders**, follow **TapBot** with a few tUSDC.
4. Wait for TapBot's next tap, or tap yourself and press **Broadcast to followers**.
5. Open **Proof**: your mirror appears with its block number, and the explorer
   shows both transactions inside it.

Telegram: open [@TapFlowSomniaBot](https://t.me/TapFlowSomniaBot), send
`/window` and `/board`, and press the menu button to open the mini-app.

Before demoing, run `npm run doctor`.
