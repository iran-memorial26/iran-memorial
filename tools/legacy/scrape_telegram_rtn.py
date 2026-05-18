#!/usr/bin/env python3
"""
Scrape the Telegram channel "RememberTheirNames" (نام‌ها را به خاطر بسپار)
via the public web preview at t.me/s/RememberTheirNames.

Extracts: post number, name (Farsi), date (Shamsi→Gregorian), location, age.
Then creates YAML files for victims not already in our database.

Usage:
  python3 tools/scrape_telegram_rtn.py scrape [--resume] [--limit N]
  python3 tools/scrape_telegram_rtn.py import [--dry-run]
  python3 tools/scrape_telegram_rtn.py stats
"""

import argparse
import json
import os
import re
import ssl
import sys
import time
import random
import glob
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

import yaml

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CACHE_DIR = SCRIPT_DIR / ".telegram_rtn_cache"
POSTS_FILE = CACHE_DIR / "posts.json"
PROGRESS_FILE = CACHE_DIR / "scrape_progress.json"
VICTIMS_DIR = PROJECT_ROOT / "data" / "victims"

CHANNEL_URL = "https://t.me/s/RememberTheirNames"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "fa,en;q=0.9",
}

SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

MIN_DELAY = 2.0
MAX_DELAY = 4.0

# --- Shamsi (Jalali) to Gregorian conversion ---
# Using a simple algorithm (valid for 1300-1500 SH)

SHAMSI_MONTH_DAYS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
SHAMSI_MONTH_NAMES = {
    'فروردین': 1, 'اردیبهشت': 2, 'خرداد': 3,
    'تیر': 4, 'مرداد': 5, 'شهریور': 6,
    'مهر': 7, 'آبان': 8, 'آذر': 9,
    'دی': 10, 'بهمن': 11, 'اسفند': 12,
}

# Dey 1404 starts Dec 22, 2025; Bahman 1404 starts Jan 21, 2026; etc.
# Simplified: use known epoch offsets
def shamsi_to_gregorian(year, month, day):
    """Convert Shamsi (Jalali) date to Gregorian ISO string."""
    try:
        # Use jdatetime if available
        import jdatetime
        jd = jdatetime.date(year, month, day)
        gd = jd.togregorian()
        return f"{gd.year:04d}-{gd.month:02d}-{gd.day:02d}"
    except ImportError:
        pass

    # Fallback: approximate conversion for 1404 SH
    # 1 Farvardin 1404 = March 21, 2025
    # Calculate days from 1 Farvardin 1404
    if year != 1404:
        # For other years, rough approximation
        diff_years = year - 1404
        base_year = 2025 + diff_years
        return _approx_shamsi_greg(base_year, month, day)

    return _approx_shamsi_greg(2025, month, day)


def _approx_shamsi_greg(greg_base_year, month, day):
    """Approximate Shamsi→Gregorian for a given base year."""
    from datetime import date as dt_date, timedelta

    # 1 Farvardin ≈ March 21
    farvardin_1 = dt_date(greg_base_year, 3, 21)

    # Days from 1 Farvardin to target date
    days = 0
    for m in range(1, month):
        days += SHAMSI_MONTH_DAYS[m - 1]
    days += day - 1

    target = farvardin_1 + timedelta(days=days)
    return target.isoformat()


# --- Farsi number conversion ---
FARSI_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

def farsi_to_int(text):
    """Convert Farsi numerals to integer."""
    result = ''
    for ch in text:
        idx = FARSI_DIGITS.find(ch)
        if idx >= 0:
            result += str(idx)
        elif ch.isdigit():
            result += ch
    return int(result) if result else None


def normalize_farsi_num(text):
    """Replace Farsi digits with Latin digits in text."""
    for i, ch in enumerate(FARSI_DIGITS):
        text = text.replace(ch, str(i))
    return text


# --- HTML Parsing ---

def fetch(url, retries=3):
    """Fetch URL with retries."""
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


def parse_posts(html):
    """Parse Telegram web preview HTML into structured posts."""
    posts = []

    # Split by message blocks
    # Telegram uses <div class="tgme_widget_message_wrap ...">
    blocks = re.split(r'<div class="tgme_widget_message_wrap[^"]*"', html)

    for block in blocks[1:]:
        # Extract post ID from data-post attribute
        post_id_m = re.search(r'data-post="RememberTheirNames/(\d+)"', block)
        if not post_id_m:
            continue
        post_id = int(post_id_m.group(1))

        # Extract text content
        text_m = re.search(
            r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',
            block, re.DOTALL
        )
        if not text_m:
            continue

        raw_html = text_m.group(1)
        # Strip HTML tags, keep line breaks
        text = re.sub(r'<br\s*/?>', '\n', raw_html)
        text = re.sub(r'<[^>]+>', '', text)
        text = text.strip()

        if not text:
            continue

        # Extract image URL if present
        img_m = re.search(r'image:url\(\'(https://[^\']+)\'\)', block)
        img_url = img_m.group(1) if img_m else None

        # Extract date from the post
        date_m = re.search(r'<time[^>]+datetime="([^"]+)"', block)
        post_datetime = date_m.group(1) if date_m else None

        posts.append({
            'post_id': post_id,
            'text': text,
            'image_url': img_url,
            'datetime': post_datetime,
        })

    return posts


def extract_before_id(html):
    """Extract the 'before' parameter for next page from HTML."""
    # Look for the "load more" link
    m = re.search(r'before=(\d+)', html)
    if m:
        return int(m.group(1))
    return None


def parse_victim_from_post(post):
    """Parse a structured victim post into fields."""
    text = post['text']
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    if len(lines) < 2:
        return None

    # Try to extract post number (e.g., "۲۵۴۳. حمیدرضا..." or "#2622")
    number = None
    name_line_idx = 0
    first_line = normalize_farsi_num(lines[0])
    # Pattern: "2543. Name" or "#2543 Name" or just "2543"
    num_m = re.match(r'#?(\d+)[.\s)\-–—]+', first_line)
    if num_m:
        number = int(num_m.group(1))
        name_line_idx = 0  # Name is on the same line after the number
    else:
        # Standalone number on its own line
        num_m = re.match(r'^#?(\d+)\s*$', first_line)
        if num_m:
            number = int(num_m.group(1))
            name_line_idx = 1

    if number is None:
        return None  # Not a victim post

    # Extract name (Farsi)
    name_farsi = None
    if name_line_idx < len(lines):
        name_candidate = lines[name_line_idx]
        # Remove the number prefix if inline (e.g., "۲۵۴۳. حمیدرضا ...")
        name_candidate = re.sub(r'^[#۰-۹\d]+[.\s)\-–—]*\s*', '', name_candidate).strip()
        # Extract age if embedded in name line (e.g., "محمدرضا خیبری ۱۸ساله")
        age_in_name = re.search(r'[۰-۹\d]{1,3}\s*ساله', name_candidate)
        if age_in_name:
            age_val = farsi_to_int(age_in_name.group(0))
            if age_val and 1 <= age_val <= 120:
                age = age_val
            name_candidate = name_candidate[:age_in_name.start()].strip()
        # Must contain Farsi characters
        if re.search(r'[\u0600-\u06FF]', name_candidate):
            name_farsi = name_candidate

    if not name_farsi:
        return None

    # Extract date (Shamsi) — look for patterns like "۱۸ دی ۱۴۰۴"
    shamsi_date = None
    gregorian_date = None
    location = None
    age = None

    for line in lines[name_line_idx + 1:]:
        # Skip channel handle
        if '@RememberTheirNames' in line or '@remembertheirnames' in line.lower():
            continue

        norm_line = normalize_farsi_num(line)

        # Date pattern: "day month_name year [location...]"
        # The location is often on the SAME line after the year
        date_m = re.search(r'(\d{1,2})\s+(\S+)\s+(\d{4})', norm_line)
        if date_m and not shamsi_date:
            day_str, month_name_norm, year_str = date_m.groups()
            # Check if month_name is a Shamsi month (check original Farsi line)
            for farsi_month, month_num in SHAMSI_MONTH_NAMES.items():
                if farsi_month in line:
                    try:
                        shamsi_date = {
                            'year': int(year_str),
                            'month': month_num,
                            'day': int(day_str),
                        }
                        gregorian_date = shamsi_to_gregorian(
                            int(year_str), month_num, int(day_str)
                        )
                    except:
                        pass

                    # Extract location from the remainder of this line
                    # Pattern: "18 دی 1404 مشهد" → location = "مشهد"
                    loc_m = re.search(
                        r'\d{1,2}\s+' + re.escape(farsi_month) + r'\s+[۰-۹\d]{4}\s+(.*)',
                        line
                    )
                    if loc_m:
                        loc_text = loc_m.group(1).strip()
                        if loc_text and re.search(r'[\u0600-\u06FF]', loc_text):
                            location = loc_text
                    break
            continue

        # Age pattern: "سن: ۱۷" or "۱۷ ساله" or just a number with ساله
        age_m = re.search(r'(?:سن\s*[:\s]\s*|^)(\d{1,3})\s*(?:ساله|سال)?', norm_line)
        if age_m and not age:
            try:
                a = int(age_m.group(1))
                if 1 <= a <= 120:
                    age = a
            except:
                pass
            # If this line was just age, skip it for location
            if re.match(r'^\s*(?:سن\s*[:\s]\s*)?\d{1,3}\s*(?:ساله|سال)?\s*$', norm_line):
                continue

        # Location: any remaining line with Farsi text that's not a date or age
        if not location and re.search(r'[\u0600-\u06FF]', line):
            location = line.strip()

    # Clean up location: remove any leftover date fragments
    if location:
        for month_name in SHAMSI_MONTH_NAMES:
            # Remove patterns like "دی ۱۴۰۴ " from location
            location = re.sub(
                r'[۰-۹\d]*\s*' + re.escape(month_name) + r'\s*[۰-۹\d]*\s*',
                '', location
            ).strip()
        # Remove standalone year fragments
        location = re.sub(r'^[۰-۹\d]{4}\s*', '', location).strip()
        if not location or not re.search(r'[\u0600-\u06FF]', location):
            location = None

    return {
        'post_id': post['post_id'],
        'number': number,
        'name_farsi': name_farsi,
        'shamsi_date': shamsi_date,
        'gregorian_date': gregorian_date,
        'location': location,
        'age': age,
        'image_url': post.get('image_url'),
        'post_datetime': post.get('datetime'),
    }


# --- Province mapping (Farsi city → English province) ---
FARSI_PROVINCE_MAP = {
    'تهران': 'Tehran', 'کرج': 'Alborz', 'اصفهان': 'Isfahan',
    'مشهد': 'Razavi Khorasan', 'شیراز': 'Fars', 'تبریز': 'East Azerbaijan',
    'اهواز': 'Khuzestan', 'کرمانشاه': 'Kermanshah', 'رشت': 'Gilan',
    'ارومیه': 'West Azerbaijan', 'زاهدان': 'Sistan-Baluchestan',
    'همدان': 'Hamadan', 'کرمان': 'Kerman', 'اراک': 'Markazi',
    'یزد': 'Yazd', 'اردبیل': 'Ardabil', 'بندرعباس': 'Hormozgan',
    'زنجان': 'Zanjan', 'سنندج': 'Kurdistan', 'قزوین': 'Qazvin',
    'خرم‌آباد': 'Lorestan', 'خرم آباد': 'Lorestan',
    'گرگان': 'Golestan', 'ساری': 'Mazandaran', 'بجنورد': 'North Khorasan',
    'بیرجند': 'South Khorasan', 'بوشهر': 'Bushehr', 'سمنان': 'Semnan',
    'ایلام': 'Ilam', 'یاسوج': 'Kohgiluyeh-Boyer-Ahmad',
    'شهرکرد': 'Chaharmahal-Bakhtiari', 'قم': 'Qom',
    'بابل': 'Mazandaran', 'آمل': 'Mazandaran',
    'نیشابور': 'Razavi Khorasan', 'نيشابور': 'Razavi Khorasan',
    'قوچان': 'Razavi Khorasan', 'سبزوار': 'Razavi Khorasan',
    'رفسنجان': 'Kerman', 'سیرجان': 'Kerman', 'جیرفت': 'Kerman',
    'بم': 'Kerman', 'دزفول': 'Khuzestan', 'ماهشهر': 'Khuzestan',
    'شهرری': 'Tehran', 'شهر ری': 'Tehran', 'ری': 'Tehran',
    'پاکدشت': 'Tehran', 'ملارد': 'Tehran', 'اسلامشهر': 'Tehran',
    'شهریار': 'Tehran', 'ورامین': 'Tehran', 'رباط‌کریم': 'Tehran',
    'شاهرود': 'Semnan', 'دامغان': 'Semnan', 'گرمسار': 'Semnan',
    'بانه': 'Kurdistan', 'مهاباد': 'West Azerbaijan',
    'بوکان': 'West Azerbaijan', 'پیرانشهر': 'West Azerbaijan',
    'سقز': 'Kurdistan', 'مریوان': 'Kurdistan', 'جوانرود': 'Kermanshah',
    'ایذه': 'Khuzestan', 'بهبهان': 'Khuzestan',
    'نجف‌آباد': 'Isfahan', 'شاهین‌شهر': 'Isfahan',
    'فولادشهر': 'Isfahan', 'شهرضا': 'Isfahan',
    'لاهیجان': 'Gilan', 'انزلی': 'Gilan', 'بندر انزلی': 'Gilan',
    'آبادان': 'Khuzestan', 'خرمشهر': 'Khuzestan',
}


def determine_province_farsi(location):
    """Determine province from Farsi location string."""
    if not location:
        return None
    for city, prov in FARSI_PROVINCE_MAP.items():
        if city in location:
            return prov
    return None


# --- Transliteration (basic Farsi → Latin for slug) ---

def transliterate_farsi(text):
    """Basic Farsi to Latin transliteration for slug generation."""
    mapping = {
        'ا': 'a', 'آ': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's',
        'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z',
        'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
        'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
        'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n',
        'و': 'v', 'ه': 'h', 'ی': 'i', 'ي': 'i', 'ئ': 'i', 'ة': 'h',
        'أ': 'a', 'إ': 'e', 'ؤ': 'o',
        '\u200c': '-',  # zero-width non-joiner → hyphen
    }

    result = ''
    for ch in text:
        if ch in mapping:
            result += mapping[ch]
        elif ch == ' ':
            result += ' '
        elif ch.isalnum():
            result += ch.lower()
    return result.strip()


def generate_slug_farsi(name_farsi):
    """Generate URL slug from Farsi name."""
    latin = transliterate_farsi(name_farsi)
    parts = latin.split()
    if len(parts) >= 2:
        # lastname-firstname format
        ordered = [parts[-1]] + parts[:-1]
    else:
        ordered = parts

    slug = '-'.join(ordered)
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug if slug else None


# ============================================================
# Phase 1: Scrape
# ============================================================

def cmd_scrape(args):
    """Scrape all posts from the Telegram channel web preview."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing posts
    all_posts = []
    seen_ids = set()
    if args.resume and POSTS_FILE.exists():
        with open(POSTS_FILE) as f:
            all_posts = json.load(f)
        seen_ids = {p['post_id'] for p in all_posts}
        print(f"Resuming with {len(all_posts)} existing posts")

    # Load progress
    before_id = None
    if args.resume and PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            progress = json.load(f)
        before_id = progress.get('last_before_id')
        print(f"Resuming from before={before_id}")

    pages_fetched = 0
    new_posts = 0
    consecutive_empty = 0

    while True:
        if args.limit and pages_fetched >= args.limit:
            print(f"Reached page limit ({args.limit})")
            break

        url = CHANNEL_URL
        if before_id:
            url += f"?before={before_id}"

        html = fetch(url)
        if not html:
            print("Failed to fetch page, stopping")
            break

        posts = parse_posts(html)
        pages_fetched += 1

        if not posts:
            consecutive_empty += 1
            if consecutive_empty >= 3:
                print("3 consecutive empty pages, assuming end of channel")
                break
            time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
            continue

        consecutive_empty = 0

        page_new = 0
        for post in posts:
            if post['post_id'] not in seen_ids:
                all_posts.append(post)
                seen_ids.add(post['post_id'])
                page_new += 1
                new_posts += 1

        # Find the lowest post_id on this page for the next "before" param
        min_id = min(p['post_id'] for p in posts)
        if min_id <= 1:
            print("Reached the beginning of the channel")
            break

        before_id = min_id

        # Save progress
        with open(PROGRESS_FILE, 'w') as f:
            json.dump({'last_before_id': before_id, 'pages_fetched': pages_fetched}, f)

        if pages_fetched % 5 == 0:
            # Sort and save
            all_posts.sort(key=lambda p: p['post_id'])
            with open(POSTS_FILE, 'w') as f:
                json.dump(all_posts, f, ensure_ascii=False, indent=2)
            print(f"  Page {pages_fetched}: {len(all_posts)} total posts, "
                  f"{page_new} new this page, before={before_id}")

        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    # Final save
    all_posts.sort(key=lambda p: p['post_id'])
    with open(POSTS_FILE, 'w') as f:
        json.dump(all_posts, f, ensure_ascii=False, indent=2)

    print(f"\nDone: {pages_fetched} pages fetched, {new_posts} new posts")
    print(f"Total posts: {len(all_posts)}")
    print(f"Saved to {POSTS_FILE}")


# ============================================================
# Phase 2: Import — parse posts and create YAML files
# ============================================================

def cmd_import(args):
    """Parse scraped posts and create YAML files for new victims."""
    if not POSTS_FILE.exists():
        print(f"Error: {POSTS_FILE} not found. Run 'scrape' first.")
        sys.exit(1)

    with open(POSTS_FILE) as f:
        posts = json.load(f)

    print(f"Loaded {len(posts)} posts")

    # Parse posts into victim records
    victims = []
    skipped_parse = 0
    for post in posts:
        victim = parse_victim_from_post(post)
        if victim:
            victims.append(victim)
        else:
            skipped_parse += 1

    print(f"Parsed: {len(victims)} victims, {skipped_parse} non-victim posts")

    # Load existing victim names for dedup
    existing_slugs = set()
    existing_farsi_names = set()
    for yf in VICTIMS_DIR.rglob("*.yaml"):
        if yf.name == "_template.yaml":
            continue
        existing_slugs.add(yf.stem)
        try:
            with open(yf) as f:
                content = f.read()
            # Quick extraction of name_farsi
            m = re.search(r'name_farsi:\s*"([^"]+)"', content)
            if m:
                existing_farsi_names.add(m.group(1).strip())
        except:
            pass

    print(f"Existing: {len(existing_slugs)} slugs, {len(existing_farsi_names)} Farsi names")

    created = 0
    skipped_dup = 0
    skipped_no_date = 0

    for victim in victims:
        # Skip if Farsi name already exists
        if victim['name_farsi'] in existing_farsi_names:
            skipped_dup += 1
            continue

        # Generate slug
        slug = generate_slug_farsi(victim['name_farsi'])
        if not slug:
            continue

        # Add year to slug for uniqueness
        greg_date = victim.get('gregorian_date')
        if greg_date:
            year = int(greg_date[:4])
        else:
            skipped_no_date += 1
            continue  # Skip entries without date

        year_dir = str(year)

        # Ensure unique slug
        base_slug = slug
        suffix = 2
        while slug in existing_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        existing_slugs.add(slug)
        existing_farsi_names.add(victim['name_farsi'])

        # Determine province
        province = determine_province_farsi(victim.get('location'))

        # Build YAML
        lines = []
        lines.append(f'id: {slug}')
        lines.append(f'name_latin: null  # needs transliteration')
        lines.append(f'name_farsi: "{victim["name_farsi"]}"')
        lines.append('date_of_birth: null')
        lines.append('place_of_birth: null')
        lines.append('gender: null')
        lines.append('ethnicity: null')
        lines.append('photo: null')
        lines.append('')
        lines.append('# --- DEATH ---')
        lines.append(f'date_of_death: {greg_date}')

        if victim.get('age'):
            lines.append(f'age_at_death: {victim["age"]}')
        else:
            lines.append('age_at_death: null')

        if victim.get('location'):
            loc = victim['location'].replace('"', '\\"')
            lines.append(f'place_of_death: "{loc}"')
        else:
            lines.append('place_of_death: null')

        if province:
            lines.append(f'province: "{province}"')

        lines.append('cause_of_death: null')
        lines.append('circumstances: null')
        lines.append(f'event_context: "2025-2026 Iranian nationwide protests"')
        lines.append('responsible_forces: null')
        lines.append('')
        lines.append('# --- VERIFICATION ---')
        lines.append('status: "unverified"')
        lines.append('sources:')
        lines.append(f'  - url: "https://t.me/RememberTheirNames/{victim["post_id"]}"')
        lines.append(f'    name: "RememberTheirNames Telegram — #{victim["number"]}"')
        lines.append('    date: null')
        lines.append('    type: community_database')
        lines.append(f'last_updated: {datetime.now().strftime("%Y-%m-%d")}')
        lines.append('updated_by: "telegram-rtn-import"')
        lines.append('')

        yaml_content = '\n'.join(lines)

        output_dir = VICTIMS_DIR / year_dir
        yaml_file = output_dir / f"{slug}.yaml"

        if args.dry_run:
            if created < 10:
                print(f"  DRY: {year_dir}/{slug}.yaml — {victim['name_farsi']} — {greg_date}")
        else:
            output_dir.mkdir(parents=True, exist_ok=True)
            yaml_file.write_text(yaml_content, encoding='utf-8')

        created += 1

    prefix = "DRY RUN — " if args.dry_run else ""
    print(f"\n{prefix}Import summary:")
    print(f"  Created: {created} YAML files")
    print(f"  Skipped (duplicate name): {skipped_dup}")
    print(f"  Skipped (no date): {skipped_no_date}")
    print(f"  Skipped (parse fail): {skipped_parse}")


# ============================================================
# Phase 3: Stats
# ============================================================

def cmd_stats(args):
    """Show statistics about scraped data."""
    if not POSTS_FILE.exists():
        print(f"No data yet. Run 'scrape' first.")
        return

    with open(POSTS_FILE) as f:
        posts = json.load(f)

    print(f"Total posts: {len(posts)}")

    victims = []
    for post in posts:
        v = parse_victim_from_post(post)
        if v:
            victims.append(v)

    print(f"Parsed victims: {len(victims)}")

    # Date distribution
    dates = {}
    for v in victims:
        if v.get('gregorian_date'):
            dates[v['gregorian_date']] = dates.get(v['gregorian_date'], 0) + 1

    print(f"\nDeaths by date (top 10):")
    for d, c in sorted(dates.items(), key=lambda x: -x[1])[:10]:
        print(f"  {d}: {c}")

    # Location distribution
    locs = {}
    for v in victims:
        loc = v.get('location', 'Unknown')
        if loc:
            locs[loc] = locs.get(loc, 0) + 1

    print(f"\nTop locations:")
    for l, c in sorted(locs.items(), key=lambda x: -x[1])[:10]:
        print(f"  {l}: {c}")

    # Age stats
    ages = [v['age'] for v in victims if v.get('age')]
    if ages:
        print(f"\nAge: min={min(ages)}, max={max(ages)}, avg={sum(ages)/len(ages):.1f}, "
              f"known={len(ages)}/{len(victims)}")


# ============================================================
# Main
# ============================================================

def main():
    p = argparse.ArgumentParser(description="Scrape RememberTheirNames Telegram channel")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scrape", help="Scrape posts from web preview")
    s.add_argument("--resume", action="store_true", help="Resume from last progress")
    s.add_argument("--limit", type=int, help="Max pages to fetch")

    i = sub.add_parser("import", help="Import scraped posts as YAML")
    i.add_argument("--dry-run", action="store_true", help="Preview without writing")

    sub.add_parser("stats", help="Show statistics")

    args = p.parse_args()

    cmds = {
        "scrape": cmd_scrape,
        "import": cmd_import,
        "stats": cmd_stats,
    }
    cmds[args.cmd](args)


if __name__ == "__main__":
    main()
