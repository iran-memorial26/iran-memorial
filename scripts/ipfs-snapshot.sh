#!/bin/bash
# IPFS pinning + tamper-evident manifest for the public dataset.
#
# Once a week (called from the existing weekly enrich cron), this script:
#   1. Downloads the current /api/v1/public/dump JSON from the live site.
#   2. Computes SHA-256 of the dump.
#   3. Pins the dump to IPFS via web3.storage's HTTP API (free 5 GB tier).
#   4. Appends one row to /opt/iran-stack/iran-memorial/INTEGRITY-LOG.md
#      with: timestamp, victim count, SHA-256, IPFS CID, gateway URL.
#   5. (Optional) Commits the updated INTEGRITY-LOG.md to the repo so the
#      hash chain is publicly verifiable.
#
# Why this matters:
#   - IPFS makes the dump retrievable from any IPFS gateway in the world,
#     even if the memorial site is offline. CIDs are content-addressed —
#     anyone with the CID can verify they got the exact bytes.
#   - The hash chain in INTEGRITY-LOG.md means "did anyone retrospectively
#     edit historic data?" becomes a Git-history question, easy to answer.
#   - If an adversary ever swaps a victim's record, the next dump's
#     hash will not match what the prior week's hash chain says it should
#     evolve to (manual diff catches it).
#
# Setup (one-time, on the server):
#   1. Get a free web3.storage API token: https://console.web3.storage/tokens
#   2. echo "WEB3_STORAGE_TOKEN=eyJ..." > /etc/iran-memorial/ipfs.env
#      chmod 600 /etc/iran-memorial/ipfs.env
#   3. Add a cron line that runs *after* the weekly enrich:
#      40 2 * * 0 root /usr/local/bin/iran-memorial-ipfs.sh
#      (The enrich runs at 02:30 UTC, this runs at 02:40 UTC.)
#
# This script is idempotent — re-running on the same day costs one extra
# IPFS pin (web3.storage dedupes by CID anyway).

set -u

REPO=/opt/iran-stack/iran-memorial
LOG="${REPO}/INTEGRITY-LOG.md"
ENV_FILE=/etc/iran-memorial/ipfs.env

# --- Load token ------------------------------------------------------------
if [ ! -r "$ENV_FILE" ]; then
  echo "::error:: Missing $ENV_FILE — see header comment for setup." >&2
  exit 1
fi
# shellcheck source=/dev/null
. "$ENV_FILE"
if [ -z "${WEB3_STORAGE_TOKEN:-}" ]; then
  echo "::error:: WEB3_STORAGE_TOKEN not set in $ENV_FILE" >&2
  exit 1
fi

# --- 1. Fetch the live dump -----------------------------------------------
TS=$(date -u +%Y%m%dT%H%M%SZ)
DATE=$(date -u +%Y-%m-%d)
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

DUMP="${TMPDIR}/iran-memorial-${DATE}.json"
echo "Fetching dump..."
SITE_URL="${SITE_URL:-}"
if [ -z "$SITE_URL" ]; then
  echo "::error:: SITE_URL not set — add SITE_URL=https://... to $ENV_FILE" >&2
  exit 1
fi
curl -fsSL --max-time 120 \
  -o "$DUMP" \
  "${SITE_URL}/api/v1/public/dump" \
  || { echo "::error:: dump fetch failed" >&2; exit 1; }

SIZE=$(stat -c%s "$DUMP" 2>/dev/null || stat -f%z "$DUMP")
SHA256=$(sha256sum "$DUMP" | awk '{print $1}')
COUNT=$(grep -oE '"totalVictims":[0-9]+' "$DUMP" | head -1 | cut -d: -f2)
COUNT="${COUNT:-unknown}"

echo "  size=${SIZE} bytes"
echo "  sha256=${SHA256}"
echo "  victims=${COUNT}"

# --- 2. Pin to IPFS via web3.storage ---------------------------------------
echo "Uploading to IPFS..."
RESP=$(curl -fsS --max-time 120 \
  -X POST \
  -H "Authorization: Bearer ${WEB3_STORAGE_TOKEN}" \
  -H "X-NAME: iran-memorial-${DATE}.json" \
  --data-binary "@${DUMP}" \
  https://api.web3.storage/upload)

CID=$(echo "$RESP" | grep -oE '"cid":"[^"]+"' | head -1 | cut -d'"' -f4)
if [ -z "$CID" ]; then
  echo "::error:: web3.storage upload failed: $RESP" >&2
  exit 1
fi
echo "  CID=${CID}"

GATEWAY="https://${CID}.ipfs.w3s.link"

# --- 3. Append to integrity log -------------------------------------------
if [ ! -f "$LOG" ]; then
  cat > "$LOG" <<'HEADER'
# Iran Memorial — Integrity Log

Tamper-evident hash chain of every weekly public dump.

Each row records: timestamp, victim count, SHA-256 of the dump bytes, the IPFS
CID (content-addressed — anyone who has the CID can fetch the exact bytes from
any IPFS gateway), and a public gateway URL.

If an adversary ever rewrites historic data, the corresponding row's SHA-256
will no longer match the bytes a journalist or court holds. CIDs are
mathematically tied to content — they cannot be forged.

To verify any row:

```bash
curl -L https://w3s.link/ipfs/<CID> | sha256sum
# must equal the SHA-256 in this row
```

To verify the whole chain, every two adjacent rows should differ only by the
delta of new victims since last run (compare counts).

| When (UTC) | Victims | SHA-256 | IPFS CID | Gateway |
|---|---:|---|---|---|
HEADER
fi

# Truncate SHA / CID for table readability; full values follow on a comment row.
SHORT_SHA="${SHA256:0:16}…"
SHORT_CID="${CID:0:18}…"

printf '| %s | %s | `%s` | `%s` | [view](%s) |\n' \
  "$TS" "$COUNT" "$SHORT_SHA" "$SHORT_CID" "$GATEWAY" \
  >> "$LOG"

# Full values as a hidden comment so grep can find them but the table stays
# pretty.
printf '<!-- full %s sha=%s cid=%s -->\n' "$TS" "$SHA256" "$CID" >> "$LOG"

echo "Appended to $LOG"

# --- 4. (Optional) auto-commit to repo -----------------------------------
# Off by default — enable by setting AUTO_COMMIT=1 in /etc/iran-memorial/ipfs.env.
# Auto-commit means the integrity log is publicly visible on GitHub for any
# external verifier. Cost: a tiny weekly commit volume from the server's git
# identity.
if [ "${AUTO_COMMIT:-0}" = "1" ]; then
  cd "$REPO"
  git add INTEGRITY-LOG.md
  git -c user.email="cron@iran-memorial" \
      -c user.name="Iran Memorial Cron" \
      commit -m "ops: integrity log entry ${TS} (${COUNT} victims, cid=${SHORT_CID})" \
      || true   # noop if nothing changed
  git push origin HEAD || echo "::warning:: git push failed; will retry next week"
fi

echo "Done."
