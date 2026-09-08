# TapFlow — cross-component contracts (API + on-chain)

The single source of truth every subproject codes against. Frontend, indexer,
agent and Telegram bot all agree on these shapes.

## Config / env (shared)

```
RPC_URL      = https://dream-rpc.somnia.network
WS_RPC_URL   = wss://api.infra.testnet.somnia.network/ws
INDEXER_URL  = https://dev.smk.somnia.host/v1/graphql   (Somnia markets indexer)
CHAIN_ID     = 50312
VENUE_ID     = 0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c
COLLATERAL   = 0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E   (tUSDC, 6 dp)
EXPLORER     = https://shannon-explorer.somnia.network
```

The TapFlow indexer (F4) serves this API. The web app reads it for the
leaderboard, live stats and the agent feed. Base URL from
`VITE_TAPFLOW_API` (default `http://localhost:8787`).

## TapFlow indexer HTTP API (F4)

All responses JSON, `Access-Control-Allow-Origin: *`.

```
GET /api/health        → { ok: true, lastBlock: number, fills: number }

GET /api/stats         → {
  wallets: number,        // distinct traders seen
  taps: number,           // total fills indexed
  volumeUsdc: number,     // cumulative tUSDC notional
  windows: number,        // distinct markets seen
  updatedAt: number       // epoch ms
}

GET /api/leaderboard?limit=50 → Leader[]
  Leader = {
    address: string,
    taps: number,
    wins: number,
    losses: number,
    winRate: number,       // 0..1
    streak: number,        // current consecutive wins
    bestStreak: number,
    pnlUsdc: number,       // realized, settled markets only
    volumeUsdc: number,
    followers: number,
    isAgent: boolean,      // true for TapBot
    label?: string         // "TapBot" for the agent
  }

GET /api/leader/:address → Leader & { recent: TapRow[] }
  TapRow = { at: number, asset: string, intervalSec: number, marketId: string,
             side: "UP"|"DOWN", qty: number, price: number, txHash: string,
             result?: "win"|"loss"|"void", pnl?: number }

GET /api/feed?limit=30 → FeedItem[]   // agent rationale feed (F5 posts here)
  FeedItem = { at: number, actor: string, label?: string, asset: string,
               side: "UP"|"DOWN", stake: number, price: number,
               rationale: string, txHash: string }

POST /api/feed  { secret, item: FeedItem }   // agent auth via FEED_SECRET

GET /api/og?title=...&sub=...&tone=win|loss|flat → SVG share card
  Also: GET /api/og/leader/:address and GET /api/og/tap/:txHash convenience.

GET /api/follows/:address → { leader: string, followers: string[] }  // from MirrorVault events when deployed, else off-chain demo store
POST /api/follow { follower, leader }        // demo registry for follower counts
```

## On-chain contracts (F3) — deployed addresses land in `deployments.json`

```
Router          — wraps DreamDEX placeOrder, emits PositionOpened
MirrorVault     — follower deposits, names a leader, ratio + maxLoss
CopyHandler     — SomniaEventHandler on PositionOpened → follower order same block
RiskGuard       — SomniaEventHandler on follower fills → close at maxLoss
```

### Why a mirror can place nothing (v4)

A mirror is a real IOC on the same book the leader just traded. `MirrorVault.mirrorWithReason`
returns `(placed, reason)` and `CopyHandler` puts the reason in the `Mirrored` event:

| code | meaning |
|---|---|
| 0 | filled |
| 1 | the follower is not following (or was paused) |
| 2 | size below the venue lot after the ratio |
| 3 | the follower's max-loss cap refused it (also emits `FollowerCapped`) |
| 4 | no budget left in the vault |
| 5 | the pool rejected the order — no liquidity at the price |
| 6 | the vault call reverted (never expected; caught so one follower cannot cost the owner the block) |

The cushion: the follower bids `min(price × (1 + slippageBps), price + 5 points, 0.97)`
on the leg they are buying, snapped to the grid, and never below the leader's own
price. Default 1500 bps, per-follower via `setFollowWithSlippage` / `setSlippage`,
hard-capped at 5000.

### Settlement for followers (v3)

The vault is `msg.sender` on every mirrored order, so the pool credits the
outcome tokens (ERC-6909 ids on the singleton outcome token) to the vault.
`MirrorVault` keeps `shares[follower][marketId][side]` and exposes
`redeem(follower, marketId, outcomeIdx, amount)` (anyone may call; the payout
can only be credited to that follower) and `redeemMany`. Setup once per vault:
`setVenue(module, operatorId, venueId)` and `approveOutcomeToken(token)`, which
calls `setOperator(module, true)` so the module can pull the vault's winning
tokens. The indexer's `/api/follower/:address/claimable` lists settled windows
where the current vault still holds winning or voided shares for a follower;
the Portfolio card calls `redeemMany` with them.

### Events the indexer & handlers key on

```solidity
// Router
event PositionOpened(
  address indexed leader,
  bytes32 indexed marketId,
  address pool,
  uint8   side,        // 0 = UP (BUY_YES), 1 = DOWN (BUY_NO)
  uint256 qty,         // outcome tokens, raw (1e6)
  uint256 price,       // YES price, raw (1e6)
  uint64  expiryNs
);

// MirrorVault
event FollowSet(address indexed follower, address indexed leader, uint256 ratioBps, uint256 maxLossUsdc);
event FollowCleared(address indexed follower, address indexed leader);

// CopyHandler
event Mirrored(address indexed follower, address indexed leader, bytes32 indexed marketId, uint8 side, uint256 qty, bool success);
```

`deployments.json` (written by the deploy script, read by frontend + indexer):

```json
{
  "chainId": 50312,
  "router": "0x...",
  "mirrorVault": "0x...",
  "copyHandler": "0x...",
  "riskGuard": "0x...",
  "subscriptions": { "copyHandler": "123", "riskGuard": "124" },
  "deployedAt": "2026-09-04T..."
}
```

## Session keys (F2)

One EIP-191 signed login unlocks an operator (session) key held in the browser,
granted `placeOrderFor` on the venue's pools via the OperatorPermissionsRegistry
(testnet `0x15C7e8CE38F021c5b45d098AaD788f63090bF20A`). Cap: 50 tUSDC of vault
deposit, 30-minute local expiry. After login, taps sign with the session key —
no wallet popup. Registry selector for place: `0x80054449` (placeOrderFor).
