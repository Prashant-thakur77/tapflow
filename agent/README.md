# TapBot — momentum agent (F5)

A public TapFlow leader you can follow. Each loop it samples BTC/ETH spot from
the DreamDEX oracle feed, reads short-horizon momentum, and on a strong enough
move places a real IOC tap on the shortest live window, broadcasts it through the
`Router` (so followers mirror it in the same block via Somnia reactivity), and
posts a one-line rationale to the TapFlow feed the web app renders.

## Run

```bash
cd agent && npm install && cp .env.example .env
npm run signal     # read-only: prints the current signal + window, places nothing
# set AGENT_PRIVATE_KEY (funded Shannon key), then:
npm start          # live loop
```

## How it decides

- Rolling ~90s spot window per asset → move in bps.
- `|move| < AGENT_MOMENTUM_BPS` → hold (logged, nothing placed).
- Otherwise tap the direction of the move on the chosen cadence's live window,
  sized to `AGENT_STAKE_USDC` over the book, IOC.
- Rationale example: `BTC ▲7.2bps over ~90s → momentum UP @ 63% (5m window, 214s left)`.

It never custodies follower funds: followers pre-fund `MirrorVault` and set their
own ratio and max-loss. TapBot only publishes the signal.

Credits: the Event Contract client mirrors the web app's `src/lib/ec`; `assertTxOk`
is from the DreamDEX bot kit (MIT).
