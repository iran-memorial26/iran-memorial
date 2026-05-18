# Activation Guide — 5 Outstanding Setup Items

> All scripts, cron stubs, env-file skeletons, and binaries are **already
> pre-deployed on prod** (`<ORIGIN_IP>`). Each item below is now just
> "drop in token / key, uncomment cron line."

Pre-deploy state confirmed 2026-05-14:

```
/etc/iran-memorial/{ipfs,zenodo,backup}.env          ← skeletons, chmod 600
/usr/local/bin/iran-memorial-{ipfs,zenodo,backup}.sh ← symlinks → /opt/iran-stack/iran-memorial/scripts/
/etc/cron.d/iran-memorial-{ipfs,zenodo,backup}       ← stubs, all commented out
aws-cli/2.34.47                                      ← installed
gpg, sftp, curl, unzip                                ← installed
```

---

## 1. IPFS Pinning (15 min)

**Why:** every weekly dump pinned to IPFS via web3.storage. Tamper-evident
hash chain in `INTEGRITY-LOG.md`. Censorship-resistant data layer.

```bash
# A. Get token (browser, 3 min)
open https://console.web3.storage/tokens
# Sign up with <CONTACT_EMAIL>
# → Create token "iran-memorial-cron"
# → Copy the eyJ... string

# B. Drop into server env (1 min)
ssh root@<HETZNER_IP>
nano /etc/iran-memorial/ipfs.env
# Fill: WEB3_STORAGE_TOKEN=eyJ...

# C. Smoke test (5 min)
/usr/local/bin/iran-memorial-ipfs.sh
cat /opt/iran-stack/iran-memorial/INTEGRITY-LOG.md
# Should show one new row with CID + SHA-256.

# D. Verify the pin survives the open internet
CID=<paste cid from log>
curl -L "https://w3s.link/ipfs/${CID}" | sha256sum
# Hash should match the SHA-256 in the log row.

# E. Enable weekly cron (30 sec)
sed -i 's|^# 40 |40 |' /etc/cron.d/iran-memorial-ipfs
cat /etc/cron.d/iran-memorial-ipfs   # confirm the leading "#" is gone
```

---

## 2. Zenodo Monthly DOI (15 min)

**Why:** persistent academic DOI for each monthly snapshot. Citable in
papers, court briefs, sanctions dossiers. Survives even if memorial site
disappears.

```bash
# A. Get token (browser, 3 min)
open https://zenodo.org/account/settings/applications/tokens/new/
# Sign up with <CONTACT_EMAIL>
# → Token name "iran-memorial-cron"
# → Scopes: deposit:write + deposit:actions
# → Copy token (shown once)

# B. Drop into server env (1 min)
ssh root@<HETZNER_IP>
nano /etc/iran-memorial/zenodo.env
# Fill: ZENODO_TOKEN=...

# C. First-run (smoke + concept-DOI generation, 5 min)
/usr/local/bin/iran-memorial-zenodo.sh
# Output ends with: "FIRST RUN — add this line to /etc/iran-memorial/zenodo.env:
#                    ZENODO_PARENT_DOI=10.5281/zenodo.NNNNNN"

# D. Persist the concept DOI for future versioning (30 sec)
nano /etc/iran-memorial/zenodo.env
# Add: ZENODO_PARENT_DOI=10.5281/zenodo.NNNNNN   (the number from step C output)

# E. Enable monthly cron (30 sec)
sed -i 's|^# 0 |0 |' /etc/cron.d/iran-memorial-zenodo
cat /etc/cron.d/iran-memorial-zenodo

# F. Add the DOI to README + /press (manual, 5 min)
# README.md "Citing this dataset" section
# /press page "Citation" section
```

---

## 3. Encrypted DB Backups (45 min one-time setup)

**Why:** daily pg_dump encrypted to maintainer GPG keys, uploaded to 3
independent cloud providers. Single-maintainer-with-key + internet =
full restore.

Depends on Item 5 (GPG keys) being done first — backups encrypt to your
GPG public keys.

### A. Sign up for the three providers (15 min)

```
Backblaze B2     https://www.backblaze.com/cloud-storage
  → create bucket "iran-memorial-backups", region US-West-001
  → create application key with R/W on that bucket → save AccessKeyID + Secret

Hetzner Storage Box  via Hetzner Robot (https://robot.hetzner.com)
  → order smallest tier (~3 €/month)
  → web UI → SSH Keys → (will add the key in step C)
  → note the SBX hostname + username (u123456.your-storagebox.de)

Wasabi           https://wasabi.com/sign-up
  → create bucket "iran-memorial-backups", region eu-central-1
  → create access key → save AccessKey + Secret
```

### B. Drop credentials into server env (3 min)

```bash
ssh root@<HETZNER_IP>
nano /etc/iran-memorial/backup.env
# Fill in:
#   B2_ACCESS_KEY=...
#   B2_SECRET_KEY=...
#   B2_BUCKET=iran-memorial-backups
#   HETZNER_SBX_HOST=u123456.your-storagebox.de
#   HETZNER_SBX_USER=u123456
#   WASABI_ACCESS_KEY=...
#   WASABI_SECRET_KEY=...
#   WASABI_BUCKET=iran-memorial-backups
#   BACKUP_RECIPIENTS=<FP1>,<FP2>   (GPG fingerprints from item 5)
```

### C. Generate Hetzner Storage Box SSH key (2 min)

```bash
ssh-keygen -t ed25519 -C "iran-memorial-sbx" \
  -f /root/.ssh/iran_memorial_sbx -N ""
cat /root/.ssh/iran_memorial_sbx.pub
# Paste this public key into Hetzner Storage Box web UI → SSH keys
```

### D. Smoke test (5 min)

```bash
/usr/local/bin/iran-memorial-backup.sh
tail -40 /var/log/iran-memorial-backup.log
# Expect three "OK <provider>" lines.
```

### E. Enable daily cron (30 sec)

```bash
sed -i 's|^# 15 |15 |' /etc/cron.d/iran-memorial-backup
cat /etc/cron.d/iran-memorial-backup
```

### F. Quarterly restore drill (write this on your calendar now)

Every three months: pick a backup from one of the three providers, decrypt
with your YubiKey, restore into a fresh local Docker DB, count rows.
Without drilling restoration, backups are just a feeling.

---

## 4. Import 2-3 GPG Public Keys on Server (10 min — depends on item 5)

Once at least one maintainer has a GPG key (Item 5), import the public
keys so the backup script can encrypt to them.

```bash
# On each maintainer's machine — export their PUBLIC key:
gpg --armor --export <KEYID> > maintainer.pub.asc
# Send via Signal/encrypted-email to the server operator

# On the server:
ssh root@<HETZNER_IP>
gpg --import /tmp/maintainer.pub.asc
gpg --import /tmp/maintainer-other.pub.asc   # repeat per maintainer

# Trust them (so encryption doesn't prompt)
for fp in $(gpg --list-public-keys --with-colons | grep '^fpr' | cut -d: -f10); do
  echo "${fp}:6:" | gpg --import-ownertrust
done

# Copy fingerprints into backup.env
gpg --list-public-keys --with-colons | grep '^fpr' | cut -d: -f10
# Paste comma-separated into BACKUP_RECIPIENTS= in /etc/iran-memorial/backup.env
```

---

## 5. YubiKey → GPG Commit Signing (30 min — local)

**Why:** signed commits make repo tampering detectable even on full GitHub
PAT compromise. Also: same key encrypts backups in items 3+4.

```bash
# A. Buy hardware (one-time)
# YubiKey 5 NFC, ~50 €, https://www.yubico.com/de/
# Buy TWO — backup. Store one in bank safe-deposit box / fireproof safe.

# B. Install client tools (macOS)
brew install gnupg ykman pinentry-mac

# C. Generate key directly on YubiKey (so the private key never touches disk)
gpg --card-edit
> admin
> generate                                    # RSA 4096
                                              # name: your real name
                                              # email: your project email
                                              # expiry: 2y
> quit

# D. Configure git to sign with the YubiKey-backed key
gpg --list-secret-keys --keyid-format=long
# Copy KEYID (the part after rsa4096/)
cd ~/iran-memorial
git config --local user.signingkey <KEYID>
git config --local commit.gpgsign true
git config --local tag.gpgsign true

# E. Configure pinentry to talk to the YubiKey
echo "pinentry-program $(which pinentry-mac)" >> ~/.gnupg/gpg-agent.conf
gpg-connect-agent reloadagent /bye

# F. Upload public key to GitHub
gpg --armor --export <KEYID> | pbcopy
open https://github.com/settings/gpg/new
# → Paste

# G. Test
git commit --allow-empty -m "test: signed commit smoke"
git log --show-signature -1
# Should show "Good signature from <name> <email>" + Verified badge on GitHub

# H. Repeat C-F on YubiKey #2 (backup key, separate identity → cross-sign later)
```

Full setup including key rotation, branch-protection, and key revocation:
`docs/RESILIENCE-COMMIT-SIGNING.md`.

---

## Order of operations

If you only have an hour, do them in this order:

1. **Item 1 (IPFS)** — 15 min, single token, instant value
2. **Item 5 (YubiKey)** — buy hardware, set up GPG. Unlocks 3 + 4.
3. **Item 2 (Zenodo)** — 15 min, single token, academic citation handle
4. **Item 4 (GPG import on server)** — 10 min once Item 5 done
5. **Item 3 (Backups)** — depends on 4 + 5. 45 min for accounts + setup.

If you only have 5 minutes today: do Item 1. Single highest leverage per
minute spent.

---

## Verification

After everything is enabled, you can confirm with:

```bash
ssh root@<HETZNER_IP>

# Crons all enabled (no leading "#")?
grep -hE '^[0-9]' /etc/cron.d/iran-memorial-*
# Expect 5 lines: enrich, wayback, ipfs, zenodo, backup

# Env files filled?
for f in ipfs zenodo backup; do
  echo "=== $f ==="
  grep -v '^#' /etc/iran-memorial/$f.env | grep '=' | sed 's/=.*/=***/'
done

# All scripts execute manually?
/usr/local/bin/iran-memorial-ipfs.sh    && echo IPFS OK
/usr/local/bin/iran-memorial-zenodo.sh  && echo ZENODO OK
/usr/local/bin/iran-memorial-backup.sh  && echo BACKUP OK
```

When all three return "OK", the resilience layer that was strategically
designed three sessions ago is finally live in production.
