#!/bin/bash
# Daily encrypted Postgres backups for Iran Memorial.
#
# Strategy: every night the script takes a logical pg_dump of iran_memorial,
# encrypts it with GPG to N recipient keys (each maintainer holds a private
# key), and uploads the ciphertext to multiple independent cloud providers
# in different jurisdictions. Any one maintainer can decrypt; no single
# provider failure or take-down loses the backup.
#
# Why GPG public-key, not symmetric:
#   - We don't want a long-lived passphrase sitting on the production server.
#   - Each maintainer's private key is on their own hardware (YubiKey ideal).
#   - To restore: any one maintainer + their key can do it from any provider.
#
# Why three providers across jurisdictions:
#   - Backblaze B2 (USA, low-cost cold storage)
#   - Hetzner Storage Box (Germany, EU jurisdiction, same vendor as primary
#     server but different physical region — acceptable as one of three)
#   - Wasabi or Scaleway (USA/EU diversity)
#   Any provider can be removed without losing the backup. To break the
#   chain, an adversary needs to coordinate take-downs across three
#   independent companies in three jurisdictions in the same week.
#
# Setup (one-time):
#
#   1. On EACH maintainer's local machine, generate or reuse a GPG keypair.
#      Export the PUBLIC keys.
#
#   2. On the server, import those public keys for the backup user (root):
#        gpg --import /tmp/maintainer-1.pub.asc
#        gpg --import /tmp/maintainer-2.pub.asc
#        gpg --edit-key <fingerprint> trust  # ultimate
#
#   3. Configure recipients + storage providers:
#        cat > /etc/iran-memorial/backup.env <<EOF
#        # Comma-separated GPG fingerprints of maintainers who can decrypt.
#        BACKUP_RECIPIENTS=A1B2C3...,D4E5F6...
#
#        # Backblaze B2 (rclone or aws-cli — we use aws-cli with B2's S3 API)
#        B2_ACCESS_KEY=...
#        B2_SECRET_KEY=...
#        B2_BUCKET=iran-memorial-backups
#        B2_ENDPOINT=https://s3.us-west-001.backblazeb2.com
#
#        # Hetzner Storage Box (sftp)
#        HETZNER_SBX_HOST=u123456.your-storagebox.de
#        HETZNER_SBX_USER=u123456
#        # Auth via SSH key in /root/.ssh/iran_memorial_sbx (no passphrase)
#
#        # Wasabi (S3 API)
#        WASABI_ACCESS_KEY=...
#        WASABI_SECRET_KEY=...
#        WASABI_BUCKET=iran-memorial-backups
#        WASABI_ENDPOINT=https://s3.eu-central-1.wasabisys.com
#
#        # Optional: how many days of backups to keep (rotation handled
#        # client-side; providers' lifecycle rules can do this too).
#        RETENTION_DAYS=30
#        EOF
#        chmod 600 /etc/iran-memorial/backup.env
#
#   4. Ensure aws-cli is installed: apt install -y awscli
#
#   5. Schedule daily:
#        cat > /etc/cron.d/iran-memorial-backup <<'EOF'
#        15 2 * * * root /usr/local/bin/iran-memorial-backup.sh
#        EOF
#
# Smoke test: run manually, expect "OK [provider]" three times.

set -u
ENV_FILE=/etc/iran-memorial/backup.env
LOG=/var/log/iran-memorial-backup.log
mkdir -p /var/log

if [ ! -r "$ENV_FILE" ]; then
  echo "::error:: missing $ENV_FILE — see header for setup." >&2
  exit 1
fi
# shellcheck source=/dev/null
. "$ENV_FILE"

if [ -z "${BACKUP_RECIPIENTS:-}" ]; then
  echo "::error:: BACKUP_RECIPIENTS not set" >&2
  exit 1
fi

DATE=$(date -u +%Y%m%d)
TIME=$(date -u +%H%M%S)
TS="${DATE}T${TIME}Z"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

DUMP="${TMPDIR}/iran_memorial-${TS}.sql.gz"
ENC="${DUMP}.gpg"

# --- 1. Take the dump ----------------------------------------------------
{
  echo ""
  echo "=== Backup start: $(date -Iseconds) ==="

  if ! docker exec iran-db pg_dump -U memorial -d iran_memorial \
       --no-owner --no-privileges --clean --if-exists \
       | gzip -9 > "$DUMP"; then
    echo "::error:: pg_dump failed"
    exit 1
  fi

  SIZE=$(stat -c%s "$DUMP" 2>/dev/null || stat -f%z "$DUMP")
  SHA=$(sha256sum "$DUMP" | awk '{print $1}')
  echo "  dump size: ${SIZE} bytes"
  echo "  dump sha:  ${SHA}"

  # --- 2. Encrypt to N recipients ----------------------------------------
  IFS=',' read -ra RECIPIENTS <<< "$BACKUP_RECIPIENTS"
  GPG_ARGS=()
  for r in "${RECIPIENTS[@]}"; do
    GPG_ARGS+=("--recipient" "$r")
  done

  if ! gpg --batch --yes --trust-model always \
       "${GPG_ARGS[@]}" \
       --output "$ENC" --encrypt "$DUMP"; then
    echo "::error:: GPG encrypt failed"
    exit 1
  fi

  ENC_SIZE=$(stat -c%s "$ENC" 2>/dev/null || stat -f%z "$ENC")
  echo "  encrypted: ${ENC_SIZE} bytes for $(echo "$BACKUP_RECIPIENTS" | tr ',' '\n' | wc -l) recipient(s)"
  KEY="iran_memorial-${TS}.sql.gz.gpg"

  # --- 3. Upload to each provider ----------------------------------------
  STATUS=""

  # Backblaze B2 via S3-compatible API
  if [ -n "${B2_ACCESS_KEY:-}" ] && [ -n "${B2_BUCKET:-}" ]; then
    if AWS_ACCESS_KEY_ID="$B2_ACCESS_KEY" \
       AWS_SECRET_ACCESS_KEY="$B2_SECRET_KEY" \
       aws s3 cp "$ENC" "s3://${B2_BUCKET}/${KEY}" \
            --endpoint-url "$B2_ENDPOINT" \
            --no-progress --quiet 2>/dev/null; then
      echo "  OK B2  ${KEY}"
      STATUS="${STATUS}B2:ok "
    else
      echo "  FAIL B2"
      STATUS="${STATUS}B2:fail "
    fi
  fi

  # Hetzner Storage Box via sftp
  if [ -n "${HETZNER_SBX_HOST:-}" ] && [ -n "${HETZNER_SBX_USER:-}" ]; then
    if echo "put \"$ENC\" \"$KEY\"" \
       | sftp -i /root/.ssh/iran_memorial_sbx \
              -o StrictHostKeyChecking=accept-new \
              "${HETZNER_SBX_USER}@${HETZNER_SBX_HOST}" >/dev/null 2>&1; then
      echo "  OK Hetzner-SBX  ${KEY}"
      STATUS="${STATUS}Hetzner:ok "
    else
      echo "  FAIL Hetzner-SBX"
      STATUS="${STATUS}Hetzner:fail "
    fi
  fi

  # Wasabi via S3-compatible API
  if [ -n "${WASABI_ACCESS_KEY:-}" ] && [ -n "${WASABI_BUCKET:-}" ]; then
    if AWS_ACCESS_KEY_ID="$WASABI_ACCESS_KEY" \
       AWS_SECRET_ACCESS_KEY="$WASABI_SECRET_KEY" \
       aws s3 cp "$ENC" "s3://${WASABI_BUCKET}/${KEY}" \
            --endpoint-url "$WASABI_ENDPOINT" \
            --no-progress --quiet 2>/dev/null; then
      echo "  OK Wasabi  ${KEY}"
      STATUS="${STATUS}Wasabi:ok "
    else
      echo "  FAIL Wasabi"
      STATUS="${STATUS}Wasabi:fail "
    fi
  fi

  echo "  status: ${STATUS}"

  # --- 4. Local rotation (keep last 7 days on the server itself) ---------
  if [ -d /var/backups/iran-memorial ]; then
    cp "$ENC" /var/backups/iran-memorial/
    find /var/backups/iran-memorial -name "iran_memorial-*.sql.gz.gpg" \
         -mtime +7 -delete
  fi

  echo "=== Backup done: $(date -Iseconds) ==="
} >> "$LOG" 2>&1
