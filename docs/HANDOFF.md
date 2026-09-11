# TapFlow — handoff for a new chat

Paste this into a fresh session. It has everything the next session needs; secrets are referenced by file path, never by value.

## What this is

TapFlow: one-tap UP/DOWN on live DreamDEX Event Contract windows on Somnia Shannon, with copy-trading where a follower's order is placed **in the same block** as the leader's via Somnia Reactivity. Entry for the Somnia × DreamDEX Event Contracts hackathon on DoraHacks ($5k pool). **Deadline: 11 Sep 2026, 23:30 IST — today.** Submission needs a public GitHub link and a demo video (most forms want a YouTube link).

Judging: DreamDEX integration/tech 25%, innovation 20%, UX 20%, ecosystem impact 20%, demo 15%.

## Where everything is

| Thing | Location |
|---|---|
| Repo (local) | `/home/prashant/tapflow` — always `cd /home/prashant/tapflow` explicitly before npm/vercel/git; cwd drifts between commands and has created stray Vercel projects before |
| Repo (public) | https://github.com/Prashant-thakur77/tapflow — origin `main`, push credential in `~/.git-credentials`, CI green (`.github/workflows/ci.yml`) |
| Live app | https://tapflow-phi.vercel.app (Vercel project `tapflow`, prebuilt deploy: `VITE_TAPFLOW_API=<indexer> vercel build --prod --yes && vercel deploy --prebuilt --prod --yes`) |
| Hosted indexer | https://tapflow-indexer.onrender.com (Render free tier from `render.yaml`; sleeps after 15 min idle, slow scanners; `api-url.json` in the repo tells the deployed app where the indexer is at runtime — change that file and push, no rebuild) |
| Telegram bot | @TapFlowSomniaBot, live, read-only. Token in `tg-bot/.env` (gitignored, chmod 600). Commands/description/menu button already set via the Bot API |
| Leader wallet key | `PRIVATE_KEY` in `/home/prashant/tapflow/.env` → `0x679812634968c86fb39D943a0a34DA7755b3F228` (also TapBot's key via `agent/.env` AGENT_PRIVATE_KEY). ~13 STT, ~10,400 tUSDC |
| Follower wallet key | `FAUCET_HELPER_KEY` in the same `.env` → `0x1AD9291f94baD83C9ACe77B204141d1AF7C02015`. ~18 STT after funding RiskGuard |
| Contracts | `contracts/deployments.json` (v4): Router `0x5120…9Cc`, MirrorVault `0x535A…aE95`, CopyHandler `0x969B…b321` (reactivity sub 16910004, ~33 STT gas tank), RiskGuard `0x03A5…E3b7` (sub 17880662, 33 STT). Foundry tests 19/19 |
| Reference repos | `~/tapflow/refs/` (gitignored): dreamdex-bot-kit, ec-dreamdex-hackathon-template, tapl-*, strike*, somnia-react-autonomous |
| Assistant memory | `~/.claude/projects/-home-prashant/memory/tapflow-hackathon.md` (auto-loaded in new sessions) |
| Docs | `README.md`, `SDK-FEEDBACK.md` (20 items), `docs/SUBMISSION.md` (DoraHacks text), `docs/DEMO-SCRIPT.md`, `docs/HOSTING.md`, `docs/CONTRACTS.md`, `docs/UX.md` |

Chain: Somnia Shannon 50312, RPC https://dream-rpc.somnia.network, explorer https://shannon-explorer.somnia.network, venue `0x679795a0…8a28c`, tUSDC `0x70a8…5d8E` (6 dp), venue grid tick=lot=min=1000, `@somnia-chain/markets-sdk` ^0.28.1.

## State of the build (all done, all pushed)

- F1 tap screen, F2 session keys (popup-free taps), F3 contracts (same-block mirrors proven, 89+ mirrors, 100% same block, follower redeem through the vault), F4 indexer (chain-scanned fills, MarketCreated discovery, `/api/windows` fallback), F5 TapBot agent (risk gate with reason codes, auto cadence/asset, auto-claim, hold heartbeats), F6 Telegram bot (live), F7 README + SDK feedback.
- Extras: markets grid, embed route, proof page, leader pages, copy-vault card, mirror alerts, keyboard taps, `npm run doctor`, one-click Render/Railway blueprints.
- Demo video **done and committed**: `docs/media/tapflow-demo.mp4` (2:04, captioned, silent) and `tapflow-demo-silent.mp4`. A real leader tap → broadcast → same-block follower mirror is placed on camera at block 484945348. Pipeline: `scripts/record-demo.mjs` (Playwright; stamps a 12px colour marker per scene into the picture because the screencast clock drifts) → `scripts/cut-demo.mjs` (reads markers back, drops loading gaps, burns captions). Record against `DEMO_APP=http://localhost:5174 DEMO_API=http://localhost:8787` (local stack; Render is too slow to surface the row in time). Pause TapBot during a take (same key → nonce race), resume after.

## The video (done)

`docs/media/tapflow-demo.mp4` — **3 min 31 s, narrated and captioned**, and
`tapflow-demo-silent.mp4` (picture only). A real leader tap, its broadcast, and
the follower's same-block mirror are placed **and indexed** on camera at
[block 484969998](https://shannon-explorer.somnia.network/block/484969998).

The narration is written, not read aloud by a person:

| Step | Command |
|---|---|
| The script | `scripts/demo-lines.mjs` — one array per scene, ordered problem → how we solve it → why this stack → proof |
| The voice | `~/chatterbox-env/bin/python scripts/tts.py video/tts` — Chatterbox, one wav per line, plus `durations.json` |
| A take | `DEMO_APP=http://localhost:5174 DEMO_API=http://localhost:8787 node scripts/record-demo.mjs ./video` |
| The cut | `node scripts/cut-demo.mjs ./video` |

Chatterbox lives at **`~/chatterbox-env`** (a `~/tts/.venv` install was started and
abandoned; the model is cached under `~/.cache/huggingface`). After generating,
the wavs are trimmed and slowed to about 196 words per minute; the untouched
originals stay in `video/tts/raw/`.

The recorder holds each scene at least as long as its lines take to say, so the
picture tracks the voice. The cut lays one segment per spoken line, freezes the
last frame when a line outruns its shot, trims a shot that sits more than 2.5 s
past its line, and burns the captions on the new timing.

**Still open:** the user's Telegram phone clip. Drop it at
`docs/media/telegram.mp4` and re-run the cut — it is scaled onto the video's own
background, played up to 1.8x so it fits its line, and spliced in before the
closing scene. The shot list is `docs/TELEGRAM-CLIP.md`.

Two things that cost a take:

- **Never run two cuts on the same take directory at once.** They share
  `video*/seg` and `voiced.mp4`, and the result is a corrupt mp4 (`moov atom not
  found`, `Invalid NAL unit size`).
- A Playwright `.hover()` that misses **waits its full 30 s timeout inside the
  scene**. That is why one markets shot ran 52 s; the cut's silence cap now
  trims it, but the take is still slow.

## Wallets in Telegram (11 Sep)

Telegram's mini-app webview injects no EIP-1193 provider, so MetaMask cannot
reach it. Both fixes are in:

- **The bot taps.** `BOT_PRIVATE_KEY` is set in `tg-bot/.env` (chmod 600,
  gitignored) to a wallet created for this: `0x07e67564573dbFa5F99869230c210707417362E9`,
  funded with 2.5 STT from the leader wallet and 500 tUSDC from the token's
  public `faucet(uint256)`. `/up` and `/down` now place real IOC orders, capped
  at `MAX_STAKE` (25 tUSDC). Verified with a real tap: 2.04 shares at 48 per
  cent, tx `0x614290dfd6a7fd7d304b92df1aadbff57860428035cc3c76d5a5ca9bf70c19de`.
  It is a shared demo wallet and `/start` says so. It is deliberately **not**
  the leader key, which TapBot signs with — the two would race on the nonce.
- **WalletConnect.** `src/components/Provider.tsx` adds the connector whenever
  `VITE_WALLETCONNECT_PROJECT_ID` is set at build time, and `pickConnector()` in
  `src/lib/wallet.ts` chooses injected when the browser has one and
  WalletConnect otherwise. **Still needs the id** (free, cloud.reown.com), then:

  ```bash
  cd /home/prashant/tapflow
  VITE_TAPFLOW_API=https://tapflow-indexer.onrender.com \
  VITE_WALLETCONNECT_PROJECT_ID=<id> vercel build --prod --yes
  vercel deploy --prebuilt --prod --yes
  ```

  Unset, the app behaves exactly as it did before.

## Laptop services (restart after any reboot)

```bash
cd /home/prashant/tapflow
cd indexer && PORT=8787 BACKFILL=30 AGENT_ADDRESS=0x679812634968c86fb39D943a0a34DA7755b3F228 nohup npm start > /tmp/indexer.log 2>&1 &   # local indexer for scripts + demo
cd /home/prashant/tapflow && nohup scripts/keepalive.sh agent  > /tmp/agent.log 2>&1 &     # TapBot (posts feed to Render AND local: TAPFLOW_API comma list in agent/.env)
cd /home/prashant/tapflow && nohup scripts/keepalive.sh tg-bot > /tmp/tgbot.log 2>&1 &     # Telegram bot
cd /home/prashant/tapflow && VITE_TAPFLOW_API=http://localhost:8787 nohup npx vite --port 5174 --strictPort > /tmp/vite.log 2>&1 &   # local app for recording
while true; do curl -s -m 60 -o /dev/null https://tapflow-indexer.onrender.com/api/health; sleep 240; done &   # keeps Render awake
npm run doctor   # one-screen preflight
```

Kill a service by cwd, never with `pgrep -f` (it matches the shell and exits 144): `for p in $(pgrep -x node); do [ "$(readlink /proc/$p/cwd)" = "/home/prashant/tapflow/agent" ] && kill $p; done`.

## Gotchas learned

- Somnia RPC caps `eth_getLogs` at 1000 blocks; go wide with concurrent calls, never a wider range.
- Upstream Somnia indexer times out and lists new windows late; the app merges chain-discovered windows from our indexer.
- Blockscout's block page never paints in headless Chromium (skeleton only); the tx page does.
- `forge script` fails on the reactivity precompile; deploy with `forge create --gas-limit 20000000` + `cast send` without `--gas-limit`.
- A reactive subscription needs ≥32 STT in the **contract**; faucet is 50 STT/day per Telegram user.
- Render free tier sleeps; the hosted leaderboard lags when nobody pings it.

## What the user still has to do

1. Submit on DoraHacks before 23:30 IST today: repo link + video link (upload `docs/media/tapflow-demo.mp4` to YouTube unlisted). Text in `docs/SUBMISSION.md`.
2. Record the Telegram phone clip (`docs/TELEGRAM-CLIP.md` is the shot list), save it at
   `docs/media/telegram.mp4`, and re-run `node scripts/cut-demo.mjs ./video3`.
3. Optional: a free UptimeRobot monitor on `https://tapflow-indexer.onrender.com/api/health`.
