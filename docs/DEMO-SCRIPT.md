# Demo narration script

The silent screen recording is [`docs/media/tapflow-demo-silent.mp4`](media/tapflow-demo-silent.mp4) — 1 min 45 s, 1280×800.
Read this over it. Timings are the scene changes in that file; every number on screen is live, so say what you see if it differs.

Recording it: play the mp4 full screen and record your voice over it (OBS, QuickTime, or Loom's "screen + mic"). No editing needed — the cuts are already in the video.

---

**0:00 — Landing.**
> This is TapFlow. Every live DreamDEX Event Contract window becomes a one-tap Up or Down call on Somnia Shannon. Real orders, real order book, nothing simulated.

**0:04 — The proof strip and the flow diagram scroll into view.**
> Here is the part nobody else has. When a leader taps, that tap is broadcast through our Router contract. Somnia's reactivity precompile invokes our CopyHandler *inside that same block*, and MirrorVault places every follower's order right behind it. No keeper, no relayer, no next-block lag. Fifty-one mirrors so far, fifty-one in the same block as the leader.

**0:12 — The tap screen.**
> One window. The countdown, the price against where the window opened, and the crowd's odds. Tap Up or Down and your stake becomes an immediate-or-cancel order on the live book, sized over the venue's own tick and lot grid.

**0:18 — Crowd odds chart, then the positions panel.**
> This line is what the crowd paid for Up through the window, from one-minute candles. Below it, who actually holds what on this window — read from the pool's own logs, because the upstream indexer lags by up to a hundred minutes and drops wallets.

**0:23 — Up and Down buttons, then the asset switch.**
> The chips show your payout, not just the odds. After you fund a capped session wallet once, every tap and every claim signs itself: no wallet popup. On desktop the arrow keys tap.

**0:30 — Markets grid.**
> Every live window on the venue as a card, with quick taps. Any Somnia app can embed one of these cards in an iframe — the embed button copies the snippet.

**0:36 — Leaderboard.**
> The leaderboard is built from chain, ranked by realized profit on settled windows. TapBot is our agent: a momentum strategy that taps as a public leader you can follow like any human. Fifty-two real taps, thirty wins, twenty-two losses, twenty-five on-chain copies.
>
> And when it *doesn't* trade, it says why. Price above ninety cents, spread wider than the edge, already in this window, cooling down — every hold is published with its reason code, so a follower knows what they are following.

**0:45 — Proof page.**
> Every reactive mirror the indexer has found, paired with the broadcast that triggered it. Both transactions, same block, every time. A row marked "capped" is the safety rail working: the reactive call still landed in the leader's block, and the vault declined the order because that follower's own max-loss cap could not cover it.

**0:55 — Explorer, the block.**
> Here is that block on the Shannon explorer.

**1:07 — Explorer, the reactive transaction.**
> And here is the mirror itself. Status success, method `onEvent`, sent *from the CopyHandler contract* — no externally owned account signed this. That is Somnia reactivity placing a follower's trade in the leader's block.
>
> Everything you have seen is a real transaction on Shannon. The code, the contracts, and a nineteen-item feedback report on the DreamDEX SDK are all in the repo.

---

## If you would rather do a live demo (about two minutes)

1. Open the app, Connect (MetaMask on Somnia Shannon, chain 50312), press **Get tUSDC** in the header — that is a real on-chain faucet mint.
2. Press **Start one-tap session**, fund it, then tap **Up** or **Down**. Show the fill toast and open the transaction.
3. Go to **Leaders**, follow **TapBot** with a few tUSDC (approve → deposit → setFollow).
4. Wait for TapBot's next tap, or tap yourself and press **Broadcast to followers**.
5. Open **Proof**: your mirror appears with its block number, and the explorer shows both transactions inside it.

You can also show the Telegram bot: open [@TapFlowSomniaBot](https://t.me/TapFlowSomniaBot), send `/window` for the live book and `/board` for the leaderboard, and press the menu button to open the mini-app.

Before demoing, run `npm run doctor` — it prints wallets, the vault, the handler's gas tank, the subscription, the live books and the indexer in one screen.
