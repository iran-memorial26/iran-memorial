#!/usr/bin/env python3
"""
Scrape and import victims from the Boroumand Foundation / Omid Memorial (iranrights.org).

Phases:
  1. browse      — Crawl browse pages, extract victim IDs + names → master list
  2. match       — Match master list against existing YAML files
  3. detail      — Fetch EN + FA detail pages for matches
  4. enrich      — Update YAML files with Farsi names, photos, sources
  5. import-new  — Create new YAML files for unmatched entries

Usage:
  python tools/scrape_boroumand.py browse [--start N] [--end N] [--resume]
  python tools/scrape_boroumand.py match
  python tools/scrape_boroumand.py detail [--limit N] [--force]
  python tools/scrape_boroumand.py enrich [--dry-run]
  python tools/scrape_boroumand.py import-new [--years 2022-2026] [--limit N] [--dry-run] [--resume]

Year → Page mapping (ascending by date):
  Pages   1– 15: Unknown date
  Pages  16–221: 1979–1987
  Pages 222–293: 1988 (massacre — ~3,600 victims!)
  Pages 294–513: 1989–2021
  Pages 514–524: 2022 (WLF)
  Pages 525–545: 2023–2026
"""

import argparse
import json
import os
import re
import ssl
import sys
import time
import random
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# macOS Python doesn't trust system certs by default
SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

# --- Configuration ---
BASE_URL = "https://www.iranrights.org"
BROWSE_URL = BASE_URL + "/memorial/browse/date/{page}"
DETAIL_URL = BASE_URL + "/memorial/story/{id}/{slug}"
DETAIL_FA_URL = BASE_URL + "/fa/memorial/story/{id}/{slug}"

SCRIPT_DIR = Path(__file__).parent
CACHE_DIR = SCRIPT_DIR / ".boroumand_cache"
MASTER_FILE = SCRIPT_DIR / "boroumand_master.json"
MATCHES_FILE = SCRIPT_DIR / "boroumand_matches.json"
DETAILS_FILE = SCRIPT_DIR / "boroumand_details.json"
DETAIL_CACHE = CACHE_DIR / "detail"
VICTIMS_DIR = SCRIPT_DIR.parent / "data" / "victims"

TOTAL_PAGES = 545
MIN_DELAY = 0.8
MAX_DELAY = 1.2
PARALLEL_WORKERS = 4

HEADERS = {
    "User-Agent": "iran-memorial-project/1.0 (human-rights-research; github.com/iran-memorial26/iran-memorial)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
}


def fetch(url, retries=3):
    """Fetch URL with retries and exponential backoff."""
    for attempt in range(retries):
        try:
            req = Request(url, headers=HEADERS)
            with urlopen(req, timeout=30, context=SSL_CTX) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError, OSError) as e:
            wait = (attempt + 1) * 5
            if attempt < retries - 1:
                print(f"  ⚠ Retry {attempt+1}/{retries}: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                print(f"  ✗ FAILED after {retries} attempts: {url}: {e}")
                return None
    return None


def delay():
    """Random delay between requests."""
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


# ============================================================
# Phase 1: Browse — crawl browse/date pages → master list
# ============================================================

def parse_browse_page(html):
    """Extract victim entries from a browse page HTML."""
    entries = []

    # Each entry is a <div class='memorial-list clearfix'> block
    blocks = re.split(r"<div class='memorial-list clearfix'>", html)

    for block in blocks[1:]:  # skip first (before first entry)
        # Photo
        photo_match = re.search(r'<img src="(/actorphotos/[^"]+)"', block)
        photo_url = photo_match.group(1) if photo_match else None

        # Name + link
        link_match = re.search(
            r"<a href='/memorial/story/(-?\d+)/([^']+)'>([^<]+)</a>", block
        )
        if not link_match:
            continue

        victim_id = int(link_match.group(1))
        slug = link_match.group(2)
        name = link_match.group(3).strip()

        # Mode of killing
        mode_match = re.search(
            r"<strong>Mode of Killing</strong>:\s*([^<]+)", block
        )
        mode = mode_match.group(1).strip().rstrip(";").strip() if mode_match else None

        entries.append({
            "id": victim_id,
            "slug": slug,
            "name": name,
            "photo_url": photo_url,
            "mode": mode,
        })

    return entries


def cmd_browse(args):
    """Crawl browse pages and build master list."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Resume support
    progress_file = CACHE_DIR / "browse_progress.json"
    master = []
    seen_ids = set()
    last_page = 0

    if args.resume and progress_file.exists():
        with open(progress_file) as f:
            progress = json.load(f)
        master = progress.get("entries", [])
        last_page = progress.get("last_page", 0)
        seen_ids = {e["id"] for e in master}
        print(f"Resuming from page {last_page + 1}, {len(master)} entries loaded")

    start = args.start or (last_page + 1)
    end = args.end or TOTAL_PAGES

    print(f"Scraping browse pages {start}–{end} ...")

    for page in range(start, end + 1):
        url = BROWSE_URL.format(page=page)
        html = fetch(url)

        if html is None:
            print(f"  Page {page}: FAILED — skipping")
            continue

        entries = parse_browse_page(html)
        new = [e for e in entries if e["id"] not in seen_ids]
        master.extend(new)
        seen_ids.update(e["id"] for e in new)

        print(f"  Page {page}/{end}: {len(entries)} entries ({len(new)} new) — total {len(master)}")

        # Save progress every 10 pages
        if page % 10 == 0:
            with open(progress_file, "w") as f:
                json.dump({"last_page": page, "entries": master}, f)

        delay()

    # Save final
    with open(MASTER_FILE, "w") as f:
        json.dump(master, f, indent=2, ensure_ascii=False)
    with open(progress_file, "w") as f:
        json.dump({"last_page": end, "entries": master}, f)

    with_photo = sum(1 for e in master if e.get("photo_url"))
    print(f"\nDone: {len(master)} victims → {MASTER_FILE}")
    print(f"  With photo: {with_photo}")
    print(f"  Without photo: {len(master) - with_photo}")


# ============================================================
# Phase 2: Match — compare master list against existing YAMLs
# ============================================================

def normalize(name):
    """Normalize name for matching."""
    name = name.lower().strip()
    name = re.sub(r'[\u200c\u200d]', ' ', name)  # zero-width joiners
    name = re.sub(r"[-'`]", '', name)
    name = re.sub(r'\s+', ' ', name)
    return name


def load_existing_victims():
    """Load name + metadata from all YAML files."""
    victims = {}
    for yf in VICTIMS_DIR.rglob("*.yaml"):
        if yf.name == "_template.yaml":
            continue
        content = yf.read_text(errors="replace")

        name_m = re.search(r'^name_latin:\s*"?([^"\n]+)"?', content, re.M)
        farsi_m = re.search(r'^name_farsi:\s*"?([^"\n]+)"?', content, re.M)
        date_m = re.search(r'^date_of_death:\s*(\S+)', content, re.M)

        name = name_m.group(1).strip() if name_m else None
        if not name or name == "null":
            continue

        farsi = farsi_m.group(1).strip() if farsi_m else None
        if farsi == "null":
            farsi = None

        date = date_m.group(1).strip() if date_m else None
        if date == "null":
            date = None

        victims[str(yf)] = {
            "name": name,
            "name_farsi": farsi,
            "date_of_death": date,
            "file": str(yf),
            "slug": yf.stem,
        }
    return victims


def cmd_match(args):
    """Match master list against existing YAML files."""
    if not MASTER_FILE.exists():
        print(f"Error: {MASTER_FILE} not found. Run 'browse' first.")
        sys.exit(1)

    with open(MASTER_FILE) as f:
        master = json.load(f)
    print(f"Loaded {len(master)} Boroumand entries")

    existing = load_existing_victims()
    print(f"Loaded {len(existing)} existing YAML victims")

    # Build lookup by normalized name
    by_norm = {}
    for path, info in existing.items():
        norm = normalize(info["name"])
        by_norm.setdefault(norm, []).append(info)

    matches = []
    unmatched = []

    for entry in master:
        norm = normalize(entry["name"])

        if norm in by_norm:
            for ex in by_norm[norm]:
                matches.append({
                    "boroumand_id": entry["id"],
                    "boroumand_slug": entry["slug"],
                    "boroumand_name": entry["name"],
                    "boroumand_photo": entry.get("photo_url"),
                    "yaml_file": ex["file"],
                    "yaml_name": ex["name"],
                    "has_farsi": ex["name_farsi"] is not None,
                    "match_type": "exact",
                })
        else:
            # Try partial: check if all name parts appear in any existing name
            parts = set(norm.split())
            found = False
            if len(parts) >= 2:
                for path, info in existing.items():
                    ex_parts = set(normalize(info["name"]).split())
                    if parts == ex_parts:
                        matches.append({
                            "boroumand_id": entry["id"],
                            "boroumand_slug": entry["slug"],
                            "boroumand_name": entry["name"],
                            "boroumand_photo": entry.get("photo_url"),
                            "yaml_file": info["file"],
                            "yaml_name": info["name"],
                            "has_farsi": info["name_farsi"] is not None,
                            "match_type": "reorder",
                        })
                        found = True
                        break
            if not found:
                unmatched.append(entry)

    result = {
        "matches": matches,
        "unmatched_count": len(unmatched),
    }
    with open(MATCHES_FILE, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    exact = sum(1 for m in matches if m["match_type"] == "exact")
    reorder = sum(1 for m in matches if m["match_type"] == "reorder")
    need_farsi = sum(1 for m in matches if not m["has_farsi"])
    has_photo = sum(1 for m in matches if m.get("boroumand_photo"))

    print(f"\nResults:")
    print(f"  Matches: {len(matches)} (exact: {exact}, reorder: {reorder})")
    print(f"  Unmatched (potential new): {len(unmatched)}")
    print(f"  Matches needing Farsi name: {need_farsi}")
    print(f"  Matches with Boroumand photo: {has_photo}")
    print(f"\nSaved to {MATCHES_FILE}")


# ============================================================
# Phase 3: Detail — fetch EN + FA detail pages for matches
# ============================================================

def parse_detail_en(html):
    """Parse English detail page → dict of fields."""
    data = {}

    # Name from <h1 class='page-top'>
    h1_m = re.search(r"<h1 class='page-top'>([^<]+)</h1>", html)
    if h1_m:
        data["name"] = h1_m.group(1).strip()

    # Photo (real photo, not placeholder)
    photo_m = re.search(r'<img[^>]+src="(/actorphotos/[^"]+)"', html)
    if photo_m:
        data["photo_url"] = photo_m.group(1)

    # Fields from <div><em>Label:</em> Value</div>
    field_map = {
        "Age": "age",
        "Nationality": "nationality",
        "Religion": "religion",
        "Civil Status": "civil_status",
        "Date of Killing": "date_of_killing",
        "Location of Killing": "location",
        "Mode of Killing": "mode_of_killing",
        "Charges": "charges",
        "Date of Birth": "date_of_birth",
        "Place of Birth": "place_of_birth",
        "Occupation": "occupation",
        "Gravesite location is known": "gravesite_known",
    }

    for m in re.finditer(r'<em>([^<]+)</em>\s*([^<]+)', html):
        label = m.group(1).strip().rstrip(':')
        value = m.group(2).strip()
        if value and value != "---" and label in field_map:
            data[field_map[label]] = value

    # Narrative: "About this Case" section
    narr_m = re.search(
        r'<h2[^>]*>About this Case</h2>\s*(.*?)(?=<h2|<footer|<div\s+id=)',
        html, re.DOTALL
    )
    if narr_m:
        text = re.sub(r'<[^>]+>', ' ', narr_m.group(1))
        text = re.sub(r'&\w+;', ' ', text)  # HTML entities
        text = re.sub(r'\s+', ' ', text).strip()
        # Filter out Boroumand boilerplate "Correct/Complete This Entry" text
        if 'Correct/ Complete This Entry' in text or 'complete this story in Omid' in text:
            # Strip the boilerplate wrapper, keep only real content
            text = re.sub(r'Correct/?\s*Complete This Entry\s*[❯>]?\s*', '', text).strip()
            text = re.sub(r'The story of .+?is not complete\..+?We appreciate your support\.?\s*', '', text, flags=re.DOTALL).strip()
        if len(text) > 50:
            data["narrative"] = text[:5000]

    return data


def parse_detail_fa(html):
    """Parse Farsi detail page → extract Farsi name."""
    data = {}

    # Farsi name from <h1 class='page-top'>
    h1_m = re.search(r"<h1 class='page-top'>([^<]+)</h1>", html)
    if h1_m:
        text = h1_m.group(1).strip()
        if re.search(r'[\u0600-\u06FF]', text):
            data["name_farsi"] = text

    return data


def cmd_detail(args):
    """Fetch detail pages for unique matched Boroumand IDs."""
    if not MATCHES_FILE.exists():
        print(f"Error: {MATCHES_FILE} not found. Run 'match' first.")
        sys.exit(1)

    with open(MATCHES_FILE) as f:
        match_data = json.load(f)

    matches = match_data["matches"]

    # Deduplicate: only fetch each Boroumand ID once
    seen = set()
    unique = []
    for m in matches:
        if m["boroumand_id"] not in seen:
            seen.add(m["boroumand_id"])
            unique.append(m)

    # Prioritize: those needing Farsi names first
    unique = sorted(unique, key=lambda m: (m.get("has_farsi", False),))

    if args.limit:
        unique = unique[:args.limit]

    print(f"Fetching detail pages for {len(unique)} unique Boroumand IDs "
          f"(from {len(matches)} match pairs)...")

    DETAIL_CACHE.mkdir(parents=True, exist_ok=True)

    fetched = 0
    cached = 0
    for i, match in enumerate(unique):
        vid = match["boroumand_id"]
        slug = match["boroumand_slug"]
        cache_file = DETAIL_CACHE / f"{vid}.json"

        if cache_file.exists() and not args.force:
            cached += 1
            continue

        # Fetch English
        en_html = fetch(DETAIL_URL.format(id=vid, slug=slug))
        delay()

        # Fetch Farsi
        fa_html = fetch(DETAIL_FA_URL.format(id=vid, slug=slug))
        delay()

        detail = {"boroumand_id": vid, "slug": slug}
        if en_html:
            detail["en"] = parse_detail_en(en_html)
        if fa_html:
            detail["fa"] = parse_detail_fa(fa_html)

        # Cache
        with open(cache_file, "w") as f:
            json.dump(detail, f, indent=2, ensure_ascii=False)

        fetched += 1
        fa_name = detail.get("fa", {}).get("name_farsi", "—")
        print(f"  [{i+1}/{len(unique)}] {match['boroumand_name']} → {fa_name}")

    print(f"\nDone: {fetched} fetched, {cached} cached, {len(unique)} total")


# ============================================================
# Phase 4: Enrich — update existing YAML files
# ============================================================

def update_yaml_null_field(content, field, value):
    """Replace a null field in YAML with a value. Only updates if currently null."""
    if value is None:
        return content

    # Match field: null or field: ""
    pattern = rf'^({re.escape(field)}:\s*)(?:null|""|\'\')\s*$'
    match = re.search(pattern, content, re.M)
    if not match:
        return content  # field not null or doesn't exist

    # Quote the value
    if isinstance(value, str) and any(c in value for c in ':"#{}[]&*!|>\''):
        safe = '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
    elif isinstance(value, str):
        safe = f'"{value}"'
    else:
        safe = str(value)

    return content[:match.start()] + match.group(1) + safe + content[match.end():]


def add_source(content, url, name):
    """Add a source entry if not already present."""
    if url in content:
        return content

    block = f'\n  - url: "{url}"\n    name: "{name}"\n    type: memorial_database'

    # Find sources section
    m = re.search(r'^sources:\s*$', content, re.M)
    if m:
        return content[:m.end()] + block + content[m.end():]
    return content


MONTH_MAP = {
    "January": "01", "February": "02", "March": "03", "April": "04",
    "May": "05", "June": "06", "July": "07", "August": "08",
    "September": "09", "October": "10", "November": "11", "December": "12",
}


def parse_boroumand_date(date_str):
    """Convert 'September 21, 2022' → '2022-09-21'. Returns None on failure."""
    if not date_str:
        return None
    m = re.match(r'(\w+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
    if m and m.group(1) in MONTH_MAP:
        return f"{m.group(3)}-{MONTH_MAP[m.group(1)]}-{int(m.group(2)):02d}"
    # Try year-only
    m = re.match(r'(\d{4})', date_str)
    if m:
        return m.group(1)
    return None


def dates_match(yaml_date, boroumand_date_str):
    """Check if YAML date and Boroumand date refer to the same death.

    Allows ±1 day tolerance (common in cross-source reporting).
    Returns: True (confirmed match), False (confirmed mismatch), None (can't tell).
    """
    if not yaml_date or not boroumand_date_str:
        return None  # can't validate

    b_date = parse_boroumand_date(boroumand_date_str)
    if not b_date:
        return None

    # Both are full dates (YYYY-MM-DD)
    if len(yaml_date) >= 10 and len(b_date) >= 10:
        if yaml_date[:10] == b_date[:10]:
            return True
        # Allow ±1 day tolerance
        try:
            from datetime import timedelta
            y = datetime.strptime(yaml_date[:10], "%Y-%m-%d")
            b = datetime.strptime(b_date[:10], "%Y-%m-%d")
            return abs((y - b).days) <= 1
        except ValueError:
            pass

    # At least compare years
    return yaml_date[:4] == b_date[:4]


def cmd_enrich(args):
    """Enrich existing YAML files with date-validated Boroumand data."""
    if not MATCHES_FILE.exists():
        print(f"Error: {MATCHES_FILE} not found. Run 'match' first.")
        sys.exit(1)

    with open(MATCHES_FILE) as f:
        match_data = json.load(f)

    matches = match_data["matches"]

    # Load detail cache for each Boroumand ID
    detail_by_id = {}
    for cache_file in DETAIL_CACHE.glob("*.json"):
        with open(cache_file) as f:
            d = json.load(f)
        detail_by_id[d["boroumand_id"]] = d

    print(f"Processing {len(matches)} match pairs ({len(detail_by_id)} details loaded)...")

    enriched = 0
    total_changes = 0
    skipped_date = 0
    skipped_no_detail = 0

    for match in matches:
        vid = match["boroumand_id"]
        yaml_file = match["yaml_file"]

        if not os.path.exists(yaml_file):
            continue

        detail = detail_by_id.get(vid)
        if not detail:
            skipped_no_detail += 1
            continue

        # Date validation: skip if dates are confirmed different
        en = detail.get("en", {})
        content = Path(yaml_file).read_text()

        yaml_date_m = re.search(r'^date_of_death:\s*(\S+)', content, re.M)
        yaml_date = yaml_date_m.group(1) if yaml_date_m else None
        if yaml_date == "null":
            yaml_date = None

        date_ok = dates_match(yaml_date, en.get("date_of_killing"))
        if date_ok is False:
            skipped_date += 1
            if args.dry_run:
                b_date = parse_boroumand_date(en.get("date_of_killing", ""))
                print(f"  SKIP: {Path(yaml_file).name} — date mismatch "
                      f"(YAML: {yaml_date}, Boroumand: {b_date})")
            continue

        original = content
        changes = []

        # 1. Farsi name
        fa_name = detail.get("fa", {}).get("name_farsi")
        if fa_name:
            old = content
            content = update_yaml_null_field(content, "name_farsi", fa_name)
            if content != old:
                changes.append(f"name_farsi={fa_name}")

        # 2. Fields from EN detail
        if en.get("religion"):
            old = content
            content = update_yaml_null_field(content, "religion", en["religion"])
            if content != old:
                changes.append(f"religion={en['religion']}")

        if en.get("occupation"):
            old = content
            content = update_yaml_null_field(content, "occupation", en["occupation"])
            if content != old:
                changes.append(f"occupation={en['occupation']}")

        if en.get("place_of_birth"):
            old = content
            content = update_yaml_null_field(content, "place_of_birth", en["place_of_birth"])
            if content != old:
                changes.append(f"place_of_birth={en['place_of_birth']}")

        if en.get("date_of_birth"):
            old = content
            content = update_yaml_null_field(content, "date_of_birth", en["date_of_birth"])
            if content != old:
                changes.append(f"date_of_birth={en['date_of_birth']}")

        # 3. Photo URL
        photo = en.get("photo_url") or match.get("boroumand_photo")
        if photo:
            full_url = BASE_URL + photo if photo.startswith("/") else photo
            old = content
            content = update_yaml_null_field(content, "photo", full_url)
            if content != old:
                changes.append("photo")

        # 4. Boroumand source
        b_slug = detail.get("slug", match["boroumand_slug"])
        boroumand_url = f"{BASE_URL}/memorial/story/{vid}/{b_slug}"
        old = content
        content = add_source(content, boroumand_url, "Abdorrahman Boroumand Center — Omid Memorial")
        if content != old:
            changes.append("source=boroumand")

        # 5. Update metadata
        if changes:
            content = re.sub(
                r'^last_updated:.*$',
                f'last_updated: {datetime.now().strftime("%Y-%m-%d")}',
                content, count=1, flags=re.M
            )
            content = re.sub(
                r'^updated_by:.*$',
                'updated_by: "boroumand-import"',
                content, count=1, flags=re.M
            )

        if content != original:
            if args.dry_run:
                print(f"  DRY: {Path(yaml_file).name}: {', '.join(changes)}")
            else:
                Path(yaml_file).write_text(content)
                print(f"  UPD: {Path(yaml_file).name}: {', '.join(changes)}")
            enriched += 1
            total_changes += len(changes)

    prefix = "DRY RUN — " if args.dry_run else ""
    print(f"\n{prefix}Done: {enriched} files, {total_changes} field changes")
    print(f"  Skipped (date mismatch): {skipped_date}")
    print(f"  Skipped (no detail): {skipped_no_detail}")


# ============================================================
# Phase 5: Import New — create YAML files for unmatched entries
# ============================================================

def extract_year_from_mode(mode):
    """Extract year from mode field like 'Hanging; December 9, 2021; ...'"""
    if not mode:
        return None
    # Full date: Month Day, Year
    m = re.search(r'(\w+)\s+\d{1,2},?\s+(\d{4})', mode)
    if m and m.group(1) in MONTH_MAP:
        return int(m.group(2))
    # Bare year
    m = re.search(r'\b(19[789]\d|20[0-2]\d)\b', mode)
    if m:
        return int(m.group(1))
    return None


def slugify(text):
    """Convert text to URL-friendly slug."""
    s = text.lower().strip()
    s = re.sub(r'[\u200c\u200d]', ' ', s)  # zero-width joiners
    s = s.replace("'", "").replace("`", "").replace("\u2018", "").replace("\u2019", "")
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s-]+', '-', s).strip('-')
    return s


def generate_slug(name, year=None):
    """Generate slug from name: lastname-firstname[-year]."""
    parts = name.strip().split()
    if len(parts) >= 2:
        ordered = [parts[-1]] + parts[:-1]
    else:
        ordered = parts
    slug = slugify(' '.join(ordered))
    if year:
        slug += f'-{year}'
    return slug


def extract_province(location):
    """Extract province from Boroumand location string."""
    if not location:
        return None
    parts = [p.strip() for p in location.split(',')]
    for part in parts:
        if 'Province' in part:
            return part.replace(' Province', '').strip()
    if len(parts) >= 3 and 'Iran' in parts[-1]:
        return parts[-2].strip()
    return None


def extract_city(location):
    """Extract city from Boroumand location string."""
    if not location:
        return None
    parts = [p.strip() for p in location.split(',')]
    # Skip specific locations (prisons, etc.), find the city
    for part in parts:
        if 'Province' in part or 'Iran' in part:
            continue
        if 'Prison' in part or 'Detention' in part or 'Barracks' in part:
            continue
        return part
    return parts[0] if parts else None


def wrap_text(text, indent=4, width=78):
    """Wrap text for YAML block scalar."""
    lines = []
    words = text.split()
    line = ' ' * indent
    for word in words:
        if len(line) + len(word) + 1 > width and len(line) > indent:
            lines.append(line.rstrip())
            line = ' ' * indent + word
        else:
            line += (' ' if len(line) > indent else '') + word
    if line.strip():
        lines.append(line.rstrip())
    return '\n'.join(lines)


def yaml_quote(value):
    """Quote a string value for YAML."""
    if value is None:
        return 'null'
    s = str(value)
    if not s:
        return 'null'
    safe = s.replace('\\', '\\\\').replace('"', '\\"')
    return f'"{safe}"'


def generate_yaml(browse_entry, detail_en, detail_fa, slug, year):
    """Generate YAML content for a new victim file."""
    lines = []
    name = detail_en.get('name', browse_entry['name'])
    fa_name = detail_fa.get('name_farsi')

    # --- Identity ---
    lines.append(f'id: {slug}')
    lines.append(f'name_latin: {yaml_quote(name)}')
    lines.append(f'name_farsi: {yaml_quote(fa_name)}')

    # Date of birth
    dob_str = detail_en.get('date_of_birth')
    dob = parse_boroumand_date(dob_str) if dob_str else None
    if dob and len(dob) >= 10:
        lines.append(f'date_of_birth: {dob}')
    else:
        lines.append('date_of_birth: null')

    lines.append(f'place_of_birth: {yaml_quote(detail_en.get("place_of_birth"))}')
    lines.append('gender: null')
    lines.append('ethnicity: null')
    lines.append(f'religion: {yaml_quote(detail_en.get("religion"))}')

    # Photo
    photo = detail_en.get('photo_url') or browse_entry.get('photo_url')
    if photo:
        full_url = BASE_URL + photo if photo.startswith('/') else photo
        lines.append(f'photo: {yaml_quote(full_url)}')
    else:
        lines.append('photo: null')

    # --- Life ---
    occ = detail_en.get('occupation')
    if occ:
        lines.append(f'occupation: {yaml_quote(occ)}')

    # --- Death ---
    lines.append('')
    lines.append('# --- DEATH ---')

    date_str = detail_en.get('date_of_killing')
    death_date = parse_boroumand_date(date_str) if date_str else None
    if death_date and len(death_date) >= 10:
        lines.append(f'date_of_death: {death_date}')
    elif isinstance(year, int):
        lines.append(f'date_of_death: {year}-01-01')
    else:
        lines.append('date_of_death: null')

    age = detail_en.get('age')
    if age and re.match(r'^\d+$', age):
        lines.append(f'age_at_death: {age}')
    else:
        lines.append('age_at_death: null')

    location = detail_en.get('location')
    city = extract_city(location)
    province = extract_province(location)
    lines.append(f'place_of_death: {yaml_quote(city)}')
    lines.append(f'province: {yaml_quote(province)}')

    # Cause of death from detail mode_of_killing (cleaner) or browse mode
    mode = detail_en.get('mode_of_killing')
    if not mode:
        raw = browse_entry.get('mode', '')
        mode = raw.split(';')[0].strip() if raw else None
    lines.append(f'cause_of_death: {yaml_quote(mode)}')

    # Narrative → circumstances (filter Boroumand boilerplate)
    narrative = detail_en.get('narrative')
    if narrative and ('Correct/ Complete This Entry' in narrative
                      or 'complete this story in Omid' in narrative):
        narrative = None  # boilerplate, not real content
    if narrative and len(narrative) > 30:
        lines.append('circumstances: >')
        lines.append(wrap_text(narrative))
    else:
        lines.append('circumstances: null')

    lines.append('event_context: null')
    lines.append('responsible_forces: null')

    # --- Verification ---
    lines.append('')
    lines.append('# --- VERIFICATION ---')
    lines.append('status: unverified')
    lines.append('sources:')
    bid = browse_entry['id']
    bslug = browse_entry['slug']
    lines.append(f'  - url: "{BASE_URL}/memorial/story/{bid}/{bslug}"')
    lines.append(f'    name: "Abdorrahman Boroumand Center — Omid Memorial"')
    lines.append(f'    type: memorial_database')
    lines.append(f'last_updated: {datetime.now().strftime("%Y-%m-%d")}')
    lines.append('updated_by: "boroumand-import"')
    lines.append('')

    return '\n'.join(lines)


def cmd_import_new(args):
    """Import unmatched Boroumand entries as new YAML files."""
    if not MASTER_FILE.exists():
        print(f"Error: {MASTER_FILE} not found. Run 'browse' first.")
        sys.exit(1)

    with open(MASTER_FILE) as f:
        master = json.load(f)

    # Load matched IDs to exclude
    matched_ids = set()
    if MATCHES_FILE.exists():
        with open(MATCHES_FILE) as f:
            match_data = json.load(f)
        for m in match_data.get('matches', []):
            matched_ids.add(m['boroumand_id'])

    # Filter to unmatched
    unmatched = [e for e in master if e['id'] not in matched_ids]
    print(f"Unmatched: {len(unmatched)} (of {len(master)} total, {len(matched_ids)} matched)")

    # Extract year for each entry
    for entry in unmatched:
        entry['_year'] = extract_year_from_mode(entry.get('mode'))

    # Filter by --years or --no-date
    if args.no_date:
        unmatched = [e for e in unmatched if e['_year'] is None]
        print(f"No-date filter: {len(unmatched)} entries")
    elif args.years:
        start_y, end_y = map(int, args.years.split('-'))
        unmatched = [e for e in unmatched
                     if e['_year'] is not None and start_y <= e['_year'] <= end_y]
        print(f"Year filter ({args.years}): {len(unmatched)} entries")

    if args.limit:
        unmatched = unmatched[:args.limit]
        print(f"Limited to: {args.limit}")

    print(f"Processing {len(unmatched)} entries...")

    # Load existing slugs
    existing_slugs = set()
    for yf in VICTIMS_DIR.rglob("*.yaml"):
        if yf.name != "_template.yaml":
            existing_slugs.add(yf.stem)

    DETAIL_CACHE.mkdir(parents=True, exist_ok=True)
    progress_file = CACHE_DIR / "import_progress.json"

    # Resume support
    processed_ids = set()
    if args.resume and progress_file.exists():
        with open(progress_file) as f:
            processed_ids = set(json.load(f).get('processed', []))
        print(f"Resuming: {len(processed_ids)} already processed")

    created = 0
    skipped_resume = 0
    fetch_count = 0
    cached_count = 0

    # --- Parallel fetch helper ---
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    fetch_lock = threading.Lock()

    def fetch_detail(entry):
        """Fetch EN+FA detail pages for one entry, return (entry, detail, was_fetched)."""
        bid = entry['id']
        cache_file = DETAIL_CACHE / f"{bid}.json"

        if cache_file.exists():
            with open(cache_file) as f:
                detail = json.load(f)
            return (entry, detail, False)  # False = from cache

        if getattr(args, 'cache_only', False):
            return (entry, None, False)  # skip

        en_html = fetch(DETAIL_URL.format(id=bid, slug=entry['slug']))
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
        fa_html = fetch(DETAIL_FA_URL.format(id=bid, slug=entry['slug']))
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

        detail = {"boroumand_id": bid, "slug": entry['slug']}
        if en_html:
            detail["en"] = parse_detail_en(en_html)
        if fa_html:
            detail["fa"] = parse_detail_fa(fa_html)

        if not args.dry_run:
            with open(cache_file, "w") as f:
                json.dump(detail, f, indent=2, ensure_ascii=False)

        return (entry, detail, True)  # True = freshly fetched

    # Filter to entries that still need processing
    todo = [e for e in unmatched if e['id'] not in processed_ids]
    skipped_resume = len(unmatched) - len(todo)
    if skipped_resume:
        print(f"Skipped {skipped_resume} already processed entries")
    print(f"Processing {len(todo)} entries with {PARALLEL_WORKERS} workers...\n")

    # Process in batches: fetch in parallel, write YAML sequentially
    BATCH_SIZE = PARALLEL_WORKERS * 4  # fetch 16 at a time
    for batch_start in range(0, len(todo), BATCH_SIZE):
        batch = todo[batch_start:batch_start + BATCH_SIZE]
        results = []

        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
            futures = {executor.submit(fetch_detail, e): e for e in batch}
            for future in as_completed(futures):
                try:
                    results.append(future.result())
                except Exception as exc:
                    entry = futures[future]
                    print(f"  ✗ Worker error for {entry['id']}: {exc}")

        # Sort results back to original order (by position in batch)
        batch_ids = [e['id'] for e in batch]
        results.sort(key=lambda r: batch_ids.index(r[0]['id']))

        # Sequential YAML creation (needs unique slug generation)
        for entry, detail, was_fetched in results:
            if detail is None:
                continue  # cache-only skip

            bid = entry['id']
            if was_fetched:
                fetch_count += 1
            else:
                cached_count += 1

            detail_en = detail.get('en', {})
            detail_fa = detail.get('fa', {})

            # 2. Determine year for directory
            year = entry['_year']
            if not year:
                death_date = parse_boroumand_date(detail_en.get('date_of_killing', ''))
                if death_date and len(death_date) >= 4:
                    year = int(death_date[:4])
            if not year:
                year = 'unknown'

            # 3. Generate unique slug
            name = detail_en.get('name', entry['name'])
            birth_date = parse_boroumand_date(detail_en.get('date_of_birth', ''))
            birth_year = int(birth_date[:4]) if birth_date and len(birth_date) >= 4 else None
            death_year = year if isinstance(year, int) else None

            slug = generate_slug(name, birth_year or death_year)
            if not slug:
                slug = f"boroumand-{bid}"

            base_slug = slug
            suffix = 2
            while slug in existing_slugs:
                slug = f"{base_slug}-{suffix}"
                suffix += 1
            existing_slugs.add(slug)

            # 4. Generate YAML
            yaml_content = generate_yaml(entry, detail_en, detail_fa, slug, year)

            # 5. Write file
            year_dir = VICTIMS_DIR / str(year)
            yaml_file = year_dir / f"{slug}.yaml"

            if args.dry_run:
                if created < 5:
                    print(f"  DRY: {yaml_file.relative_to(VICTIMS_DIR)} — {name}")
                    if detail_fa.get('name_farsi'):
                        print(f"       FA: {detail_fa['name_farsi']}")
            else:
                year_dir.mkdir(parents=True, exist_ok=True)
                yaml_file.write_text(yaml_content)

            created += 1
            processed_ids.add(bid)

            # Progress save every 50 entries
            if not args.dry_run and created % 50 == 0:
                with open(progress_file, "w") as f:
                    json.dump({'processed': list(processed_ids)}, f)

            # Status every 100 entries
            if created % 100 == 0:
                fa = detail_fa.get('name_farsi', '—')
                total_idx = batch_start + batch.index(entry) + 1 + skipped_resume
                print(f"  [{total_idx}/{len(unmatched)}] {created} created, "
                      f"{fetch_count} fetched, {cached_count} cached — {name} ({fa})")

    # Final progress save
    if not args.dry_run and processed_ids:
        with open(progress_file, "w") as f:
            json.dump({'processed': list(processed_ids)}, f)

    prefix = "DRY RUN — " if args.dry_run else ""
    print(f"\n{prefix}Done: {created} files created")
    print(f"  Fetched: {fetch_count} detail pages")
    print(f"  Cached: {cached_count} detail pages")
    print(f"  Skipped (resumed): {skipped_resume}")


# ============================================================
# Main
# ============================================================

def main():
    p = argparse.ArgumentParser(description="Scrape Boroumand Foundation memorial")
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("browse", help="Crawl browse pages → master list")
    b.add_argument("--start", type=int, help="Start page (default: 1)")
    b.add_argument("--end", type=int, help="End page (default: 545)")
    b.add_argument("--resume", action="store_true", help="Resume from last progress")

    sub.add_parser("match", help="Match against existing YAMLs")

    d = sub.add_parser("detail", help="Fetch EN + FA detail pages")
    d.add_argument("--limit", type=int, help="Max victims to fetch")
    d.add_argument("--force", action="store_true", help="Re-fetch cached")

    e = sub.add_parser("enrich", help="Update YAML files")
    e.add_argument("--dry-run", action="store_true", help="Don't write files")

    i = sub.add_parser("import-new", help="Create new YAMLs for unmatched entries")
    i.add_argument("--years", type=str, help="Year range filter (e.g., 2022-2026)")
    i.add_argument("--no-date", action="store_true", help="Only entries without extractable date")
    i.add_argument("--limit", type=int, help="Max entries to process")
    i.add_argument("--dry-run", action="store_true", help="Don't write files")
    i.add_argument("--resume", action="store_true", help="Resume from last progress")
    i.add_argument("--cache-only", action="store_true", help="Only process entries with cached details (skip fetching)")

    args = p.parse_args()

    cmds = {
        "browse": cmd_browse, "match": cmd_match, "detail": cmd_detail,
        "enrich": cmd_enrich, "import-new": cmd_import_new,
    }
    cmds[args.cmd](args)


if __name__ == "__main__":
    main()
