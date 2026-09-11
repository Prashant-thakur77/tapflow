# Demo script

Final cut: **3:59**, 1280×800, narrated, [`docs/media/tapflow-demo.mp4`](media/tapflow-demo.mp4).
The mirror placed on camera is [block 484969998](https://shannon-explorer.somnia.network/block/484969998).
A picture-only cut of the recorded take is at [`tapflow-demo-silent.mp4`](media/tapflow-demo-silent.mp4),
for reading the lines live. It is the screen recording alone, so it does not include the phone clip.

Everything is recorded by Playwright against the running app and the **live**
chain: every number on screen is real, and the proof scene places a real leader
tap, broadcasts it, and shows the follower's mirror landing in the same block
while the camera rolls.

The narration below is the source of truth: [`scripts/demo-lines.mjs`](../scripts/demo-lines.mjs)
feeds the voice ([`scripts/tts.py`](../scripts/tts.py), Chatterbox), the scene
holds in the recorder, and the burned-in captions.

Rebuild it:

```bash
~/chatterbox-env/bin/python scripts/tts.py video/tts   # the voice, one clip per line
node scripts/record-demo.mjs ./video                   # a take (scenes hold for their lines)
node scripts/cut-demo.mjs ./video                      # cut, voice, captions
```

Needs the leader key in `.env`, and TapBot paused so the two never race on a nonce.

---

## The problem, and the one-line answer — 0:00

> Prediction markets have a problem. Every trade is solo: connect a wallet, approve a token, read an order book, sign, wait. And if you want to copy someone who is good, you can't — not on-chain, not in time.
>
> Copy trading everywhere else runs on bots and relayers. By the time your copy lands, the price has moved. On five-minute markets, a block late is too late.
>
> TapFlow fixes both. Every live DreamDEX Event Contract becomes a one-tap UP or DOWN call, and following a leader means your order is placed in the SAME BLOCK as theirs, by the chain itself.

*(landing, 29 s)*

## The tap screen — 0:33

> This is the tap screen. One window: the countdown, the price against where it opened, and the crowd's odds. Tap UP or DOWN and your stake becomes a real immediate-or-cancel order on the live on-chain book.
>
> Below, the crowd-odds line from one-minute candles, and who holds what on this window, read straight from the pool's own logs.
>
> Fund a capped session wallet once, and every tap and every claim signs itself. No wallet popups. On desktop, the arrow keys tap.

*(tap, 25 s)*

## Every window, and why Event Contracts — 1:05

> Every live window on the venue as a card, with quick taps. Any Somnia app can embed one of these cards in an iframe.
>
> Why DreamDEX Event Contracts? They are real binary markets with a real on-chain order book, rolled every few minutes, with oracle settlement. That is exactly what one-tap trading needs, and the Somnia markets SDK gives us the book, the quotes and the orders without a backend of our own.

*(markets, 21 s)*

## Leaders, and an agent you can follow — 1:31

> The leaderboard is built from chain, ranked by realized profit on settled windows. TapBot is our agent: a momentum strategy that taps as a public leader you can follow like any human. Dozens of real taps, a settled record, and every copy it triggered is on-chain.
>
> When it does not trade, it says why. Price too high, spread wider than the edge, cooling down. Every hold is published with its reason code, so a follower knows what they are following.

*(leaders, 24 s)*

## Somnia Reactivity — 1:59

> Now the part only Somnia makes possible. Somnia's reactivity precompile lets a contract subscribe to an event and be invoked inside the very block that emits it. No keeper, no relayer, no bot. We built our copy engine on that.
>
> This page pairs every reactive mirror with the broadcast that triggered it. Let's add one now, live.

*(proof, 18 s)*

## A real mirror, on camera — 2:19

> A real leader tap goes in. It fills. It is broadcast through the Router contract.
>
> And there is the follower's order: placed by the CopyHandler contract, from the follower's vault, in the same block.

*(mirror-live, 11 s)*

## The indexer picks it up — 2:34

> Our indexer reads it from chain and the new row lands at the top of the table, with both transactions and the block number.

*(mirror-row, 7 s)*

## Same block, and the safety rail

> Same block, every time. A row that placed nothing is the safety rail: the vault checked the follower's own max-loss cap and declined, and a second reactive contract, RiskGuard, pauses a follower who hits their cap.

*(mirror-row-ready, 12 s)*

## The explorer — 2:53

> Here is the mirror on the Shannon explorer. Status success, method onEvent, sent from the CopyHandler contract. No externally owned account signed this. That is Somnia reactivity placing a follower's trade in the leader's block.

*(explorer-tx, 12 s)*

## Telegram — 3:09

> The same flow lives in Telegram, and it is not a link to a website. The bot reads the same live book, so one command places a real immediate-or-cancel order on chain, straight from the chat.
>
> The reply carries the fill: the shares, the price paid, what it pays if the window closes your way, and the transaction on the Shannon explorer.
>
> The leaderboard is the same one, built from chain. And the app opens as a mini-app inside Telegram, so someone can take their first real position without a browser and without a wallet.

*(telegram, 26 s)*

## Close — 3:36

> Followers redeem mirrored winnings through the vault. Every number you saw is read live from Somnia Shannon, and every transaction is real.
>
> The code, the contracts, and a twenty-item feedback report on the DreamDEX SDK are in the repo. TapFlow: tap once, and the chain copies you in the same block.

*(close, 17 s)*

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
