# The Telegram shot (phone screen recording)

The video has a slot for a phone clip just before the closing scene. It runs
**about 27 seconds** and three narration lines are already recorded over it:

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

**Record 35 to 45 seconds.** The cut fits whatever you give it into those 27
seconds, playing the footage up to 1.8x, so more footage means a fuller shot
rather than a trimmed one. Under about 27 seconds and the last frame has to
freeze while the narration finishes, so do not come in short.

The point of the shot is the second beat: **a real on-chain order placed from a
chat window, by someone with no wallet.** Everything else is context.

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
