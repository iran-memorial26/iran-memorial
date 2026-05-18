# IPFS Snapshots + Tamper-Evident Hash Chain

## What this gets you

- **Censorship-resistant data:** every weekly dump is pinned to IPFS via
  web3.storage. Anyone with the CID can fetch the exact bytes from any IPFS
  gateway (`w3s.link`, `ipfs.io`, `cloudflare-ipfs.com`, …). Take-down at
  the origin does not remove the CID.
- **Tamper-evidence:** [`INTEGRITY-LOG.md`](../INTEGRITY-LOG.md) records the
  SHA-256 + CID of every weekly dump. If an adversary rewrites past data,
  the corresponding row's hash no longer matches and any external party
  can prove it.
- **Auditable:** the log is append-only and (optionally) auto-committed to
  the public GitHub repo, so the chain is fork-mirrorable.

## One-time setup (15 minutes)

### 1. Get a free web3.storage API token

1. Go to https://console.web3.storage/tokens
2. Sign up with the project email (`<CONTACT_EMAIL>` or a
   dedicated account).
3. Create a token named `iran-memorial-cron`.
4. Copy the `eyJ…` token string.

### 2. Drop it on the server

```bash
ssh root@<HETZNER_IP>
mkdir -p /etc/iran-memorial
chmod 700 /etc/iran-memorial
cat > /etc/iran-memorial/ipfs.env <<'EOF'
WEB3_STORAGE_TOKEN=eyJ...                 # paste the token
AUTO_COMMIT=0                             # set to 1 once we trust the chain
EOF
chmod 600 /etc/iran-memorial/ipfs.env
```

### 3. Install the script

The script is checked in at [`scripts/ipfs-snapshot.sh`](../scripts/ipfs-snapshot.sh).
Symlink it into `/usr/local/bin`:

```bash
ssh root@<HETZNER_IP>
ln -sfn /opt/iran-stack/iran-memorial/scripts/ipfs-snapshot.sh \
        /usr/local/bin/iran-memorial-ipfs.sh
```

### 4. Schedule it 10 minutes after the weekly enrich

```bash
cat > /etc/cron.d/iran-memorial-ipfs <<'EOF'
# Pin the dump JSON to IPFS + append to the integrity log.
# Runs 10 minutes after the weekly enrich so it sees the freshest dump.
40 2 * * 0 root /usr/local/bin/iran-memorial-ipfs.sh
EOF
chmod 644 /etc/cron.d/iran-memorial-ipfs
```

### 5. First run (smoke test)

```bash
/usr/local/bin/iran-memorial-ipfs.sh
cat /opt/iran-stack/iran-memorial/INTEGRITY-LOG.md
# Should show one new row.

# Verify by fetching from a public IPFS gateway:
CID=<paste from log>
curl -L "https://w3s.link/ipfs/${CID}" | sha256sum
# Must match the SHA-256 in the log row.
```

### 6. Enable auto-commit (later, after a week of clean runs)

Once the first 4-5 weekly entries land cleanly, flip:

```bash
sed -i 's/^AUTO_COMMIT=0/AUTO_COMMIT=1/' /etc/iran-memorial/ipfs.env
```

…and configure a deploy key with **commit-only** scope to push the integrity
log to GitHub. Until then the log lives only on the server.

## How an outsider verifies a row

```bash
# Anybody, anywhere, no auth needed:
curl -L https://w3s.link/ipfs/bafybei...real-cid... \
  | sha256sum
# Compare with the SHA-256 in INTEGRITY-LOG.md
```

If the hashes match, that file is genuinely the bytes Iran Memorial pinned
that week. If they don't match, the log was tampered with **and** can be
proven so — that is the entire point.

## What if web3.storage goes down or kicks us off

The script writes the CID to the log first, then attempts the upload. If the
upload fails, the log row is still useful: anyone with that CID can re-pin
the file to any other IPFS service (Pinata, Filebase, self-hosted Kubo).

To switch providers, edit the `curl ... api.web3.storage/upload` line in the
script. The CID-based verification model is provider-independent.

## Disk usage

Each weekly snapshot in `INTEGRITY-LOG.md` adds ~250 bytes. After 10 years
the log is ~130 KB — trivial.

The actual dump files are not stored on the server long-term; they live on
IPFS. The server's `/tmp` is cleaned at end of each run.

## Recovery scenario — "the entire site is gone"

In the worst case (Hetzner takedown + Cloudflare takedown + GitHub takedown
simultaneously), a journalist with a copy of `INTEGRITY-LOG.md` can:

1. Pick any row's CID.
2. Fetch from any IPFS gateway worldwide.
3. Verify the bytes via SHA-256.
4. Re-host the JSON at a new domain.
5. Use it as the basis to rebuild the database (Prisma + the JSON).

This is the difference between "we lost the project" and "we lost the
hosting." Only the second can actually happen.
