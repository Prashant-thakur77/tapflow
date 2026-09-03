# TapFlow indexer (F4)

Reads every taker BUY ("tap") on the DreamDEX Event Contracts venue from Somnia
Shannon into SQLite, settles them against each market's on-chain resolution,
and serves the leaderboard, live stats, the agent rationale feed, follower
registry and SVG share cards. Read-only on chain: no private key.

```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:8787/api
```

| Endpoint | What |
|---|---|
| `GET /api/health` | liveness + last sync |
| `GET /api/stats` | wallets, taps, volume, windows |
| `GET /api/leaderboard?limit=50` | ranked tappers (pnl, win rate, streak, followers) |
| `GET /api/leader/:address` | one tapper + recent taps |
| `GET /api/feed` · `POST /api/feed` | agent rationale feed (POST needs `FEED_SECRET`) |
| `GET /api/follows/:address` · `POST /api/follow` | follower registry |
| `GET /api/og?title&sub&tone` | 1200×630 SVG share card |
| `GET /api/og/leader/:address` · `GET /api/og/tap/:txHash` | ready-made cards |

How it reads: `listLiveBinaryMarkets` + `listPastBinaryMarkets({status:"Finalized"})`
for market rows, `getFills(pool, {since, until})` per window (filtered by the
row's `market` id because pools are recycled), `getMarketOnchain` for the
winner. A win pays 1 tUSDC per share minus price paid; a void pays 0.5.

Full API contract: `../docs/CONTRACTS.md`.
