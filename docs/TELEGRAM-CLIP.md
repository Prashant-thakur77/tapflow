# The Telegram shot (phone screen recording)

The video has a slot for a phone clip just before the closing scene, with this
line already recorded over it:

> The same flow lives in Telegram. The bot reads the live book, and one command
> places a real order from the chat, with the fill and the transaction in the
> reply. The app opens as a mini-app, so a follower never needs a browser.

That line runs **11.8 s**. Record **25-35 s** and the cut speeds the clip up to
1.8x so all of it lands inside the line — there is no need to rush on camera.

The whole point of the shot is the second beat: **a real on-chain order placed
from a chat window, by someone with no wallet**. Everything else is context.

## Before you press record

- Open Telegram, open **@TapFlowSomniaBot**, and scroll so the `/start` card is
  on screen. Start recording on that view, never on your chat list.
- Do Not Disturb on, so no banner drops into the shot.
- Portrait, full brightness, rotation locked.
- Check the bot is awake first: send `/window` once before recording. If the
  venue has no live window the reply says so, and you want to find that out
  before the camera is rolling, not during.

## The shots, in order

1. **The bot card.** Hold 2 s on the `/start` card, long enough to read the name
   and the ⚡ Open TapFlow button.
2. **`/window ETH 5m`.** Send it, wait for the reply card, hold 3 s on the odds,
   the countdown and the UP/DOWN buttons.
3. **`/up 5`. This is the shot.** Send it. The bot answers "⏳ UP · 5 tUSDC…",
   then edits that message into the fill: shares, price, what it pays if right,
   the countdown to settlement, and a link to the Shannon explorer. Hold 5 s on
   the filled message so every line is readable. If you can, tap the explorer
   link and hold 3 s on the transaction page, then come back.
4. **🏆 Leaderboard.** Press the button, hold 3 s on the board.
5. **⚡ Open TapFlow.** Press it. The mini-app opens inside Telegram. Wait for
   the tap screen to paint, hold 4 s, stop.

If a window is closing as you record, `/up 5` may answer "No live ETH 5m window
with enough time left" or "Book moved, nothing filled". Both are honest, but
neither is the shot. Send `/window` again, wait for a fresh window with a minute
or more left, and retry.

## Optional, if you want the wallet beat too

Inside the mini-app, press **CONNECT**. WalletConnect opens and offers MetaMask
on the same phone. That proves a judge can sign with their own wallet from
inside Telegram. Keep it to about 5 s and do not complete a trade; the desktop
footage already covers tapping.

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
