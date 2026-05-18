# Encrypted Off-Site Database Backups

## What this gets you

Every night at 02:15 UTC the production Postgres database is dumped, encrypted
to N maintainer GPG public keys, and uploaded to **three independent cloud
providers in two jurisdictions**:

- Backblaze B2 (USA, low-cost cold storage)
- Hetzner Storage Box (Germany, EU jurisdiction — same vendor as primary
  but separate region; acceptable as one of three)
- Wasabi (USA/EU multi-region)

Recovery in the worst case (Hetzner takes the primary server down +
GitHub deplatforms us + Cloudflare cuts the CDN) is reduced to a single
maintainer with a GPG private key + an internet connection.

## Threat model addressed

| Scenario | Backup behavior |
|---|---|
| Production server compromised, DB tampered | Restore from yesterday's encrypted backup |
| Hetzner takes primary server offline | Pull from Wasabi or B2 |
| One cloud provider deplatforms us | Backup chain breaks at 1/3, still 2/3 intact |
| Production server destroyed | Restore on a fresh box from any provider |
| Maintainer lost their YubiKey | Other maintainer's key can still decrypt |
| Single ISP-level surveillance | All transit and rest is encrypted |
| Subpoena to one provider | They have ciphertext only; recipient list is private metadata |

## Setup

### 1. Each maintainer generates a GPG keypair

See `docs/RESILIENCE-COMMIT-SIGNING.md` for the YubiKey-backed setup. The
same keypair is used for both signing and decryption (or use a separate
encryption subkey).

Each maintainer hands their **public** key to the backup operator:

```bash
# On maintainer's laptop
gpg --armor --export <KEYID> > maintainer.pub.asc
# Send to backup operator (Signal / encrypted mail)
```

### 2. Import the public keys on the server

```bash
ssh root@<HETZNER_IP>

# Import each maintainer's public key
gpg --import maintainer.pub.asc
gpg --import maintainer-other.pub.asc

# Trust them (so encryption doesn't prompt)
for fp in $(gpg --list-public-keys --with-colons | grep '^fpr' | cut -d: -f10); do
  echo "${fp}:6:" | gpg --import-ownertrust
done

# List recipients to confirm
gpg --list-public-keys --with-colons | grep '^fpr' | cut -d: -f10
```

### 3. Configure providers

Sign up for the three providers (free tiers fit comfortably for the
weekly-snapshot backup volume):

- **Backblaze B2**: https://www.backblaze.com/cloud-storage
  - Create bucket `iran-memorial-backups`, region US-West-001
  - Create application key with read/write access to that bucket only
- **Hetzner Storage Box**: order via Hetzner Robot, smallest tier (~3€/month)
  - SSH-key auth: generate key on the prod server, upload public part via
    the Storage Box web UI
- **Wasabi**: https://wasabi.com/sign-up
  - Create bucket in EU-Central-1 (Amsterdam), then access key

### 4. Drop config on the server

```bash
ssh root@<HETZNER_IP>

mkdir -p /etc/iran-memorial
chmod 700 /etc/iran-memorial

cat > /etc/iran-memorial/backup.env <<'EOF'
BACKUP_RECIPIENTS=A1B2C3D4E5F6G7H8I9...,Z9Y8X7W6V5U4T3S2R1...

B2_ACCESS_KEY=00...
B2_SECRET_KEY=K00...
B2_BUCKET=iran-memorial-backups
B2_ENDPOINT=https://s3.us-west-001.backblazeb2.com

HETZNER_SBX_HOST=u123456.your-storagebox.de
HETZNER_SBX_USER=u123456

WASABI_ACCESS_KEY=...
WASABI_SECRET_KEY=...
WASABI_BUCKET=iran-memorial-backups
WASABI_ENDPOINT=https://s3.eu-central-1.wasabisys.com

RETENTION_DAYS=30
EOF
chmod 600 /etc/iran-memorial/backup.env
```

### 5. Generate the Hetzner Storage Box SSH key

```bash
ssh root@<HETZNER_IP>
ssh-keygen -t ed25519 -C "iran-memorial-sbx" \
  -f /root/.ssh/iran_memorial_sbx -N ""
cat /root/.ssh/iran_memorial_sbx.pub
# Paste this in the Hetzner Storage Box Web UI → Keys
```

### 6. Install dependencies + symlink the script

```bash
apt-get install -y awscli openssh-client gnupg postgresql-client

ln -sfn /opt/iran-stack/iran-memorial/scripts/db-backup.sh \
        /usr/local/bin/iran-memorial-backup.sh
mkdir -p /var/backups/iran-memorial
```

### 7. Schedule

```bash
cat > /etc/cron.d/iran-memorial-backup <<'EOF'
# Daily encrypted off-site DB backup, 02:15 UTC.
15 2 * * * root /usr/local/bin/iran-memorial-backup.sh
EOF
chmod 644 /etc/cron.d/iran-memorial-backup
```

### 8. First run + smoke test

```bash
/usr/local/bin/iran-memorial-backup.sh
tail -30 /var/log/iran-memorial-backup.log
# Expect three "OK <provider>" lines.
```

## Restoring from a backup

Any maintainer with a GPG private key on the recipient list can restore:

```bash
# 1. Pull from any one provider
aws s3 cp s3://iran-memorial-backups/iran_memorial-20260509T021500Z.sql.gz.gpg \
  --endpoint-url https://s3.us-west-001.backblazeb2.com \
  ./

# 2. Decrypt
gpg --decrypt iran_memorial-20260509T021500Z.sql.gz.gpg > dump.sql.gz

# 3. Restore to a fresh DB
gunzip -c dump.sql.gz | docker exec -i iran-db psql -U memorial -d iran_memorial
```

## Rotation strategy

The script keeps the last 7 days **locally** in `/var/backups/iran-memorial`
for fast disaster recovery (no network round-trip). Off-site retention is
unbounded — providers' lifecycle rules can prune older backups if cost
becomes a concern. At ~50 MB compressed encrypted per night, a year of
backups is ~18 GB total across all providers, which is well under any
relevant free or low-cost tier.

## Why not just use Wal-G / continuous replication?

Continuous replication is technically nicer (point-in-time recovery, no
data lag), but:
- It needs a hot standby running somewhere — defeats the point of "encrypted
  cold storage in places adversaries can't easily access"
- Logical pg_dump survives Postgres major-version upgrades; physical
  replication doesn't
- Recovery from logical dump is auditable (you can grep the SQL before
  applying)

For a public memorial dataset that updates weekly, daily snapshots are
plenty. We can layer Wal-G later if RPO needs ever push under 24h.

## Open follow-ups

- **Restore drill quarterly:** every three months, one maintainer pulls
  yesterday's backup from one of the three providers, restores to a fresh
  Docker DB locally, and confirms it boots. Without drilling restoration,
  backups are just a feeling.
- **Multi-recipient hardware-key rotation:** when a maintainer leaves or
  a key is compromised, regenerate `BACKUP_RECIPIENTS` minus that fp and
  re-import. Old backups remain decryptable by the rotated-out key holder
  for the lifetime of those backups — accept that or rotate proactively
  by re-encrypting the most recent N backups.
- **Cold archive at 1-year cadence:** print the latest backup ciphertext
  + decryption instructions on paper, store in a safe-deposit box. Sounds
  paranoid until the year you need it.
