#!/usr/bin/env python3
"""
Scrape photos from iranvictims.com and match them to existing YAML victim files.

The iranvictims.com page loads all ~4,721 victim cards on a single page.
Each card has a data-card-id, data-search (name in EN + FA), and a lazy-loaded image.

Matching strategy:
  1. Card ID match: YAML sources contain "iranvictims.com — Victim #NNNN"
  2. Name match: Normalized name comparison (word-order-independent)

Usage:
    python tools/scrape_iranvictims_photos.py [--dry-run] [--cache FILE] [--years 2021-2026]
"""

import os
import re
import sys
import ssl
import json
import time
import argparse
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from datetime import date

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
VICTIMS_DIR = PROJECT_ROOT / "data" / "victims"
CACHE_FILE = SCRIPT_DIR / ".iranvictims_photos_cache.json"

PAGE_URL = "https://iranvictims.com"

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


def fetch_page(url, retries=3):
    """Fetch URL with retries."""
    for attempt in range(retries):
        try:
            req = Request(url, headers=HEADERS)
            with urlopen(req, timeout=60, context=SSL_CTX) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError, OSError) as e:
            wait = (attempt + 1) * 10
            if attempt < retries - 1:
                print(f"  Retry {attempt+1}/{retries}: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                print(f"  FAILED after {retries} attempts: {e}")
                return None
    return None


def parse_victim_cards(html):
    """Parse all victim cards from iranvictims.com HTML.

    HTML structure:
    <div class=victim-card data-card-id=5520 data-search="abbas amirbeigi عباس امیربیگی tehran" data-gender=male>
      <div class=victim-image-container>
        <img class="victim-image lazy" data-src=https://storage.googleapis.com/media-cdn-7k9x2/img_42393_0_instagram_v1.jpg>
    """
    cards = []

    # Find each victim-card div with its attributes
    card_pattern = re.compile(
        r'<div\s+class=["\']?victim-card["\']?\s+'
        r'data-card-id=["\']?(\d+)["\']?\s+'
        r'data-search=["\']([^"\']+)["\']',
        re.IGNORECASE
    )

    # For each card, find the image
    for match in card_pattern.finditer(html):
        card_id = int(match.group(1))
        search_text = match.group(2).strip()

        # Find the next img with data-src after this card
        img_start = match.end()
        img_end = html.find('</div>', img_start + 500)  # look within ~500 chars
        if img_end == -1:
            img_end = img_start + 1000

        card_html = html[img_start:img_end]

        # Try data-src first (lazy-loaded), then src
        # Note: values may be unquoted in the HTML (data-src=https://...)
        img_match = re.search(r'data-src=["\']([^"\']+)["\']', card_html)
        if not img_match:
            img_match = re.search(r'data-src=([^\s>]+)', card_html)
        if not img_match:
            img_match = re.search(r'src=["\']?([^\s"\'>,]+\.(?:jpg|jpeg|png|webp))["\']?', card_html, re.I)

        photo_url = img_match.group(1) if img_match else None

        # Skip placeholder/default images
        if photo_url and ('placeholder' in photo_url.lower() or 'default' in photo_url.lower()):
            photo_url = None

        # Extract English and Farsi names from search text
        # Format: "firstname lastname نام فارسی city"
        # Split at first Farsi character boundary
        farsi_match = re.search(r'[\u0600-\u06FF]', search_text)
        if farsi_match:
            name_en = search_text[:farsi_match.start()].strip()
            rest = search_text[farsi_match.start():].strip()
            # Farsi name is the Farsi text portion
            farsi_parts = re.findall(r'[\u0600-\u06FF\u200c\s]+', rest)
            name_fa = farsi_parts[0].strip() if farsi_parts else None
        else:
            name_en = search_text.strip()
            name_fa = None

        if not name_en:
            continue

        cards.append({
            "card_id": card_id,
            "name_en": name_en,
            "name_fa": name_fa,
            "photo_url": photo_url,
            "search_text": search_text,
        })

    return cards


def normalize_name(name):
    """Normalize name for matching: lowercase, remove special chars, sort words."""
    if not name:
        return set()
    name = name.lower().strip()
    name = re.sub(r'[\u200c\u200d]', ' ', name)  # zero-width joiners
    name = re.sub(r"[-'`\"\u2018\u2019]", '', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return set(name.split())


def normalize_farsi(name):
    """Normalize Farsi name for matching."""
    if not name:
        return set()
    name = name.strip()
    name = re.sub(r'[\u200c\u200d]', ' ', name)  # half-space → space
    name = re.sub(r'\s+', ' ', name).strip()
    return set(name.split())


def load_yaml_victims(year_dirs):
    """Load victim YAML files that need photos. Returns list of dicts."""
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

            # Extract name
            name_match = re.search(r'^name_latin:\s*"?([^"\n]+)"?', content, re.M)
            name = name_match.group(1).strip() if name_match else None
            if not name or name == "null":
                continue

            # Extract Farsi name
            farsi_match = re.search(r'^name_farsi:\s*"?([^"\n]+)"?', content, re.M)
            farsi = farsi_match.group(1).strip() if farsi_match else None
            if farsi == "null":
                farsi = None

            # Extract iranvictims card ID from sources
            card_id = None
            card_match = re.search(r'iranvictims\.com\s*(?:—|-)?\s*Victim\s*#(\d+)', content)
            if card_match:
                card_id = int(card_match.group(1))

            victims.append({
                "file": yaml_file,
                "name": name,
                "name_farsi": farsi,
                "card_id": card_id,
                "name_parts": normalize_name(name),
                "farsi_parts": normalize_farsi(farsi),
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
    parser = argparse.ArgumentParser(description="Scrape iranvictims.com photos into YAML files")
    parser.add_argument("--dry-run", action="store_true", help="Count matches without writing")
    parser.add_argument("--cache", type=str, default=str(CACHE_FILE), help="Cache file for parsed cards")
    parser.add_argument("--years", type=str, default="2021-2026", help="Year range to update (e.g., 2021-2026)")
    parser.add_argument("--force-fetch", action="store_true", help="Re-fetch page even if cache exists")
    args = parser.parse_args()

    cache_path = Path(args.cache)

    # Parse year range
    start_year, end_year = map(int, args.years.split("-"))
    year_dirs = list(range(start_year, end_year + 1))

    print(f"{'DRY RUN — ' if args.dry_run else ''}iranvictims.com Photo Scraper")
    print(f"Years: {start_year}–{end_year}")
    print()

    # Step 1: Load or fetch + parse cards
    cards = []
    if cache_path.exists() and not args.force_fetch:
        print(f"Loading cached cards from {cache_path}...")
        with open(cache_path) as f:
            cards = json.load(f)
        print(f"  {len(cards)} cards loaded from cache")
    else:
        print(f"Fetching {PAGE_URL} ...")
        html = fetch_page(PAGE_URL)
        if not html:
            print("ERROR: Could not fetch iranvictims.com")
            sys.exit(1)

        print(f"  Page size: {len(html):,} bytes")
        cards = parse_victim_cards(html)
        print(f"  Parsed {len(cards)} victim cards")

        # Save cache
        with open(cache_path, "w") as f:
            json.dump(cards, f, ensure_ascii=False)
        print(f"  Cached to {cache_path}")

    # Stats
    with_photo = sum(1 for c in cards if c.get("photo_url"))
    print(f"  Cards with photos: {with_photo}")
    print(f"  Cards without photos: {len(cards) - with_photo}")
    print()

    # Step 2: Load YAML victims needing photos
    print(f"Loading YAML victims from years {start_year}–{end_year}...")
    victims = load_yaml_victims(year_dirs)
    print(f"  {len(victims)} victims need photos")
    with_card_id = sum(1 for v in victims if v["card_id"] is not None)
    print(f"  {with_card_id} have iranvictims card IDs")
    print()

    # Step 3: Build lookup indexes
    # Index cards by card_id
    cards_by_id = {}
    for card in cards:
        if card.get("photo_url"):
            cards_by_id[card["card_id"]] = card

    # Index cards by normalized name parts (for name matching)
    cards_by_name = {}
    for card in cards:
        if card.get("photo_url"):
            name_parts = normalize_name(card["name_en"])
            if len(name_parts) >= 2:
                key = frozenset(name_parts)
                cards_by_name.setdefault(key, []).append(card)

    # Index cards by Farsi name
    cards_by_farsi = {}
    for card in cards:
        if card.get("photo_url") and card.get("name_fa"):
            farsi_parts = normalize_farsi(card["name_fa"])
            if len(farsi_parts) >= 2:
                key = frozenset(farsi_parts)
                cards_by_farsi.setdefault(key, []).append(card)

    # Step 4: Match and update
    print("Matching victims to photos...")
    matched_card_id = 0
    matched_name_en = 0
    matched_name_fa = 0
    no_match = 0
    updated = 0
    sample_matches = []

    for victim in victims:
        card = None
        match_type = None

        # Strategy 1: Card ID match (highest confidence)
        if victim["card_id"] and victim["card_id"] in cards_by_id:
            card = cards_by_id[victim["card_id"]]
            match_type = "card_id"

        # Strategy 2: English name match (word-set equality)
        if not card and len(victim["name_parts"]) >= 2:
            key = frozenset(victim["name_parts"])
            candidates = cards_by_name.get(key, [])
            if len(candidates) == 1:
                card = candidates[0]
                match_type = "name_en"

        # Strategy 3: Farsi name match
        if not card and len(victim["farsi_parts"]) >= 2:
            key = frozenset(victim["farsi_parts"])
            candidates = cards_by_farsi.get(key, [])
            if len(candidates) == 1:
                card = candidates[0]
                match_type = "name_fa"

        if card:
            photo_url = card["photo_url"]
            success = update_yaml_photo(victim["file"], photo_url, dry_run=args.dry_run)
            if success:
                updated += 1
                if match_type == "card_id":
                    matched_card_id += 1
                elif match_type == "name_en":
                    matched_name_en += 1
                elif match_type == "name_fa":
                    matched_name_fa += 1

                # Collect samples
                if len(sample_matches) < 10:
                    sample_matches.append({
                        "yaml": victim["file"].name,
                        "card_id": card["card_id"],
                        "name": victim["name"],
                        "match_type": match_type,
                        "photo": photo_url[:80] + "..." if len(photo_url) > 80 else photo_url,
                    })
        else:
            no_match += 1

    # Results
    print()
    print("=" * 60)
    print(f"{'DRY RUN — ' if args.dry_run else ''}RESULTS")
    print("=" * 60)
    print(f"YAML victims needing photos:  {len(victims)}")
    print(f"iranvictims cards with photos: {with_photo}")
    print()
    print(f"Matched + updated:   {updated}")
    print(f"  via card_id:       {matched_card_id}")
    print(f"  via name (EN):     {matched_name_en}")
    print(f"  via name (FA):     {matched_name_fa}")
    print(f"No match:            {no_match}")
    print()

    if sample_matches:
        print("Sample matches:")
        for s in sample_matches:
            print(f"  {s['yaml']:40s} [{s['match_type']:8s}] → card #{s['card_id']}")
            print(f"    {s['name']}")
            print(f"    {s['photo']}")
        print()

    if args.dry_run:
        print("*** No files were modified (dry run) ***")


if __name__ == "__main__":
    main()
