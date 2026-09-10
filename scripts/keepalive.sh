#!/usr/bin/env bash
# Keep one service running: restart it if it exits (transient network errors on
# boot, RPC hiccups). Usage: scripts/keepalive.sh <dir> [log]
#   nohup scripts/keepalive.sh agent  > agent.log  2>&1 &
#   nohup scripts/keepalive.sh tg-bot > tgbot.log  2>&1 &
set -u
cd "$(dirname "$0")/../$1" || exit 1
while true; do
  echo "$(date -u +%FT%TZ) starting $1"
  npm start
  echo "$(date -u +%FT%TZ) $1 exited ($?), restarting in 10s"
  sleep 10
done
