# TapFlow Telegram bot (F6)

Tap UP/DOWN on live DreamDEX Event Contract windows from Telegram, follow
leaders, read the board, and open the mini-app.

```
/window [BTC|ETH] [5m|15m|1h]   live window: seconds left, spot vs open, UP/DOWN odds, 5-tUSDC payouts
/up <amt>  /down <amt>          real IOC order on the current window with the bot wallet
/follow <address>               record a follow (on-chain mirroring is set up in the app)
/board                          top tappers from the TapFlow indexer
/wallet <address>               save your wallet for /follow
/start /help                    how it works + "Open TapFlow" web-app button
```

Inline buttons on `/window`: quick taps (UP 1 / UP 5 / DOWN 1 / DOWN 5),
asset and cadence toggles, refresh, open the app.

## Run

```bash
cd tg-bot
npm install
cp .env.example .env      # set BOT_TOKEN; optionally BOT_PRIVATE_KEY, WEBAPP_URL, TAPFLOW_API
npm start
```

`npm run check` constructs the bot with a fake token and reads a real live
window from Shannon (no BOT_TOKEN needed). `npm run typecheck` runs `tsc`.

## How it reads the chain

`src/ec.ts` is a node copy of the web app's `src/lib/ec`: list the venue's live
markets from the Somnia indexer, gate every one on its on-chain status, read the
YES/NO book on-chain, size a stake with the SDK's `quoteBinaryStakeOverBook`,
send an IOC `placeOrder`, check the receipt. Spot comes from the oracle price
feed the markets settle on.

## Credits

Command/callback flow adapted from [ayazabbas/strike](https://github.com/ayazabbas/strike)
`bot/src/index.ts` (grammY, colon-separated callback data, `bot.catch`).
`assertTxOk` from [somnia-chain/dreamdex-bot-kit](https://github.com/somnia-chain/dreamdex-bot-kit) (MIT).
