#!/usr/bin/env bash
# Weekly photo mirror + dedup sweep.
# 1. photo-mirror: downloads new + retries failed external photo URLs to /var/photos
# 2. photo-dedupe: SHA-256 + pHash for any new files + hardlink exact duplicates
# Disk-aware: aborts if /var has < 1 GB free to avoid filling root.
set -euo pipefail
cd /opt/iran-stack/iran-memorial
source .venv/bin/activate
set -a; . ./.env; set +a

free_mb=$(df --output=avail / | tail -1 | awk "{print int(\$1/1024)}")
if [ "$free_mb" -lt 1024 ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ABORT: only ${free_mb}MB free on /, skipping mirror"
    exit 1
fi

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "=== $ts mirror+dedup start (free=${free_mb}MB) ==="
python3 -m tools.enricher photo-mirror --apply 2>&1
python3 -m tools.enricher photo-dedupe --hardlink 2>&1
echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) mirror+dedup done ==="
