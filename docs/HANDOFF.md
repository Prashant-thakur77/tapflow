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

## In progress when this handoff was written (voice + restructure)

User asked for: (1) an AI voice with **Chatterbox TTS** so the video is not silent, (2) the script restructured as **problem → how we solve it → why this stack (DreamDEX Event Contracts, markets SDK, Somnia Reactivity)** → proof, (3) the user's **Telegram phone clip** spliced in (expected at `docs/media/telegram.mp4`; not delivered yet), reference style: https://www.youtube.com/watch?v=ubnzboSC8NM (a hackathon demo submission).

Done so far:
- `scripts/demo-lines.mjs` — the new narration, one array per scene (problem-first), plus a `telegram` scene.
- `scripts/tts.py` — Chatterbox generator: one wav per line into `video/tts/`, plus `durations.json`. Voice: Chatterbox built-in, exaggeration 0.35, cfg 0.55. Run with `~/tts/.venv/bin/python scripts/tts.py` from the repo root.
- Chatterbox install: `uv venv --python 3.11 ~/tts/.venv && uv pip install chatterbox-tts` was running in the background (`~/tts/install.log`, ends with `exit 0` when done). GPU: RTX 3050 6GB. First run downloads the model from Hugging Face.
- `scripts/record-demo.mjs` — scene holds now follow `video/tts/durations.json` when it exists (`need()` / `holdFor()`), so a voiced take never needs freeze frames.

NOT done (the file write failed, redo it): `scripts/cut-demo.mjs` must (a) import `LINES` from `./demo-lines.mjs`, (b) when `video/tts/durations.json` exists build one segment per line from the silent cut with the wav under it (`tpad=stop_mode=clone` if the line outruns the picture, `apad` otherwise, `aresample=48000` + mono, concat v+a, `loudnorm`), (c) splice `docs/media/telegram.mp4` (scaled/padded to 1280×800) before the `close` scene with the `telegram` line, (d) burn captions with the new times. Then: run `tts.py` → re-record (`DEMO_APP`/`DEMO_API` local, agent paused) → `cut-demo.mjs` → review frames → commit/push → send the mp4 to the user.

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
2. Drop the Telegram phone clip at `docs/media/telegram.mp4` if it should be in the video.
3. Optional: a free UptimeRobot monitor on `https://tapflow-indexer.onrender.com/api/health`.
