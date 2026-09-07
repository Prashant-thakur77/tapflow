# TapFlow UX — what the product should feel like

TapFlow is a game with real money underneath, not a trading terminal with a
game skin. Every decision below follows from that.

## The loop

1. **See the window.** A countdown ring and a price line fighting the opening
   price. You understand the state of play in one glance: how much time is
   left, which way the price leans, and what the crowd thinks (the odds bar).
2. **Tap.** Two thumb-sized buttons. The headline on each is the implied
   probability, because that is the number you are betting against. Under it:
   what your stake pays if you are right. Haptic tick on press.
3. **Ride.** Your position shows on the same screen. The live tape shows every
   other tap landing on the window, including yours.
4. **Settle.** When the window closes, one card: UP ✓ +2.40. Confetti if you
   won. Share it. Claim it. Tap again. Streaks and session PnL keep score.

Nothing on the tap screen is more than one scroll away from the buttons.

## Principles

- **The window is the hero.** Time pressure is the engagement mechanic. The
  ring turns amber in the last 20 seconds and locks at 5.
- **Show the why, not just the what.** The price tape against the open line
  makes a tap feel informed. The odds bar makes the crowd visible.
- **Real numbers, always.** Every figure is read from Somnia Shannon: spot from
  the oracle feed, odds from the on-chain book, fills from the pool. Explorer
  links everywhere. "Book live" indicator so the user knows the data is fresh.
- **Zero friction after login.** Faucet is one tap when balance is short.
  Session keys (F2) remove wallet popups entirely.
- **Loss is fast and honest.** A loss card is the same size as a win card.
  Payouts and prices are stated in tUSDC, not abstract points.
- **Mobile first, desktop fine.** Buttons stick above the bottom nav in the
  thumb zone. On desktop the window and the decision sit side by side.

## Visual language

Dark, high contrast, expressive numbers. Space Grotesk for display, JetBrains
Mono for every number (tabular figures so digits don't dance). Manrope for
body. Grain overlay and a soft radial mesh for depth. Accent blue for the
system, green/red only for direction. Motion is spring-based and purposeful:
numbers glide, the odds bar eases, buttons compress on press. Reduced-motion
respected.

## Inspiration

- Polymarket / Kalshi: probability as the price, odds bar.
- Robinhood: the sparkline against a reference line.
- Family.co / Rainbow: playful confidence in a wallet UI.
- Linear / Vercel: dark surfaces, restrained glass, typographic hierarchy.
- Arcade HUDs: countdown as the centre of gravity.

## Reference-driven additions (8 Sep)

Studied with headless Chromium: DreamDEX's own `/event-contracts` page, Polymarket's crypto up/down grid, Limitless. What we took and made ours:

- **Question framing** (DreamDEX): "Will BTC settle above $X at HH:MM?" under the odds bar, so the bet is never ambiguous.
- **Recently settled strip** (DreamDEX): the last windows of the series with their close price — the pattern hunters' strip.
- **Order details drawer** (DreamDEX): YES book top 5 in cents, grid, pool and marketId for the pros; hidden by default.
- **Markets grid with payout-on-chip** (Polymarket): every live window as a card, `stake → payout` on the UP/DOWN chips, LIVE + volume, cadence filters.
- **Venue-wide live ticker** (Limitless): every fill on the venue scrolls under the header.
- **Crowd odds over the window** (Limitless): 1-minute candles of the YES price, bounded to the window's trading span (pools are recycled), with the live quote as the last point and a 50% coin-flip line.
- **Top positions on this window** (Limitless): who holds what, from chain-indexed fills, with an UP/DOWN share bar.
- **Proof page + landing proof strip** (ours): the indexer pairs every reactive mirror with its broadcast and reports the same-block rate live.
