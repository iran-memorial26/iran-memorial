#!/bin/bash
# Weekly backfill of source data_source_id FKs + auto-verify pass.
#
# The SQL is idempotent: ON CONFLICT DO NOTHING for new data_sources,
# WHERE data_source_id IS NULL for backfill, WHERE verification_status = 'unverified'
# for promotions. Safe to run repeatedly.
#
# Schedule: Saturday 06:00 UTC (after the 3 source crons finish).
# Crontab entry:
#   0 6 * * 6 /opt/iran-stack/iran-memorial/tools/backfill_cron_runner.sh \
#     >> /var/log/iran-memorial/backfill.log 2>&1

set -euo pipefail

REPO_DIR="/opt/iran-stack/iran-memorial"
SQL_FILE="${REPO_DIR}/tools/data/backfill-source-fk-and-verify.sql"

echo "===== Backfill run started: $(date -Iseconds) ====="

if [ ! -f "${SQL_FILE}" ]; then
  echo "ERROR: SQL file not found at ${SQL_FILE}" >&2
  exit 1
fi

# Snapshot before
docker exec iran-db psql -U memorial -d iran_memorial -tAc \
  "SELECT verification_status || ': ' || COUNT(*) FROM victims GROUP BY verification_status ORDER BY 1;"

# Apply
docker exec -i iran-db psql -U memorial -d iran_memorial -v ON_ERROR_STOP=1 < "${SQL_FILE}"

# Snapshot after
echo "----- Post-run state -----"
docker exec iran-db psql -U memorial -d iran_memorial -tAc \
  "SELECT verification_status || ': ' || COUNT(*) FROM victims GROUP BY verification_status ORDER BY 1;"

echo "===== Backfill run finished: $(date -Iseconds) ====="
