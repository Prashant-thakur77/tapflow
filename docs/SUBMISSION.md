# DoraHacks submission — copy/paste

**BUIDL name:** TapFlow

**Tagline:** One tap on the next five minutes. Follow the best tappers. Their taps mirror into yours in the same block.

**Tags:** Somnia, dreamDEX, DeFi, Crypto-AI, Prediction Markets, Event Contracts

**Track:** Open Track

**Links**
- GitHub: https://github.com/Prashant-thakur77/tapflow (public)
- Live app: https://tapflow-phi.vercel.app
- Demo video: `<upload link>`
- Same-block proof on the explorer: https://shannon-explorer.somnia.network/block/482322170

**Description (one paragraph)**

TapFlow turns every live DreamDEX Event Contract into a one-tap UP/DOWN call and makes the best tappers followable. Each window is a real binary market on Somnia Shannon; a tap is a real immediate-or-cancel order on the on-chain book, sized over the live order book with the venue's own tick/lot grid. After one funding popup, a capped session wallet signs every tap silently. The part nobody else shows: a leader's tap is broadcast through a Router contract, and a `SomniaEventHandler` subscribed to that event places every follower's proportional order **in the same block** through a capped MirrorVault — no keeper, no relayer. We proved it on-chain for both UP and DOWN (blocks 482312219 and 482322170), with a second reactive handler that pauses a follower at their max-loss, and a vault that redeems each follower's winning shares through the market module after settlement. A fills indexer builds a PnL/streak leaderboard from chain, a momentum agent ("TapBot") taps as a public leader — 50+ real taps, 25 on-chain copies, a 30W/22L settled record — behind a risk gate that publishes its holds with reason codes, auto-claims its winnings, and trades the shortest live cadence; followers see their vault, withdraw or unfollow in one tap, and get a toast the moment a mirror lands. Any Somnia dapp can embed a live tap card in an iframe. A Telegram bot ([@TapFlowSomniaBot](https://t.me/TapFlowSomniaBot)) exposes the same flow, with the app as its mini-app. Everything in the demo path is a real transaction; a 20-item SDK and docs feedback report is included.

**What's real (judge checklist)**
- 4 contracts deployed on Shannon (v3: followers redeem mirrored winnings through the market module), reactivity subscription 16910004 live, 19/19 Foundry tests, 51/51 same-block mirrors, follower winnings redeemed on-chain through the vault.
- Real taps, broadcasts, and reactive mirrors with tx hashes in the README.
- Leaderboard: 76 wallets / 345 taps / 7.2k tUSDC indexed from chain.
- Nothing mocked. Keys are testnet throwaways.

**Somnia × DreamDEX surface used**
`listLiveBinaryMarkets`, `getMarketOnchain`, `getBinaryOrderBook`, `getBinaryBookParams`, `quoteBinaryStakeOverBook`, `trader.placeOrder` (IOC), `trader.faucet`, `getOutcomeBalance`, `getClaimable`, `trader.redeem`, `getUserFills`/`getFills`, `fetchPrice`/`useLivePriceTicks`, React live hooks; `@somnia-chain/reactivity-contracts` `SomniaEventHandler` + `SomniaExtensions.subscribe`.

**After the hackathon**
Mainnet with the builder-fee hook as revenue; non-custodial operator session keys (`placeOrderFor`); open the agent framework so anyone can list a strategy as a leader.
