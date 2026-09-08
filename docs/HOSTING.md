# Hosting the indexer off a laptop

The web app is on Vercel and needs nothing. The **indexer** (F4) is the piece that
runs locally today, behind a cloudflared quick tunnel, so if the laptop sleeps the
leaderboard, proof page and markets fallback go quiet. It is read-only against
Somnia Shannon — **no private key, no secrets** — so it is safe to host anywhere.

Its SQLite file rebuilds itself from chain on a fresh host in about five minutes,
so an ephemeral disk is fine and no volume is needed. `BACKFILL` decides how many
settled windows it pulls before the fill scanners run; it is 500 in the blueprint,
which covers the whole history of this venue so far. Set it lower only if you want
a faster, thinner start.

## Render (free, no card)

1. Sign in at [render.com](https://render.com) with GitHub.
2. **New → Blueprint**, pick `Prashant-thakur77/tapflow`, **Apply**.
   It reads [`render.yaml`](../render.yaml): root `indexer/`, `npm ci`, `npm start`,
   health check on `/api/health`.
3. When it goes live, copy the service URL (something like
   `https://tapflow-indexer.onrender.com`) and put it in
   [`api-url.json`](../api-url.json):

   ```json
   { "api": "https://tapflow-indexer.onrender.com", "updatedAt": "2026-09-08" }
   ```

   Commit and push. The deployed app reads that file at runtime, so **no rebuild
   is needed** — the change is live on the next page load.
4. Stop the local tunnel (`pkill -f scripts/tunnel.sh`) so it cannot overwrite
   `api-url.json` with a laptop URL again.

Free Render services sleep after 15 minutes idle and take ~30 s to wake. For
judging that is usually fine; hitting the URL once before a demo wakes it.

## Railway (also free tier)

1. Sign in at [railway.app](https://railway.app) with GitHub.
2. **New Project → Deploy from GitHub repo → tapflow**.
3. It reads [`railway.json`](../railway.json). Add no variables; the defaults in
   `indexer/src/config.ts` are correct. Optionally set `AGENT_ADDRESS` to
   `0x679812634968c86fb39D943a0a34DA7755b3F228` so the leaderboard labels TapBot.
4. **Settings → Networking → Generate Domain**, then do step 3 above with that URL.

## Checking it

```bash
curl https://<your-host>/api/health     # { ok: true, lastBlock: … }
curl https://<your-host>/api/proof      # mirrors, sameBlock, latest rows
npm run doctor                          # also checks whatever api-url.json points at
```

The first minutes after a fresh deploy show low counts while the chain scanners
catch up from block 482,300,000; `/api/health`'s `lastBlock` climbs as they do.
