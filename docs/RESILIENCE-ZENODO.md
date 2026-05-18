# Zenodo DOI for Citable Snapshots

## Why

A persistent, citable DOI is what academia and journalism need to reference
the dataset reliably. "Iran Memorial as accessed in May 2026" is not citable;
"Iran Memorial Dataset, version 2026-05, DOI 10.5281/zenodo.123456" is.

Zenodo (CERN-operated, EU jurisdiction, free, no take-down for political
content) gives:

- A permanent DOI that resolves forever
- A "concept DOI" that always points to the latest version, so a paper can
  cite it once and stay current
- Indexing in Google Scholar, OpenAIRE, and academic search engines
- Backup hosting that survives even if Iran Memorial itself disappears
- Compatibility with reference managers (Zotero, Mendeley)

## Cadence: monthly, not weekly

Weekly DOIs would flood Zenodo with near-identical records — bad citation
hygiene, poor dataset citizenship. **Monthly** is the right cadence: meaningful
deltas, manageable record count, perfect for "as cited in the May 2026 issue
of XYZ".

## One-time setup (15 minutes)

### 1. Create a Zenodo account

1. Go to https://zenodo.org
2. Sign up with the project email (`<CONTACT_EMAIL>`)
3. Verify the email

### 2. Generate an API token

1. https://zenodo.org/account/settings/applications/tokens/new/
2. Name: `iran-memorial-cron`
3. Scopes: `deposit:write` and `deposit:actions`
4. Copy the token (shown once)

### 3. Drop config on the server

```bash
ssh root@<HETZNER_IP>

mkdir -p /etc/iran-memorial
chmod 700 /etc/iran-memorial

cat > /etc/iran-memorial/zenodo.env <<EOF
ZENODO_TOKEN=<paste token here>
# ZENODO_PARENT_DOI=    # Filled in after the first run.
EOF
chmod 600 /etc/iran-memorial/zenodo.env
```

### 4. Symlink the script

```bash
ln -sfn /opt/iran-stack/iran-memorial/scripts/zenodo-snapshot.sh \
        /usr/local/bin/iran-memorial-zenodo.sh
```

### 5. Schedule monthly

```bash
cat > /etc/cron.d/iran-memorial-zenodo <<'EOF'
# Publish a Zenodo DOI on the first Sunday of every month at 03:00 UTC.
0 3 1-7 * 0 root /usr/local/bin/iran-memorial-zenodo.sh
EOF
chmod 644 /etc/cron.d/iran-memorial-zenodo
```

(Cron note: `1-7 * 0` means "day 1-7 AND Sunday" — Cron's idiomatic way to
say "the first Sunday of the month".)

### 6. First run (manual smoke test)

```bash
/usr/local/bin/iran-memorial-zenodo.sh
```

Output ends with a hint:

```
============================================================
FIRST RUN — add this line to /etc/iran-memorial/zenodo.env:

  ZENODO_PARENT_DOI=10.5281/zenodo.NNNNNN

Future runs will then be versions of this same record,
preserving citation continuity.
============================================================
```

Add that line to the env file. Now every monthly run is a new VERSION of the
same conceptual record — readers always find the latest, citations point at a
single concept DOI.

## How to cite

```
Iran Memorial Project. (2026). Iran Memorial — Weekly Dataset Snapshot.
  Zenodo. https://doi.org/10.5281/zenodo.NNNNNN
```

The concept DOI (the one ending without `.NNNNNN-version`) is the right one
for papers — it always resolves to the latest version. Versions are
addressable individually for "as of date X" citations.

## Visibility multipliers

Once the first DOI is live, do these once:

1. **Add to README** (`README.md` → "Citing this dataset" section)
2. **Submit to OpenAIRE** Iran-related communities
3. **Index on data.europa.eu** (EU open-data portal)
4. **PID** (pid.gov-iran-memorial-style) registration with DataCite — handled
   by Zenodo automatically
5. **Pre-print** on SSRN linking to the DOI (also covered in
   `docs/STRATEGY` Phase 2)
6. **Outreach** to 3-5 Iran-Studies departments offering the DOI for use in
   coursework

## Recovery scenario

Zenodo records cannot be deleted by the depositor (deliberate design — research
integrity). They can only be replaced by newer versions. So the worst case is:

- Iran Memorial disappears entirely
- Zenodo still has every monthly snapshot, indexed and DOI-resolvable
- Anyone with a DOI can fetch the JSON, sha256 it against the
  `INTEGRITY-LOG.md` (if they have a copy), and rebuild the database

That makes the project effectively **immortal** at the data layer.
