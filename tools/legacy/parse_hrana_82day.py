#!/usr/bin/env python3
"""
Parse HRANA 82-day report (pdftotext output) to extract victim data.
Compares against existing YAML files and creates missing ones.

Usage:
    python3 tools/parse_hrana_82day.py [--dry-run]

Input: /tmp/hrana_82day_text.txt (pdftotext output)
Output: YAML files in data/victims/2022/
"""

import glob
import os
import re
import sys
from datetime import date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
VICTIMS_DIR = os.path.join(PROJECT_ROOT, "data", "victims")
TEXT_FILE = "/tmp/hrana_82day_text.txt"

DRY_RUN = "--dry-run" in sys.argv

# Province mapping (same as import_iranvictims_csv.py)
CITY_PROVINCE = {
    "tehran": "Tehran", "karaj": "Alborz", "tabriz": "East Azerbaijan",
    "urmia": "West Azerbaijan", "mahabad": "West Azerbaijan",
    "piranshahr": "West Azerbaijan", "oshnavieh": "West Azerbaijan",
    "salmas": "West Azerbaijan", "bukan": "West Azerbaijan",
    "ardabil": "Ardabil",
    "isfahan": "Isfahan", "esfahan": "Isfahan", "najafabad": "Isfahan",
    "shahinshahr": "Isfahan", "fuladshahr": "Isfahan",
    "sanandaj": "Kurdistan", "saqqez": "Kurdistan", "saqez": "Kurdistan",
    "divandarreh": "Kurdistan", "divandareh": "Kurdistan",
    "marivan": "Kurdistan", "kamyaran": "Kurdistan", "baneh": "Kurdistan",
    "dehgolan": "Kurdistan", "bijar": "Kurdistan", "qorveh": "Kurdistan",
    "zahedan": "Sistan-Baluchestan", "khash": "Sistan-Baluchestan",
    "chabahar": "Sistan-Baluchestan", "saravan": "Sistan-Baluchestan",
    "sarbaz": "Sistan-Baluchestan", "iranshahr": "Sistan-Baluchestan",
    "konarak": "Sistan-Baluchestan", "rask": "Sistan-Baluchestan",
    "mashhad": "Razavi Khorasan", "quchan": "Razavi Khorasan",
    "neyshabur": "Razavi Khorasan",
    "ahvaz": "Khuzestan", "dezful": "Khuzestan", "izeh": "Khuzestan",
    "andimeshk": "Khuzestan", "behbahan": "Khuzestan",
    "mahshahr": "Khuzestan", "shushtar": "Khuzestan",
    "abadan": "Khuzestan", "khorramshahr": "Khuzestan",
    "shiraz": "Fars", "marvdasht": "Fars", "kazerun": "Fars",
    "kermanshah": "Kermanshah", "javanrud": "Kermanshah",
    "rasht": "Gilan", "lahijan": "Gilan", "langroud": "Gilan",
    "bandar anzali": "Gilan", "anzali": "Gilan", "rudsar": "Gilan",
    "amol": "Mazandaran", "babol": "Mazandaran", "sari": "Mazandaran",
    "nowshahr": "Mazandaran", "chalus": "Mazandaran",
    "qaemshahr": "Mazandaran",
    "hamedan": "Hamedan", "malayer": "Hamedan",
    "ilam": "Ilam",
    "kerman": "Kerman",
    "gorgan": "Golestan",
    "zanjan": "Zanjan",
    "qazvin": "Qazvin",
    "arak": "Markazi", "saveh": "Markazi",
    "khorramabad": "Lorestan", "borujerd": "Lorestan",
    "dehdasht": "Kohgiluyeh and Boyer-Ahmad",
    "yasouj": "Kohgiluyeh and Boyer-Ahmad",
    "bandar abbas": "Hormozgan",
    "shahrekord": "Chaharmahal and Bakhtiari",
    "bushehr": "Bushehr",
    "qom": "Qom",
    "semnan": "Semnan", "garmsar": "Semnan",
    "pakdasht": "Tehran", "varamin": "Tehran", "shahr-e ray": "Tehran",
    "naziabad": "Tehran",
    "hashtgerd": "Alborz", "fardis": "Alborz",
    "yazd": "Yazd",
}


def determine_province(location):
    if not location:
        return None
    loc_lower = location.lower().strip()
    for city, prov in CITY_PROVINCE.items():
        if city in loc_lower:
            return prov
    return None


def normalize_slug(name, birth_year=None):
    if not name:
        return None
    name = re.sub(r'\([^)]*\)', '', name).strip()
    name = name.replace('"', '').replace("'", "").strip()
    slug = name.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    if not slug:
        return None
    parts = slug.split('-')
    if len(parts) >= 2:
        slug = parts[-1] + '-' + '-'.join(parts[:-1])
    if birth_year:
        slug += f"-{birth_year}"
    return slug


def escape_yaml(text):
    if not text:
        return ""
    return text.replace('"', '\\"').replace('\n', ' ').strip()


def parse_date(date_str):
    """Parse dates like '19-Sep-2022' to ISO format."""
    if not date_str:
        return None
    months = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    }
    m = re.match(r'(\d{1,2})-(\w{3})-(\d{4})', date_str.strip())
    if m:
        day, mon, year = m.groups()
        mon_num = months.get(mon.lower())
        if mon_num:
            return f"{year}-{mon_num}-{int(day):02d}"
    return None


def parse_age(age_str):
    """Parse age string like '28 years old' or 'About 40 years old'."""
    if not age_str or 'unknown' in age_str.lower():
        return None
    m = re.search(r'(\d+)', age_str)
    return int(m.group(1)) if m else None


def estimate_birth_year(age, death_date):
    if not age or not death_date:
        return None
    try:
        year = int(death_date[:4])
        return year - age
    except (ValueError, IndexError):
        return None


def load_existing_names():
    """Load existing victim names from YAML files for dedup."""
    existing_names = set()
    existing_slugs = set()
    for filepath in glob.glob(os.path.join(VICTIMS_DIR, "*", "*.yaml")):
        basename = os.path.basename(filepath).replace(".yaml", "")
        existing_slugs.add(basename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('name_latin:'):
                        name = line.split(':', 1)[1].strip().strip('"')
                        existing_names.add(name.lower())
                        break
        except Exception:
            pass
    return existing_names, existing_slugs


def parse_victims(text):
    """Parse the structured victim entries from the HRANA text."""
    victims = []

    # Pattern for entries like:
    # 1 - Mohsen Mohammadi - Age : 28 years old - Gender: Man Place of death: Divandarreh - Date of death: 19-Sep-2022 - Cause of death: Bullet wound
    # Note: the text wraps across lines, so we need to handle multiline entries

    # First, find the section with victim entries
    start_marker = "First category"
    end_marker = "Second category"

    # Find the SECOND occurrence (first is in table of contents)
    first_idx = text.find(start_marker)
    start_idx = text.find(start_marker, first_idx + 1) if first_idx >= 0 else -1
    end_idx = text.find(end_marker, start_idx) if start_idx >= 0 else -1

    if start_idx < 0:
        print("ERROR: Could not find victim list section")
        return []

    print(f"Found victim section at position {start_idx}, ends at {end_idx}")

    section = text[start_idx:end_idx] if end_idx > 0 else text[start_idx:]

    # Remove page headers
    section = re.sub(
        r'A Comprehensive Report of the First 82 days.*?HRA\n',
        '', section
    )
    # Remove standalone page numbers
    section = re.sub(r'\n\d{1,3}\n', '\n', section)

    # Split into individual entries by the numbered pattern
    entries = re.split(r'\n\s*(\d{1,3})\s*-\s*', section)

    # entries[0] is the header, then alternating: number, content
    for i in range(1, len(entries) - 1, 2):
        entry_num = entries[i]
        entry_text = entries[i + 1].strip()

        # Join lines
        entry_text = re.sub(r'\n', ' ', entry_text)
        entry_text = re.sub(r'\s+', ' ', entry_text)

        # Parse fields
        name_match = re.match(r'^(.+?)\s*-\s*Age\s*:', entry_text)
        if not name_match:
            continue
        name = name_match.group(1).strip()

        age_match = re.search(r'Age\s*:\s*(.+?)\s*-\s*Gender', entry_text)
        age_str = age_match.group(1).strip() if age_match else None

        gender_match = re.search(r'Gender:\s*(\w+)', entry_text)
        gender = gender_match.group(1).strip().lower() if gender_match else None

        place_match = re.search(r'Place of death:\s*(.+?)\s*-\s*Date', entry_text)
        place = place_match.group(1).strip() if place_match else None

        date_match = re.search(r'Date of death:\s*(.+?)\s*-\s*Cause', entry_text)
        date_str = date_match.group(1).strip() if date_match else None

        cause_match = re.search(r'Cause\s*of\s*death:\s*(.+?)\s*-\s*Source', entry_text)
        cause = cause_match.group(1).strip() if cause_match else None

        status_match = re.search(r'Confirmation\s*status:\s*(\w+)', entry_text)
        status = status_match.group(1).strip() if status_match else None

        age = parse_age(age_str)
        death_date = parse_date(date_str)
        birth_year = estimate_birth_year(age, death_date)

        # Map gender
        if gender in ('man', 'boy'):
            gender_val = 'male'
        elif gender in ('woman', 'girl'):
            gender_val = 'female'
        else:
            gender_val = None

        victims.append({
            "entry_num": int(entry_num),
            "name": name,
            "age": age,
            "gender": gender_val,
            "place": place,
            "death_date": death_date,
            "cause": cause,
            "birth_year": birth_year,
            "confirmed": status and status.lower() == 'confirmed',
        })

    return victims


def write_yaml(victim, output_dir, seen_slugs):
    """Write a victim YAML file. Returns (success, reason)."""
    slug = normalize_slug(victim["name"], victim.get("birth_year"))
    if not slug:
        return False, "no-slug"

    if slug in seen_slugs:
        seen_slugs[slug] += 1
        slug = f"{slug}-{seen_slugs[slug]}"
    else:
        seen_slugs[slug] = 1

    filepath = os.path.join(output_dir, f"{slug}.yaml")
    if os.path.exists(filepath):
        return False, "exists"

    if DRY_RUN:
        return True, "dry-run"

    lines = []
    lines.append(f'id: {slug}')
    lines.append(f'name_latin: "{escape_yaml(victim["name"])}"')
    lines.append('name_farsi: null')

    if victim.get("birth_year"):
        lines.append(f'date_of_birth: null  # est. birth year: {victim["birth_year"]}')
    else:
        lines.append('date_of_birth: null')

    lines.append('place_of_birth: null')
    lines.append(f'gender: {victim["gender"]}' if victim.get("gender") else 'gender: null')
    lines.append('ethnicity: null')
    lines.append('photo: null')
    lines.append('')

    lines.append('# --- DEATH ---')
    lines.append(f'date_of_death: {victim["death_date"]}' if victim.get("death_date") else 'date_of_death: null')
    lines.append(f'age_at_death: {victim["age"]}' if victim.get("age") else 'age_at_death: null')

    if victim.get("place"):
        province = determine_province(victim["place"])
        lines.append(f'place_of_death: "{escape_yaml(victim["place"])}"')
        if province:
            lines.append(f'province: "{province}"')
    else:
        lines.append('place_of_death: null')

    if victim.get("cause"):
        lines.append(f'cause_of_death: "{escape_yaml(victim["cause"])}"')
    else:
        lines.append('cause_of_death: null')

    lines.append('circumstances: null')
    lines.append('event_context: "Woman, Life, Freedom movement (2022 Mahsa Amini protests)"')
    lines.append('responsible_forces: null')
    lines.append('')

    lines.append('# --- VERIFICATION ---')
    if victim.get("confirmed"):
        lines.append('status: "verified"')
    else:
        lines.append('status: "unverified"')
    lines.append('sources:')
    lines.append('  - url: "https://www.en-hrana.org/wp-content/uploads/2022/12/82-Day-WLF-Protest-in-Iran-2022-English.pdf"')
    lines.append('    name: "HRANA — 82-Day Comprehensive Report"')
    lines.append('    date: 2022-12-01')
    lines.append('    type: ngo_report')
    lines.append('  - url: "https://en.wikipedia.org/wiki/Deaths_during_the_Mahsa_Amini_protests"')
    lines.append('    name: "Wikipedia — Deaths during the Mahsa Amini protests"')
    lines.append('    date: null')
    lines.append('    type: encyclopedia')
    lines.append(f'last_updated: {date.today().isoformat()}')
    lines.append('updated_by: "hrana-82day-import"')
    lines.append('')

    os.makedirs(output_dir, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    return True, "written"


def main():
    print(f"Reading: {TEXT_FILE}")
    if DRY_RUN:
        print("*** DRY RUN MODE ***\n")

    with open(TEXT_FILE, 'r', encoding='utf-8') as f:
        text = f.read()

    victims = parse_victims(text)
    print(f"Parsed {len(victims)} victims from HRANA report")

    existing_names, existing_slugs = load_existing_names()
    print(f"Existing YAML files: {len(existing_slugs)}")

    output_dir = os.path.join(VICTIMS_DIR, "2022")
    seen_slugs = {}
    written = 0
    skipped_exists = 0
    skipped_name_match = 0
    skipped_no_slug = 0

    for v in victims:
        # Check if name already exists (fuzzy: lowercase match)
        if v["name"].lower() in existing_names:
            skipped_name_match += 1
            continue

        success, reason = write_yaml(v, output_dir, seen_slugs)
        if success:
            written += 1
            if not DRY_RUN:
                print(f"  NEW: #{v['entry_num']} {v['name']} ({v.get('place', '?')})")
        elif reason == "exists":
            skipped_exists += 1
        elif reason == "no-slug":
            skipped_no_slug += 1

    print(f"\n{'='*60}")
    print(f"HRANA IMPORT SUMMARY")
    print(f"{'='*60}")
    print(f"Parsed from report: {len(victims)}")
    print(f"New files written: {written}")
    print(f"Skipped (name already in DB): {skipped_name_match}")
    print(f"Skipped (slug exists): {skipped_exists}")
    print(f"Skipped (no slug): {skipped_no_slug}")

    # Gender stats
    males = sum(1 for v in victims if v.get("gender") == "male")
    females = sum(1 for v in victims if v.get("gender") == "female")
    print(f"\nGender from HRANA: {males} male, {females} female, {len(victims)-males-females} unknown")


if __name__ == "__main__":
    main()
