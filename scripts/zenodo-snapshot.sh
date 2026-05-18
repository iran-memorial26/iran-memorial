#!/bin/bash
# Zenodo DOI publication for Iran Memorial weekly dumps.
#
# Why: a citable DOI per snapshot is what academia and journalism need to
# reference the dataset in papers, theses, court briefs, sanctions dossiers.
# Zenodo (CERN-operated, EU jurisdiction, free) gives permanent DOIs that
# resolve forever — even if Iran Memorial itself ever disappears.
#
# Strategy: monthly cadence, not weekly. Zenodo records are forever; we
# don't need to flood the registry. Once a month is the right granularity
# for cite-in-paper.
#
# Setup (one-time, on the server):
#   1. Get a Zenodo API token: https://zenodo.org/account/settings/applications/tokens/new/
#      Scopes: deposit:write, deposit:actions
#   2. echo "ZENODO_TOKEN=..." > /etc/iran-memorial/zenodo.env
#      echo "ZENODO_PARENT_DOI=10.5281/zenodo.NNN" >> /etc/iran-memorial/zenodo.env
#      chmod 600 /etc/iran-memorial/zenodo.env
#      (ZENODO_PARENT_DOI is the "concept DOI" returned after the FIRST
#       publication — it links every monthly snapshot as versions of one
#       conceptual record. Leave empty for the first run, fill in after.)
#   3. Cron: first Sunday of each month, 03:00 UTC
#      0 3 1-7 * 0 root /usr/local/bin/iran-memorial-zenodo.sh

set -u

ENV_FILE=/etc/iran-memorial/zenodo.env
if [ ! -r "$ENV_FILE" ]; then
  echo "::error:: Missing $ENV_FILE — see header comment for setup." >&2
  exit 1
fi
# shellcheck source=/dev/null
. "$ENV_FILE"

if [ -z "${ZENODO_TOKEN:-}" ]; then
  echo "::error:: ZENODO_TOKEN not set in $ENV_FILE" >&2
  exit 1
fi

DATE=$(date -u +%Y-%m-%d)
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
DUMP="${TMPDIR}/iran-memorial-${DATE}.json"
TITLE="Iran Memorial — Weekly Dataset Snapshot ${DATE}"

SITE_URL="${SITE_URL:-}"
if [ -z "$SITE_URL" ]; then
  echo "::error:: SITE_URL not set — add SITE_URL=https://... to $ENV_FILE" >&2
  exit 1
fi

# --- 1. Fetch the live dump ----------------------------------------------
curl -fsSL --max-time 180 \
  -o "$DUMP" \
  "${SITE_URL}/api/v1/public/dump"

VICTIMS=$(grep -oE '"totalVictims":[0-9]+' "$DUMP" | head -1 | cut -d: -f2)
SIZE_HUMAN=$(du -h "$DUMP" | cut -f1)

# --- 2. Either start a new deposit or version the existing parent --------
if [ -z "${ZENODO_PARENT_DOI:-}" ]; then
  # First-ever publication — create a fresh deposit.
  echo "Creating new Zenodo deposit (no parent DOI yet)..."
  CREATE=$(curl -fsS -X POST \
    -H "Authorization: Bearer ${ZENODO_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{}' \
    https://zenodo.org/api/deposit/depositions)
  DEPOSIT_ID=$(echo "$CREATE" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
  BUCKET=$(echo "$CREATE" | grep -oE '"bucket":"[^"]+"' | head -1 | cut -d'"' -f4)
else
  # Subsequent — create a new version under the parent concept DOI.
  PARENT_ID="${ZENODO_PARENT_DOI##*.}"   # strip "10.5281/zenodo." prefix
  echo "Creating new version of Zenodo record ${PARENT_ID}..."
  NEWVER=$(curl -fsS -X POST \
    -H "Authorization: Bearer ${ZENODO_TOKEN}" \
    "https://zenodo.org/api/deposit/depositions/${PARENT_ID}/actions/newversion")
  DEPOSIT_LINK=$(echo "$NEWVER" | grep -oE '"latest_draft":"[^"]+"' | cut -d'"' -f4)
  DEPOSIT_ID="${DEPOSIT_LINK##*/}"
  CREATE=$(curl -fsS \
    -H "Authorization: Bearer ${ZENODO_TOKEN}" \
    "https://zenodo.org/api/deposit/depositions/${DEPOSIT_ID}")
  BUCKET=$(echo "$CREATE" | grep -oE '"bucket":"[^"]+"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$DEPOSIT_ID" ] || [ -z "$BUCKET" ]; then
  echo "::error:: failed to create deposit. Response: $CREATE" >&2
  exit 1
fi
echo "  deposit_id=${DEPOSIT_ID}"

# --- 3. Upload the JSON file --------------------------------------------
echo "Uploading dump..."
curl -fsS -X PUT \
  -H "Authorization: Bearer ${ZENODO_TOKEN}" \
  --upload-file "$DUMP" \
  "${BUCKET}/iran-memorial-${DATE}.json" \
  > /dev/null

# --- 4. Set metadata -----------------------------------------------------
echo "Setting metadata..."
META=$(cat <<EOF
{
  "metadata": {
    "title": "${TITLE}",
    "upload_type": "dataset",
    "description": "<p>Snapshot of the Iran Memorial victim database (${VICTIMS} victims, ${SIZE_HUMAN} JSON) as of ${DATE}.</p><p>Iran Memorial documents victims of the Islamic Republic of Iran (1979–present), aggregating data from 12 verified human-rights and journalism sources. This dataset is licensed under <a href='https://creativecommons.org/licenses/by-sa/4.0/'>CC BY-SA 4.0</a>.</p><p>Live database: <a href='${SITE_URL}'>${SITE_URL}</a> · Code: <a href='https://github.com/iran-memorial26/iran-memorial'>github.com/iran-memorial26/iran-memorial</a></p>",
    "creators": [
      {"name": "Iran Memorial Project", "affiliation": "Woman Life Freedom e.V."}
    ],
    "keywords": ["Iran", "human rights", "memorial", "Islamic Republic", "executions", "political prisoners", "Mahsa Amini", "Woman Life Freedom", "open data"],
    "access_right": "open",
    "license": "CC-BY-SA-4.0",
    "version": "${DATE}",
    "language": "eng",
    "communities": [
      {"identifier": "humanrights"}
    ]
  }
}
EOF
)

curl -fsS -X PUT \
  -H "Authorization: Bearer ${ZENODO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$META" \
  "https://zenodo.org/api/deposit/depositions/${DEPOSIT_ID}" \
  > /dev/null

# --- 5. Publish ----------------------------------------------------------
echo "Publishing..."
PUBLISH=$(curl -fsS -X POST \
  -H "Authorization: Bearer ${ZENODO_TOKEN}" \
  "https://zenodo.org/api/deposit/depositions/${DEPOSIT_ID}/actions/publish")

DOI=$(echo "$PUBLISH" | grep -oE '"doi":"[^"]+"' | head -1 | cut -d'"' -f4)
CONCEPT_DOI=$(echo "$PUBLISH" | grep -oE '"conceptdoi":"[^"]+"' | head -1 | cut -d'"' -f4)

echo "Published:"
echo "  Version DOI: ${DOI}"
echo "  Concept DOI: ${CONCEPT_DOI}    ← always cite THIS for the latest"

# --- 6. Append to integrity log -----------------------------------------
LOG=/opt/iran-stack/iran-memorial/INTEGRITY-LOG.md
if [ -f "$LOG" ]; then
  printf "<!-- zenodo %s doi=%s concept=%s victims=%s -->\n" \
    "$DATE" "$DOI" "$CONCEPT_DOI" "$VICTIMS" >> "$LOG"
fi

# --- 7. First-run hint --------------------------------------------------
if [ -z "${ZENODO_PARENT_DOI:-}" ] && [ -n "$CONCEPT_DOI" ]; then
  echo ""
  echo "============================================================"
  echo "FIRST RUN — add this line to /etc/iran-memorial/zenodo.env:"
  echo ""
  echo "  ZENODO_PARENT_DOI=${CONCEPT_DOI}"
  echo ""
  echo "Future runs will then be versions of this same record,"
  echo "preserving citation continuity."
  echo "============================================================"
fi
