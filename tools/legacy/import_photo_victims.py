#!/usr/bin/env python3
"""
Targeted import of Boroumand entries that have PHOTOS.

Reads browse_progress.json, filters to entries with photos that aren't
in our YAML yet, fetches their detail pages (EN + FA), and creates
YAML files.

Usage:
  python tools/import_photo_victims.py --dry-run    # Preview
  python tools/import_photo_victims.py               # Run
  python tools/import_photo_victims.py --resume      # Resume after interrupt
"""

import argparse
import json
import glob
import os
import re
import ssl
import sys
import time
import random
import yaml
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# --- Reuse scraper infrastructure ---
SCRIPT_DIR = Path(__file__).parent
CACHE_DIR = SCRIPT_DIR / ".boroumand_cache"
DETAIL_CACHE = CACHE_DIR / "detail"
VICTIMS_DIR = SCRIPT_DIR.parent / "data" / "victims"
PROGRESS_FILE = CACHE_DIR / "photo_import_progress.json"

BASE_URL = "https://www.iranrights.org"
DETAIL_URL = BASE_URL + "/memorial/story/{id}/{slug}"
DETAIL_FA_URL = BASE_URL + "/fa/memorial/story/{id}/{slug}"

MIN_DELAY = 1.5
MAX_DELAY = 2.5

HEADERS = {
    "User-Agent": "iran-memorial-project/1.0 (human-rights-research; github.com/iran-memorial26/iran-memorial)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
}

SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

MONTH_MAP = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12',
}


def fetch(url, retries=3):
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
                print(f"  ✗ FAILED: {url}: {e}")
                return None
    return None


def delay():
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def parse_detail_en(html):
    data = {}
    h1_m = re.search(r"<h1 class='page-top'>([^<]+)</h1>", html)
    if h1_m:
        data["name"] = h1_m.group(1).strip()
    photo_m = re.search(r'<img[^>]+src="(/actorphotos/[^"]+)"', html)
    if photo_m:
        data["photo_url"] = photo_m.group(1)
    field_map = {
        "Age": "age", "Nationality": "nationality", "Religion": "religion",
        "Civil Status": "civil_status", "Date of Killing": "date_of_killing",
        "Location of Killing": "location", "Mode of Killing": "mode_of_killing",
        "Charges": "charges", "Date of Birth": "date_of_birth",
        "Place of Birth": "place_of_birth", "Occupation": "occupation",
    }
    for m in re.finditer(r'<em>([^<]+)</em>\s*([^<]+)', html):
        label = m.group(1).strip().rstrip(':')
        value = m.group(2).strip()
        if value and value != "---" and label in field_map:
            data[field_map[label]] = value
    narr_m = re.search(
        r'<h2[^>]*>About this Case</h2>\s*(.*?)(?=<h2|<footer|<div\s+id=)',
        html, re.DOTALL
    )
    if narr_m:
        text = re.sub(r'<[^>]+>', ' ', narr_m.group(1))
        text = re.sub(r'&\w+;', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        if 'Correct/ Complete This Entry' in text or 'complete this story in Omid' in text:
            text = re.sub(r'Correct/?\s*Complete This Entry\s*[❯>]?\s*', '', text).strip()
            text = re.sub(r'The story of .+?is not complete\..+?We appreciate your support\.?\s*', '', text, flags=re.DOTALL).strip()
        if len(text) > 50:
            data["narrative"] = text[:5000]
    return data


def parse_detail_fa(html):
    data = {}
    h1_m = re.search(r"<h1 class='page-top'>([^<]+)</h1>", html)
    if h1_m:
        text = h1_m.group(1).strip()
        if re.search(r'[\u0600-\u06FF]', text):
            data["name_farsi"] = text
    return data


def parse_boroumand_date(text):
    if not text:
        return None
    m = re.search(r'(\w+)\s+(\d{1,2}),?\s+(\d{4})', text)
    if m and m.group(1) in MONTH_MAP:
        return f"{m.group(3)}-{MONTH_MAP[m.group(1)]}-{int(m.group(2)):02d}"
    m = re.search(r'(\w+),?\s+(\d{4})', text)
    if m and m.group(1) in MONTH_MAP:
        return f"{m.group(2)}-{MONTH_MAP[m.group(1)]}-01"
    m = re.search(r'\b(19[789]\d|20[0-2]\d)\b', text)
    if m:
        return f"{m.group(1)}-01-01"
    return None


def extract_year_from_mode(mode):
    if not mode:
        return None
    m = re.search(r'(\w+)\s+\d{1,2},?\s+(\d{4})', mode)
    if m and m.group(1) in MONTH_MAP:
        return int(m.group(2))
    m = re.search(r'\b(19[789]\d|20[0-2]\d)\b', mode)
    if m:
        return int(m.group(1))
    return None


def slugify(text):
    s = text.lower().strip()
    s = re.sub(r'[\u200c\u200d]', ' ', s)
    s = s.replace("'", "").replace("`", "").replace("\u2018", "").replace("\u2019", "")
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s-]+', '-', s).strip('-')
    return s


def generate_slug(name, year=None):
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
    if not location:
        return None
    parts = [p.strip() for p in location.split(',')]
    for part in parts:
        if 'Province' in part or 'Iran' in part:
            continue
        if 'Prison' in part or 'Detention' in part or 'Barracks' in part:
            continue
        return part
    return parts[0] if parts else None


def wrap_text(text, indent=4, width=78):
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
    if value is None:
        return 'null'
    s = str(value)
    if not s:
        return 'null'
    safe = s.replace('\\', '\\\\').replace('"', '\\"')
    return f'"{safe}"'


def generate_yaml(browse_entry, detail_en, detail_fa, slug, year):
    lines = []
    name = detail_en.get('name', browse_entry['name'])
    fa_name = detail_fa.get('name_farsi')

    lines.append(f'id: {slug}')
    lines.append(f'name_latin: {yaml_quote(name)}')
    lines.append(f'name_farsi: {yaml_quote(fa_name)}')

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

    photo = detail_en.get('photo_url') or browse_entry.get('photo_url')
    if photo:
        full_url = BASE_URL + photo if photo.startswith('/') else photo
        lines.append(f'photo: {yaml_quote(full_url)}')
    else:
        lines.append('photo: null')

    occ = detail_en.get('occupation')
    if occ:
        lines.append(f'occupation: {yaml_quote(occ)}')

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

    mode = detail_en.get('mode_of_killing')
    if not mode:
        raw = browse_entry.get('mode', '')
        mode = raw.split(';')[0].strip() if raw else None
    lines.append(f'cause_of_death: {yaml_quote(mode)}')

    narrative = detail_en.get('narrative')
    if narrative and ('Correct/ Complete This Entry' in narrative
                      or 'complete this story in Omid' in narrative):
        narrative = None
    if narrative and len(narrative) > 30:
        lines.append('circumstances: >')
        lines.append(wrap_text(narrative))
    else:
        lines.append('circumstances: null')

    lines.append('event_context: null')
    lines.append('responsible_forces: null')

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
    lines.append('updated_by: "boroumand-photo-import"')
    lines.append('')

    return '\n'.join(lines)


def get_yaml_boroumand_ids():
    """Get all Boroumand IDs already in our YAML files."""
    ids = set()
    for yf in glob.glob(str(VICTIMS_DIR / "**" / "*.yaml"), recursive=True):
        try:
            with open(yf) as fh:
                v = yaml.safe_load(fh.read())
            if not v:
                continue
            for s in (v.get('sources', []) or []):
                url = s.get('url', '') or ''
                if 'iranrights.org' in url:
                    m = re.search(r'/story/(-?\d+)/', url)
                    if m:
                        ids.add(int(m.group(1)))
                    break
        except:
            pass
    return ids


def main():
    parser = argparse.ArgumentParser(description="Import Boroumand entries with photos")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--resume", action="store_true", help="Resume from last progress")
    parser.add_argument("--limit", type=int, help="Max entries to process")
    args = parser.parse_args()

    # 1. Load browse data
    browse_file = CACHE_DIR / "browse_progress.json"
    if not browse_file.exists():
        print("Error: browse_progress.json not found. Run scrape_boroumand.py browse first.")
        sys.exit(1)

    with open(browse_file) as f:
        browse_data = json.load(f)

    all_entries = browse_data['entries']
    photo_entries = [e for e in all_entries if e.get('photo_url')]
    print(f"Browse entries with photos: {len(photo_entries)}")

    # 2. Filter out entries already in our YAML
    print("Scanning existing YAML files...")
    existing_ids = get_yaml_boroumand_ids()
    print(f"Existing Boroumand IDs in YAML: {len(existing_ids)}")

    new_entries = [e for e in photo_entries if e['id'] not in existing_ids]
    print(f"New entries to import (with photos): {len(new_entries)}")

    if args.limit:
        new_entries = new_entries[:args.limit]
        print(f"Limited to: {args.limit}")

    # 3. Load resume progress
    processed_ids = set()
    if args.resume and PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            processed_ids = set(json.load(f).get('processed', []))
        print(f"Resuming: {len(processed_ids)} already processed")

    # 4. Load existing slugs
    existing_slugs = set()
    for yf in VICTIMS_DIR.rglob("*.yaml"):
        if yf.name != "_template.yaml":
            existing_slugs.add(yf.stem)

    DETAIL_CACHE.mkdir(parents=True, exist_ok=True)

    created = 0
    skipped = 0
    fetched = 0
    cached = 0
    errors = 0
    start_time = time.time()

    for i, entry in enumerate(new_entries):
        bid = entry['id']

        if bid in processed_ids:
            skipped += 1
            continue

        # Fetch or load detail
        cache_file = DETAIL_CACHE / f"{bid}.json"

        if cache_file.exists():
            with open(cache_file) as f:
                detail = json.load(f)
            cached += 1
        else:
            en_html = fetch(DETAIL_URL.format(id=bid, slug=entry['slug']))
            delay()
            fa_html = fetch(DETAIL_FA_URL.format(id=bid, slug=entry['slug']))
            delay()

            detail = {"boroumand_id": bid, "slug": entry['slug']}
            if en_html:
                detail["en"] = parse_detail_en(en_html)
            else:
                errors += 1
                print(f"  ✗ Failed to fetch EN for {entry['name']} (ID: {bid})")
                processed_ids.add(bid)
                continue
            if fa_html:
                detail["fa"] = parse_detail_fa(fa_html)

            if not args.dry_run:
                with open(cache_file, "w") as f:
                    json.dump(detail, f, indent=2, ensure_ascii=False)
            fetched += 1

        detail_en = detail.get('en', {})
        detail_fa = detail.get('fa', {})

        # Determine year
        year = extract_year_from_mode(entry.get('mode'))
        if not year:
            death_date = parse_boroumand_date(detail_en.get('date_of_killing', ''))
            if death_date and len(death_date) >= 4:
                year = int(death_date[:4])
        if not year:
            year = 'unknown'

        # Generate slug
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

        # Generate + write YAML
        yaml_content = generate_yaml(entry, detail_en, detail_fa, slug, year)

        year_dir = VICTIMS_DIR / str(year)
        yaml_file = year_dir / f"{slug}.yaml"

        if args.dry_run:
            if created < 10:
                photo = detail_en.get('photo_url') or entry.get('photo_url', '?')
                fa = detail_fa.get('name_farsi', '—')
                print(f"  DRY: {yaml_file.relative_to(VICTIMS_DIR)} — {name} ({fa}) — {photo}")
        else:
            year_dir.mkdir(parents=True, exist_ok=True)
            yaml_file.write_text(yaml_content)

        created += 1
        processed_ids.add(bid)

        # Save progress every 25 entries
        if not args.dry_run and created % 25 == 0:
            with open(PROGRESS_FILE, "w") as f:
                json.dump({'processed': list(processed_ids)}, f)

        # Status every 50 entries
        if created % 50 == 0:
            elapsed = time.time() - start_time
            rate = created / elapsed if elapsed > 0 else 0
            remaining = (len(new_entries) - i - 1) / rate if rate > 0 else 0
            fa = detail_fa.get('name_farsi', '—')
            print(f"  [{i+1}/{len(new_entries)}] {created} created, "
                  f"{fetched} fetched, {cached} cached — "
                  f"{name} ({fa}) — "
                  f"~{int(remaining/60)}m remaining")

    # Final save
    if not args.dry_run and processed_ids:
        with open(PROGRESS_FILE, "w") as f:
            json.dump({'processed': list(processed_ids)}, f)

    elapsed = time.time() - start_time
    prefix = "DRY RUN — " if args.dry_run else ""
    print(f"\n{prefix}Done in {int(elapsed)}s:")
    print(f"  Created: {created} YAML files (all with photos)")
    print(f"  Fetched: {fetched} detail pages")
    print(f"  Cached: {cached} detail pages")
    print(f"  Skipped (resumed): {skipped}")
    print(f"  Errors: {errors}")


if __name__ == "__main__":
    main()
