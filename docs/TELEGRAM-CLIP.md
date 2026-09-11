# The Telegram shot (phone screen recording)

**Shot and cut — this is a record of what is in the video, kept for a re-cut.**

The section runs about 27 seconds, just before the closing scene, under three
narration lines:

> The same flow lives in Telegram, and it is not a link to a website. The bot
> reads the same live book, so one command places a real immediate-or-cancel
> order on chain, straight from the chat.
>
> The reply carries the fill: the shares, the price paid, what it pays if the
> window closes your way, and the transaction on the Shannon explorer.
>
> The leaderboard is the same one, built from chain. And the app opens as a
> mini-app inside Telegram, so someone can take their first real position
> without a browser and without a wallet.

## What is in the cut

The raw recording is 2 min 08 s of portrait footage. `docs/media/telegram.mp4`
is a 32.5 s selection from it, chosen so each beat lands under the line that
describes it, and the cut plays it at 1.21x to fit the narration exactly.

| Source | Beat | Under |
|---|---|---|
| 0.5-4.0 | the bot's card: what TapFlow is, the command list | "not a link to a website" |
| 14.0-17.5 | typing `/window` | "the bot reads the same live book" |
| 27.5-32.4 | the live ETH 5m window, its odds, and UP 1 pressed | "one command places a real order" |
| 33.0-36.0 | the order going in | "the reply carries the fill" |
| 38.0-44.4 | **UP filled · 17.85 shares @ 4% for 0.71 tUSDC · pays 17.85 if right · view on Shannon explorer** | "the shares, the price paid, what it pays" |
| 48.0-51.3 | the chain-built leaderboard, TapBot among the tappers | "the leaderboard is the same one" |
| 61.3-64.3 | the mini-app opening inside Telegram | "the app opens as a mini-app" |
| 71.3-76.7 | the live tap screen, wallet `0xf2f8…7f97` connected | "without a browser and without a wallet" |

Left out on purpose: the long waits between commands, the mini-app's loading
screens, the wallet dropdown covering the countdown, and the History tab, which
honestly said it had no fills yet for that wallet.

## To re-cut it from the raw recording

The raw file is not in the repo (98 MB). Rebuild the selection with the trim
ranges in the table above, save it as `docs/media/telegram.mp4`, then:

```bash
cd /home/prashant/tapflow
node scripts/cut-demo.mjs ./video3
cp video3/out.mp4 docs/media/tapflow-demo.mp4
cp video3/out-silent.mp4 docs/media/tapflow-demo-silent.mp4
```

The cut scales the portrait clip onto the video's own background, speeds it up
to at most 1.8x so none of it is trimmed, splits it across the three lines in
proportion to their length, and burns the captions.

---

# If you ever need to shoot it again

## Before you press record

- Open Telegram, open **@TapFlowSomniaBot**, and scroll so the `/start` card is
  on screen. Start recording on that view, never on your chat list.
- Do Not Disturb on, so no banner drops into the shot.
- Portrait, full brightness, rotation locked.
- Check the bot is awake first: send `/window` once before recording. If the
  venue has no live window the reply says so, and you want to find that out
  before the camera is rolling, not during.

## The shots, in order

Times are how long to stay on each thing while recording, not how long they
appear in the video.

1. **The bot card — 3 s.** Long enough to read the name and the ⚡ Open TapFlow
   button.
2. **`/window ETH 5m` — 5 s.** Send it, wait for the reply card, hold on the
   odds, the countdown and the UP/DOWN buttons.
3. **`/up 5` — 8 s. This is the shot.** Send it. The bot answers
   "⏳ UP · 5 tUSDC…", then edits that message into the fill: shares, price,
   what it pays if right, the countdown to settlement, and a link to the
   explorer. Stay on the filled message until every line has been readable for a
   couple of seconds.
4. **The transaction — 7 s.** Tap the explorer link, let the page paint, hold on
   it, then come back to the chat. Skip this if the page is slow; do not sit on
   a spinner.
5. **🏆 Leaderboard — 5 s.** Press the button, hold on the board.
6. **⚡ Open TapFlow — 7 s.** The mini-app opens inside Telegram. Wait for the
   tap screen to paint, then hold on the live window.
7. **Optional, CONNECT — 5 s.** Press Connect in the mini-app. WalletConnect
   opens and offers MetaMask on the same phone, which proves a judge can sign
   with their own wallet from inside Telegram. Do not complete a trade; the
   desktop footage already covers tapping.

That adds up to about 40 seconds, which is the sweet spot.

If a window is closing as you record, `/up 5` may answer "No live ETH 5m window
with enough time left" or "Book moved, nothing filled". Both are honest, but
neither is the shot. Send `/window` again, wait for a fresh window with a minute
or more left, and retry.

## Do not

- Do not show `/wallet` with a personal address you care about. The bot echoes
  it back into the chat.
- Do not connect a wallet holding anything real. Everything here is Somnia
  Shannon testnet.

## About the wallet the bot spends

`/up` and `/down` spend a wallet the **bot** owns
(`0x07e67564573dbFa5F99869230c210707417362E9`), capped at 25 tUSDC a tap, so
anyone can place a real trade with nothing installed. The shares belong to that
wallet, not to the person who typed the command, and `/start` says so on camera.
That is a fair thing to show; it is not pretending to be the viewer's own trade.

## When you have it

Save it as `docs/media/telegram.mp4` — any format the phone produced is fine,
the cut converts it. Then:

```bash
cd /home/prashant/tapflow
node scripts/cut-demo.mjs ./video3
cp video3/out.mp4 docs/media/tapflow-demo.mp4
cp video3/out-silent.mp4 docs/media/tapflow-demo-silent.mp4
```

The clip is scaled onto the video's own background, spliced in before the
closing scene, and captioned with the line above.
