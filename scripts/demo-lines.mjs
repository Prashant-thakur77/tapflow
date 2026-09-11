// The demo narration, one array per scene. Used three ways:
//   scripts/tts.py        → one audio clip per line (Chatterbox)
//   scripts/record-demo   → holds each scene long enough for its lines
//   scripts/cut-demo      → captions + voice track
// Order: the problem, how TapFlow solves it, why this stack, then the proof.

export const LINES = {
  landing: [
    "Prediction markets have a problem. Every trade is solo: connect a wallet, approve a token, read an order book, sign, wait. And if you want to copy someone who is good, you can't — not on-chain, not in time.",
    "Copy trading everywhere else runs on bots and relayers. By the time your copy lands, the price has moved. On five-minute markets, a block late is too late.",
    "TapFlow fixes both. Every live DreamDEX Event Contract becomes a one-tap UP or DOWN call, and following a leader means your order is placed in the SAME BLOCK as theirs, by the chain itself.",
  ],
  tap: [
    "This is the tap screen. One window: the countdown, the price against where it opened, and the crowd's odds. Tap UP or DOWN and your stake becomes a real immediate-or-cancel order on the live on-chain book.",
    "Below, the crowd-odds line from one-minute candles, and who holds what on this window, read straight from the pool's own logs.",
    "Fund a capped session wallet once, and every tap and every claim signs itself. No wallet popups. On desktop, the arrow keys tap.",
  ],
  markets: [
    "Every live window on the venue as a card, with quick taps. Any Somnia app can embed one of these cards in an iframe.",
    "Why DreamDEX Event Contracts? They are real binary markets with a real on-chain order book, rolled every few minutes, with oracle settlement. That is exactly what one-tap trading needs, and the Somnia markets SDK gives us the book, the quotes and the orders without a backend of our own.",
  ],
  leaders: [
    "The leaderboard is built from chain, ranked by realized profit on settled windows. TapBot is our agent: a momentum strategy that taps as a public leader you can follow like any human. Dozens of real taps, a settled record, and every copy it triggered is on-chain.",
    "When it does not trade, it says why. Price too high, spread wider than the edge, cooling down. Every hold is published with its reason code, so a follower knows what they are following.",
  ],
  proof: [
    "Now the part only Somnia makes possible. Somnia's reactivity precompile lets a contract subscribe to an event and be invoked inside the very block that emits it. No keeper, no relayer, no bot. We built our copy engine on that.",
    "This page pairs every reactive mirror with the broadcast that triggered it. Let's add one now, live.",
  ],
  "mirror-live": [
    "A real leader tap goes in. It fills. It is broadcast through the Router contract.",
    "And there is the follower's order: placed by the CopyHandler contract, from the follower's vault, in the same block.",
  ],
  "mirror-row": ["Our indexer reads it from chain and the new row lands at the top of the table, with both transactions and the block number."],
  "mirror-row-ready": [
    "Same block, every time. A row that placed nothing is the safety rail: the vault checked the follower's own max-loss cap and declined, and a second reactive contract, RiskGuard, pauses a follower who hits their cap.",
  ],
  "mirror-row-missing": ["The indexer pairs this mirror with its broadcast on its next pass, as it has for every one before it."],
  "explorer-tx": [
    "Here is the mirror on the Shannon explorer. Status success, method onEvent, sent from the CopyHandler contract. No externally owned account signed this. That is Somnia reactivity placing a follower's trade in the leader's block.",
  ],
  telegram: [
    "The same flow lives in Telegram. The bot reads the live book, and one command places a real order from the chat, with the fill and the transaction in the reply. The app opens as a mini-app, so a follower never needs a browser.",
  ],
  close: [
    "Followers redeem mirrored winnings through the vault. Every number you saw is read live from Somnia Shannon, and every transaction is real.",
    "The code, the contracts, and a twenty-item feedback report on the DreamDEX SDK are in the repo. TapFlow: tap once, and the chain copies you in the same block.",
  ],
};
