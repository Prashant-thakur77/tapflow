# Product Specification: Tap.fun

## 1. Overview

The product is a "Prediction Gaming" platform based on the infrastructure of **tap.fun**, but uses a user interface (UI) styled after **Euphoria**.

- **Core Logic:** Windowed One-Touch (Predicts price spikes within a timeframe).

- **Visual Style:** Dark theme, Neon Pink/Purple, Grid-based layout.

- **Target:** Mode 20 (Price fluctuation of $20, timeframe of 5 seconds).

---

## 2. UI/UX Breakdown Analysis

Based on the "Euphoria" design and "tap.fun" logic, the interface is divided into 3 main areas:

### 2.1. Sidebar (Left)

- **Function:** High-level navigation.

- **Items:**

- Logo (Euphoria/Tap.fun)

- **Trade** (Main screen)

- Leaderboard

- Profile (Account information, betting history)

- **Style:** Fixed left, minimalist.

### 2.2. Main Trading View (Center & Right) - "The Grid"

This is the heart of the product (Windowed One-Touch).

- **X-Axis (Time):**

- Displays future time milestones (T+5s, T+10s...).

- Logic: Each column corresponds to an interval (e.g., 5s for Mode 20).

- **Y-Axis (Price):**

- Displays price levels (Price Bands).

- Logic: Each row represents a price level spaced $20 apart (Mode 20).

- **Cells:**

- Each cell contains a **Multiplier** (e.g., 68.4x, 2.02x).

- **Status:**

- _Active:_ Bets can be placed.

- _Past/Expired:_ Past, faded.

- _Hit:_ Price has touched this cell (User wins).

- **Chart:**

- The price line (Line chart) runs in real-time.

- The current dot (The dot) blinks at the top of the price line.

- The price line is drawn over a grid to clearly show the trend towards which cell.

### 2.3. Header & Footer

- **Header:**

- Wallet balance.

- Current price of the asset (BTC/ETH).

- Countdown timer (for the next session or candle).

- **Footer:** Timeline displays the system time.

---

## 3. Business Logic (SSOT)

### 3.1. Windowed One-Touch Mechanism (Mode 20)

- **Input:** The user selects a cell (Price Band, Time Window).

- **Win Condition:** The Oracle price (Binance/OKX) touches the selected Price Band WITHIN that Time Window.

- **Data:** OHLC 1 second (to capture candle wicks).

### 3.2. Pricing Engine (Frontend Display)

- The frontend receives Multiplier data stream from the backend (via WebSocket).

- The backend formula used: _Brownian Bridge Formula_.

- The frontend **does not** calculate the ratio itself, it only displays it.

- **Color Multiplier:**

- High Multiplier (>10x): Bright/prominent colors (High risk/High reward).

- Low Multiplier (<2x): Darker colors.

### 3.3. Technical Flow

1. **Init:** Load static Grid, fetch Mode 20 configuration.

2. **Socket Connection:**

- Receive `price_update`: Draw line chart.

- Receive `grid_update`: Update data in Multiplier cells.

3. **Action:** User clicks cell -> Submit Order -> Waits for Server confirmation (WAL logs) -> UI reports "Bet Placed".

---

## 4. Frontend Requirements

- **Framework:** Next.js / React.

- **Styling:** Tailwind CSS.

- **State Management:** Zustand (manages fast-data such as prices).

- **Chart:** Custom SVG or Recharts/Lightweight-charts (but needs a transparent background to overlay on the grid).

- **Color Palette (Euphoria):**

- Main Background: `#130516` (Deep Purple/Black).

- Grid Lines: `#3d1e36` (Muted Pink).

- Accent: `#ff4f9a` (Neon Pink).

- Text: `#e0e0e0` / `#ff9ebd`.
