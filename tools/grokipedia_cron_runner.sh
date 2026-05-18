#!/usr/bin/env bash
# Grokipedia re-probe runner.
#
# Walks the victim DB and probes grokipedia.com for matches the strict-phrase
# validator now accepts but didn't on the prior run. Grokipedia adds ~10k
# new articles per month; running every six months catches the long tail
# of Iranian victim profiles that get added to the encyclopedia after our
# initial pass.
#
# Scheduling: pinned via crontab to 13th May + 13th November at 04:00 UTC.
# That's ~6 months apart and aligned with the initial 2026-05-13 apply.
#
# Idempotent: --recheck=false (default) skips victims that already have a
# grokipedia source row, so a re-run only touches new candidates plus any
# previously-rejected names whose page coverage grew on Grokipedia's side.
#
# All output is appended to /var/log/iran-memorial/grokipedia.log so old runs
# are auditable.

set -euo pipefail

LOG="/var/log/iran-memorial/grokipedia.log"
APP_DIR="/opt/iran-stack/iran-memorial"

mkdir -p "$(dirname "$LOG")"

{
  echo ""
  echo "=========================================="
  echo "  Grokipedia recheck $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "=========================================="

  cd "$APP_DIR"
  # shellcheck disable=SC1091
  set -a; . .env; set +a

  # Bail fast if the python deps aren't installed (newly-spun-up host).
  python3 -c 'import asyncpg, aiohttp' \
    || { echo "ERROR: asyncpg/aiohttp missing. apt-get install python3-asyncpg python3-aiohttp"; exit 1; }

  python3 -m tools.enricher grokipedia \
    --apply \
    --concurrency 6

  echo "  finished $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} >> "$LOG" 2>&1
