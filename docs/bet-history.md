# UI · Bet History & Stats

<aside>
📊

**History + stats.** Simple, scannable bet history with basic performance metrics. Maps to JTBD story: _Track — "Just enough history"_.

</aside>

---

## Page Purpose

Secondary feature — not the main attraction, but essential for trust. Users need to:

- Sanity-check results
- See basic performance stats
- Optionally verify settlements on-chain

**Design principle:** Clarity, not complexity. This is NOT a trading terminal.

**Personas served:** Degen Dan (quick win-rate check), LP Larry (track pool health via separate LP page)

---

## Layout

```jsx
┌──────────────────────────────────────────────────────────┐
│  ← Back                   HISTORY                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  STATS SUMMARY                                           │
│  ┌──────────┬──────────┬──────────┬──────────┐           │
│  │ Total    │ Win Rate │ Net P&L  │ Avg Mult │           │
│  │  142     │  58%     │ +$42.60  │  ×3.8    │           │
│  └──────────┴──────────┴──────────┴──────────┘           │
│                                                          │
│  FILTER BAR                                              │
│  [24h ▾]  [All Assets ▾]  [All Outcomes ▾]               │
│                                                          │
│  BET LIST                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ #142 · BTC · $67,820–840 · 5–10s                  │  │
│  │ ×2.8 · ✅ WIN · +$1.80 · 2m ago                   │  │
│  │                              ⛓️ Verified ↗        │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ #141 · ETH · $2,073–078 · 10–15s                  │  │
│  │ ×14.1 · ❌ LOSS · -$1.00 · 5m ago                 │  │
│  │                              ⏳ Pending commit     │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ #140 · BTC · $67,800–820 · 5–10s                  │  │
│  │ ×3.4 · ✅ WIN · +$2.40 · 8m ago                   │  │
│  │                              ⛓️ Verified ↗        │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ #139 · LINK · $9.10–9.20 · 15–20s                 │  │
│  │ ×57.2 · ❌ LOSS · -$1.00 · 12m ago                │  │
│  │                              ⛓️ Verified ↗        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ Load more ]                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Sections & Components

### 1. Stats Summary Bar

Four key numbers at a glance. Always visible at top.

| **Stat**       | **Description**                       | **Computation**                                                                 |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| Total Bets     | Number of bets in selected time range | Count of all bets                                                               |
| Win Rate       | Percentage of winning bets            | wins / total × 100                                                              |
| Net P&L        | Net profit/loss in USDT               | Sum of all credits − sum of all bet amounts. Green if positive, red if negative |
| Avg Multiplier | Average locked multiplier across bets | Mean of all locked multipliers in range                                         |

### 2. Filter Bar

| **Filter** | **Options**           | **Default** |
| ---------- | --------------------- | ----------- |
| Time Range | 1h, 24h, 7d, 30d, All | 24h         |
| Asset      | All, BTC, ETH, LINK   | All         |
| Outcome    | All, Wins, Losses     | All         |

Stats summary updates when filters change.

### 3. Bet List

Each row is a single bet. Scannable, not cluttered.

| **Field**    | **Description**                      | **Format**                                |
| ------------ | ------------------------------------ | ----------------------------------------- |
| Bet ID       | Sequential bet number                | #142                                      |
| Asset        | Which asset was bet on               | BTC / ETH / LINK                          |
| Band         | Price range of the bet               | $67,820–840                               |
| Window       | Time window selected                 | 5–10s                                     |
| Multiplier   | Locked multiplier at bet time        | ×2.8                                      |
| Outcome      | WIN or LOSS                          | ✅ WIN / ❌ LOSS, color-coded             |
| Amount       | Credited amount (win) or lost amount | +$1.80 (green) / -$1.00 (red)             |
| Time         | Relative timestamp                   | "2m ago", "1h ago"                        |
| Verification | On-chain settlement status           | ⛓️ Verified ↗ (link) or ⏳ Pending commit |

**Row interaction:**

- Tap row → expand to show details: oracle tick, lock timestamp, OHLC values during window, settlement commit tx hash
- Tap ⛓️ Verified → open block explorer to settlement commit

### 4. Expanded Bet Detail (on row tap)

```jsx
┌────────────────────────────────────────────────────┐
│  #142 · BTC/USDT · ✅ WIN                          │
│                                                    │
│  Band:        $67,820 – $67,840                    │
│  Window:      5–10s                                │
│  Lock tick:   #48,291 @ $67,835.30                 │
│  Multiplier:  ×2.8 (locked)                        │
│  Bet amount:  $1.00                                │
│  Payout:      $2.80 (+$1.80)                       │
│                                                    │
│  OHLC (window):                                    │
│  t=5s  O:67,834  H:67,836  L:67,828  C:67,835     │
│  t=6s  O:67,835  H:67,837  L:67,830  C:67,836     │
│  t=7s  O:67,836  H:67,838  L:67,824  C:67,831     │
│  t=8s  O:67,831  H:67,835  L:67,827  C:67,833     │
│  t=9s  O:67,833  H:67,834  L:67,829  C:67,832     │
│  Touch: t=7s H=67,838 ≥ $67,820 ✅                 │
│                                                    │
│  Settlement: Commit #1847  ⛓️ 0xab3f...c21d ↗     │
└────────────────────────────────────────────────────┘
```

---

## States & Edge Cases

| **State**         | **Trigger**                   | **UI Behavior**                                                                  |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| 🟢 Normal         | Bets exist, commits available | Full list with verification links                                                |
| ⚪ Empty          | No bets placed yet            | Empty state: "No bets yet. Go place your first prediction!" with CTA → Main Page |
| 🟡 Pending Commit | Recent bets not yet committed | ⏳ icon on uncommitted rows. "Pending commit" label. History still viewable      |
| 🔵 Loading        | Fetching history              | Skeleton rows while loading                                                      |

---

## Scope Boundaries

<aside>
🚫

**Out of scope for current sprint:**

</aside>

- ❌ CSV export
- ❌ Advanced analytics (charts, streaks, heatmaps)
- ❌ Leaderboard / social features
- ❌ Push notifications for bet results

These are intentionally deferred. The goal is _"just enough history"_ — clarity, not a trading terminal.

---

## Navigation

- **← Back** → Main Page (Grid)
- **Bet row tap** → Expand detail view (inline)
- **⛓️ Verified link** → Block explorer (external)
- **Empty state CTA** → Main Page

---

## Data Dependencies
