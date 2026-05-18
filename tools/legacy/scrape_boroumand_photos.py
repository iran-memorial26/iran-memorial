#!/usr/bin/env python3
"""
Scrape photos from Boroumand Foundation (iranrights.org) for existing YAML victims.

Finds YAML files that:
  1. Have a Boroumand source URL (iranrights.org/memorial/story/...)
  2. Have photo: null

Then fetches each detail page and extracts the photo URL.

Usage:
    python tools/scrape_boroumand_photos.py [--dry-run] [--limit N] [--years 2021-2026]
"""

import os
import re
import sys
import ssl
import json
import time
import random
import argparse
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from datetime import date

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
VICTIMS_DIR = PROJECT_ROOT / "data" / "victims"
CACHE_DIR = SCRIPT_DIR / ".boroumand_photo_cache"
PROGRESS_FILE = SCRIPT_DIR / ".boroumand_photo_progress.json"

BASE_URL = "https://www.iranrights.org"
MIN_DELAY = 1.5
MAX_DELAY = 2.5

HEADERS = {
    "User-Agent": "iran-memorial-project/1.0 (human-rights-research; github.com/iran-memorial26/iran-memorial)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
}

# macOS Python SSL
SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE


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
                print(f"  Retry {attempt+1}/{retries}: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                print(f"  FAILED after {retries} attempts: {url}: {e}")
                return None
    return None


def delay():
    """Random delay between requests."""
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def extract_photo_from_html(html):
    """Extract photo URL from Boroumand detail page.

    Real photos are in /actorphotos/ — skip placeholders.
    """
    photo_match = re.search(r'<img[^>]+src="(/actorphotos/[^"]+)"', html)
    if photo_match:
        return photo_match.group(1)
    return None


def find_victims_needing_photos(year_dirs):
    """Find YAML files with Boroumand URLs but no photo."""
    victims = []

    for year_dir in year_dirs:
        dir_path = VICTIMS_DIR / str(year_dir)
        if not dir_path.exists():
            continue

        for yaml_file in dir_path.glob("*.yaml"):
            if yaml_file.name == "_template.yaml":
                continue

            content = yaml_file.read_text(errors="replace")

            # Skip if already has a photo
            photo_match = re.search(r'^photo:\s*(.+)$', content, re.M)
            if photo_match:
                val = photo_match.group(1).strip().strip('"').strip("'")
                if val and val != "null":
                    continue

            # Check for Boroumand source URL
            boroumand_urls = re.findall(
                r'https?://(?:www\.)?iranrights\.org/memorial/story/(-?\d+)/([^\s"\']+)',
                content
            )
            if not boroumand_urls:
                continue

            # Extract name for display
            name_match = re.search(r'^name_latin:\s*"?([^"\n]+)"?', content, re.M)
            name = name_match.group(1).strip() if name_match else yaml_file.stem

            # Use first Boroumand URL found
            victim_id = int(boroumand_urls[0][0])
            slug = boroumand_urls[0][1]

            victims.append({
                "file": yaml_file,
                "name": name,
                "boroumand_id": victim_id,
                "boroumand_slug": slug,
                "url": f"{BASE_URL}/memorial/story/{victim_id}/{slug}",
            })

    return victims


def update_yaml_photo(filepath, photo_url, dry_run=False):
    """Update photo: null → photo: "URL" in a YAML file."""
    content = filepath.read_text(errors="replace")

    pattern = r'^(photo:\s*)(?:null|""|\'\')\s*$'
    match = re.search(pattern, content, re.M)
    if not match:
        return False

    new_content = content[:match.start()] + match.group(1) + f'"{photo_url}"' + content[match.end():]

    # Update metadata
    new_content = re.sub(
        r'^last_updated:.*$',
        f'last_updated: {date.today().isoformat()}',
        new_content, count=1, flags=re.M
    )

    if not dry_run:
        filepath.write_text(new_content)

    return True


def main():
    parser = argparse.ArgumentParser(description="Scrape Boroumand photos for existing YAML victims")
    parser.add_argument("--dry-run", action="store_true", help="Count potential matches without fetching/writing")
    parser.add_argument("--limit", type=int, help="Max victims to process")
    parser.add_argument("--years", type=str, default="2021-2026", help="Year range (e.g., 2021-2026)")
    parser.add_argument("--resume", action="store_true", help="Resume from last progress")
    parser.add_argument("--all-years", action="store_true", help="Process all years (1979-2026)")
    args = parser.parse_args()

    if args.all_years:
        year_dirs = list(range(1979, 2027)) + ["unknown"]
    else:
        start_year, end_year = map(int, args.years.split("-"))
        year_dirs = list(range(start_year, end_year + 1))

    print(f"{'DRY RUN — ' if args.dry_run else ''}Boroumand Photo Scraper")
    print(f"Years: {year_dirs[0]}–{year_dirs[-1] if isinstance(year_dirs[-1], int) else year_dirs[-2]}")
    print()

    # Step 1: Find victims needing photos
    print("Scanning YAML files for Boroumand URLs + missing photos...")
    victims = find_victims_needing_photos(year_dirs)
    print(f"  Found {len(victims)} victims with Boroumand URLs and no photo")

    if args.limit:
        victims = victims[:args.limit]
        print(f"  Limited to {args.limit}")

    if not victims:
        print("Nothing to do.")
        return

    if args.dry_run:
        print()
        print(f"Would fetch {len(victims)} Boroumand detail pages.")
        print("Sample URLs:")
        for v in victims[:10]:
            print(f"  {v['file'].name:40s} → {v['url']}")
        print()
        print("*** Dry run — no pages fetched, no files modified ***")
        return

    # Step 2: Load progress for resume
    processed_ids = set()
    if args.resume and PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            processed_ids = set(json.load(f).get("processed", []))
        print(f"  Resuming: {len(processed_ids)} already processed")

    # Step 3: Fetch detail pages and extract photos
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    updated = 0
    no_photo = 0
    failed = 0
    cached = 0
    skipped = 0

    for i, victim in enumerate(victims):
        vid = victim["boroumand_id"]

        if vid in processed_ids:
            skipped += 1
            continue

        # Check cache
        cache_file = CACHE_DIR / f"{vid}.json"
        photo_url = None

        if cache_file.exists():
            with open(cache_file) as f:
                cache_data = json.load(f)
            photo_url = cache_data.get("photo_url")
            cached += 1
        else:
            # Fetch detail page
            html = fetch(victim["url"])
            if html:
                photo_path = extract_photo_from_html(html)
                if photo_path:
                    photo_url = BASE_URL + photo_path

                # Cache result
                with open(cache_file, "w") as f:
                    json.dump({"boroumand_id": vid, "photo_url": photo_url}, f)
            else:
                failed += 1

            delay()

        if photo_url:
            success = update_yaml_photo(victim["file"], photo_url)
            if success:
                updated += 1
                if updated <= 10 or updated % 50 == 0:
                    print(f"  [{i+1}/{len(victims)}] {victim['name']:35s} → photo found")
            else:
                no_photo += 1
        else:
            no_photo += 1

        processed_ids.add(vid)

        # Save progress every 25 entries
        if (i + 1) % 25 == 0:
            with open(PROGRESS_FILE, "w") as f:
                json.dump({"processed": list(processed_ids)}, f)

    # Final progress save
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"processed": list(processed_ids)}, f)

    # Results
    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Total candidates:    {len(victims)}")
    print(f"Updated with photo:  {updated}")
    print(f"No photo on page:    {no_photo}")
    print(f"Fetch failures:      {failed}")
    print(f"From cache:          {cached}")
    print(f"Skipped (resumed):   {skipped}")


if __name__ == "__main__":
    main()
