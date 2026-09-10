# The Telegram shot (phone screen recording)

The video has a slot for a phone clip right before the closing scene, with this
line already recorded over it:

> The same flow lives in Telegram. The bot reads the live book, shows the
> leaderboard, and opens the app as a mini-app, so a follower never needs a
> browser.

That line runs **7.4 s**. Record **20-25 s** and the cut speeds the clip up to
1.8x so all of it lands inside the line — no need to rush on camera.

## Before you press record

- Open Telegram, open **@TapFlowSomniaBot**, and scroll so the `/start` card is
  on screen. Start the recording on that view, not on your chat list.
- Do Not Disturb on, so no banner drops into the shot.
- Portrait, full brightness, rotation locked.
- Nothing personal in frame: the shot never leaves this one chat.

## The shots, in order

1. **The bot card.** Hold 2 s on the `/start` card so the name and the
   "⚡ Open TapFlow" button read.
2. **`/window ETH 5m`.** Type it, send it, wait for the reply card. Hold 3 s on
   the odds, the countdown, and the UP/DOWN buttons.
3. **🏆 Leaderboard.** Press the button. Hold 3 s on the board.
4. **⚡ Open TapFlow.** Press it. The mini-app opens inside Telegram. Wait for
   the tap screen to paint, then hold 4 s on the live window.
5. Stop.

## Do not

- Do not use `/up` or `/down`. The bot is read-only by design (no key on the
  server), so it answers with "tap from the mini-app" and that reads as a
  failure on camera.
- Do not connect a wallet in the mini-app. The popup adds nothing here, and the
  desktop footage already proves the popup-free tap.

## When you have it

Save it as `docs/media/telegram.mp4` (any format is fine — mov, mkv, whatever
the phone produced; the cut converts it). Then:

```bash
node scripts/cut-demo.mjs ./video    # the take directory you last recorded
```

The clip is scaled to fit 1280×800 on the video's own background, spliced
before the closing scene, and captioned with the line above.
