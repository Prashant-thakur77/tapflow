#!/usr/bin/env bash
# Keep a cloudflared quick tunnel in front of the local indexer and publish its
# URL in api-url.json (read by the deployed app at runtime), so a tunnel restart
# never needs a Vercel rebuild. Restarts the tunnel if it dies.
#   nohup scripts/tunnel.sh > tunnel.log 2>&1 &
set -u
cd "$(dirname "$0")/.."
BIN=${CLOUDFLARED:-$HOME/.local/bin/cloudflared}
PORT=${PORT:-8787}
while true; do
  LOG=$(mktemp)
  "$BIN" tunnel --url "http://localhost:$PORT" --no-autoupdate > "$LOG" 2>&1 &
  PID=$!
  URL=""
  for _ in $(seq 1 40); do
    sleep 1
    URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" "$LOG" | head -1)
    [ -n "$URL" ] && break
  done
  if [ -n "$URL" ]; then
    echo "$(date -u +%FT%TZ) tunnel up: $URL"
    if [ "$(python3 -c "import json;print(json.load(open('api-url.json')).get('api',''))" 2>/dev/null)" != "$URL" ]; then
      printf '{ "api": "%s", "updatedAt": "%s" }\n' "$URL" "$(date -u +%FT%TZ)" > api-url.json
      git add api-url.json && git commit -qm "ops: tunnel url → $URL" && git push -q && echo "published api-url.json"
    fi
  else
    echo "$(date -u +%FT%TZ) tunnel did not come up"; tail -3 "$LOG"
  fi
  wait $PID
  echo "$(date -u +%FT%TZ) tunnel exited, restarting in 5s"
  sleep 5
done
