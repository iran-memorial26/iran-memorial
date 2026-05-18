#!/usr/bin/env python3
"""
Parse Wikipedia "Deaths during the Mahsa Amini protests" wikitext
into individual YAML victim files for the iran-memorial project.

Usage:
    python3 tools/parse_wikipedia_wlf.py

Input: Fetches wikitext via Wikipedia API (or reads from cached file)
Output: YAML files in data/victims/2022/
"""

import json
import os
import re
import sys
import uuid
from datetime import date
from urllib.request import Request, urlopen

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "victims", "2022")
CACHE_FILE = os.path.join(SCRIPT_DIR, ".wiki_cache.txt")

# Wikipedia API URL
WIKI_API = (
    "https://en.wikipedia.org/w/api.php?"
    "action=parse&page=Deaths_during_the_Mahsa_Amini_protests"
    "&prop=wikitext&format=json"
)


def fetch_wikitext():
    """Fetch wikitext from Wikipedia API or cache."""
    if os.path.exists(CACHE_FILE):
        print(f"Using cached wikitext from {CACHE_FILE}")
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return f.read()

    print("Fetching wikitext from Wikipedia API...")
    req = Request(WIKI_API, headers={"User-Agent": "iran-memorial-data-collector/1.0"})
    with urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    text = data["parse"]["wikitext"]["*"]

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Cached wikitext to {CACHE_FILE}")
    return text


def clean_wiki_markup(text):
    """Remove wiki markup from text, keeping plain content."""
    if not text:
        return ""
    # Remove wiki links: [[Target|Display]] -> Display, [[Target]] -> Target
    text = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', text)
    # Remove ref tags and their content
    text = re.sub(r'<ref[^>]*>.*?</ref>', '', text, flags=re.DOTALL)
    text = re.sub(r'<ref[^>]*/>', '', text)
    # Remove HTML tags
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = re.sub(r'<[^>]+>', '', text)
    # Remove template markup
    text = re.sub(r'\{\{[^}]*\}\}', '', text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def normalize_slug(name, birth_year=None):
    """Create a URL-safe slug from a name."""
    # Take the first name variant (before any /)
    name = name.split("/")[0].strip()
    # Remove parenthetical info
    name = re.sub(r'\([^)]*\)', '', name).strip()
    # Remove wiki links
    name = clean_wiki_markup(name)

    # Transliterate common characters
    slug = name.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')

    # Try to put lastname first
    parts = slug.split('-')
    if len(parts) >= 2:
        # Move last part to front: "mahsa-amini" -> "amini-mahsa"
        slug = parts[-1] + '-' + '-'.join(parts[:-1])

    if birth_year:
        slug += f"-{birth_year}"

    return slug


def estimate_birth_year(age, death_date):
    """Estimate birth year from age at death."""
    if not age or not death_date:
        return None
    try:
        # Handle age ranges like "16-18" or "16/17"
        age_str = str(age).replace("~", "").strip()
        if "/" in age_str:
            age_val = int(age_str.split("/")[0])
        elif "-" in age_str:
            age_val = int(age_str.split("-")[0])
        else:
            age_val = int(age_str)
        year = int(death_date.split("-")[0])
        return year - age_val
    except (ValueError, IndexError):
        return None


def parse_age(age_str):
    """Parse age string, handling ranges and approximate values."""
    if not age_str:
        return None
    age_str = age_str.replace("~", "").strip()
    if "/" in age_str:
        return int(age_str.split("/")[0])
    if "-" in age_str:
        parts = age_str.split("-")
        try:
            return int(parts[0])  # Take lower bound
        except ValueError:
            return None
    try:
        return int(age_str)
    except ValueError:
        return None


def determine_province(location):
    """Map city to province based on known Iranian geography."""
    city_province = {
        "tehran": "Tehran",
        "shahr-e-ray": "Tehran",
        "shahr-e ray": "Tehran",
        "naziabad": "Tehran",
        "hashtgerd": "Alborz",
        "karaj": "Alborz",
        "gohardasht": "Alborz",
        "mehrshahr": "Alborz",
        "fardis": "Alborz",
        "marlik": "Alborz",
        "sanandaj": "Kurdistan",
        "saqqez": "Kurdistan",
        "divandarreh": "Kurdistan",
        "divandareh": "Kurdistan",
        "marivan": "Kurdistan",
        "kamyaran": "Kurdistan",
        "baneh": "Kurdistan",
        "mahabad": "West Azerbaijan",
        "urmia": "West Azerbaijan",
        "balo": "West Azerbaijan",
        "piranshahr": "West Azerbaijan",
        "oshnavieh": "West Azerbaijan",
        "salmas": "West Azerbaijan",
        "shahin dez": "West Azerbaijan",
        "tabriz": "East Azerbaijan",
        "ardabil": "Ardabil",
        "zahedan": "Sistan-Baluchestan",
        "shirabad": "Sistan-Baluchestan",
        "khash": "Sistan-Baluchestan",
        "chabahar": "Sistan-Baluchestan",
        "saravan": "Sistan-Baluchestan",
        "sarbaz": "Sistan-Baluchestan",
        "lashar": "Sistan-Baluchestan",
        "iranshahr": "Sistan-Baluchestan",
        "kermanshah": "Kermanshah",
        "eslamabad-e gharb": "Kermanshah",
        "islamabad-e gharb": "Kermanshah",
        "islamabad-e-gharb": "Kermanshah",
        "qasr-e shirin": "Kermanshah",
        "salas-e babajani": "Kermanshah",
        "rasht": "Gilan",
        "rezvanshahr": "Gilan",
        "rezvan shahr": "Gilan",
        "langroud": "Gilan",
        "langaroud": "Gilan",
        "lahijan": "Gilan",
        "rudsar": "Gilan",
        "talesh": "Gilan",
        "bandar-e anzali": "Gilan",
        "amol": "Mazandaran",
        "babol": "Mazandaran",
        "qaem shahr": "Mazandaran",
        "qaimshahr": "Mazandaran",
        "nowshahr": "Mazandaran",
        "chalus": "Mazandaran",
        "sari": "Mazandaran",
        "kerman": "Kerman",
        "isfahan": "Isfahan",
        "esfahan": "Isfahan",
        "fuladshahr": "Isfahan",
        "fulad shahr": "Isfahan",
        "zarrin shahr": "Isfahan",
        "ilam": "Ilam",
        "ahvaz": "Khuzestan",
        "dezful": "Khuzestan",
        "khorramshahr": "Khuzestan",
        "shushtar": "Khuzestan",
        "mahshahr": "Khuzestan",
        "izeh": "Khuzestan",
        "hamedan": "Hamedan",
        "shiraz": "Fars",
        "mashhad": "Razavi Khorasan",
        "quchan": "Razavi Khorasan",
        "zanjan": "Zanjan",
        "qazvin": "Qazvin",
        "garmsar": "Semnan",
        "arak": "Markazi",
        "borujerd": "Lorestan",
        "khorramabad": "Lorestan",
        "dehdasht": "Kohgiluyeh and Boyer-Ahmad",
        "yasouj": "Kohgiluyeh and Boyer-Ahmad",
        "asaluyeh": "Bushehr",
        "bushehr": "Bushehr",
        "bandar abbas": "Hormozgan",
        "pakdasht": "Tehran",
        "varamin": "Tehran",
        "qods": "Tehran",
        "shahr-e-qods": "Tehran",
        "qrachak": "Tehran",
        "sardasht": "West Azerbaijan",
    }
    if not location:
        return None
    loc_lower = location.lower().strip()
    # Try exact match first
    for city, province in city_province.items():
        if city in loc_lower:
            return province
    return None


def determine_cause(circumstances_raw):
    """Extract structured cause of death from circumstances."""
    if not circumstances_raw:
        return None
    c = circumstances_raw.lower()
    if "gunshot" in c or "shot" in c or "shooting" in c:
        return "Gunshot"
    if "beating" in c or "beaten" in c or "club" in c or "baton" in c:
        return "Beating"
    if "headshot" in c:
        return "Gunshot (headshot)"
    if "evin prison fire" in c or "prison fire" in c:
        return "Prison fire (Evin)"
    if "torture" in c:
        return "Torture"
    if "custody" in c:
        return "Death in custody"
    return None


def parse_table(wikitext):
    """Parse the wikitable into a list of victim dicts."""
    # Find the main table
    table_match = re.search(
        r'\{\| class="wikitable sortable static-row-numbers".*?\n(.*?)\n\|\}',
        wikitext,
        re.DOTALL,
    )
    if not table_match:
        print("ERROR: Could not find victim table in wikitext")
        sys.exit(1)

    table_content = table_match.group(1)

    # Split into rows
    rows = re.split(r'\n\|-\s*\n', table_content)

    victims = []
    current_date = None
    current_year = "2022"
    seen_slugs = {}

    for row in rows:
        row = row.strip()
        if not row or row.startswith("!"):
            continue

        # Split cells
        cells = re.split(r'\n\|', row)
        if not cells:
            continue

        # Clean up cells - first cell might start with |
        cleaned_cells = []
        for cell in cells:
            cell = cell.strip()
            if cell.startswith("|"):
                cell = cell[1:].strip()
            # Remove rowspan markers but note if present
            cell = re.sub(r'rowspan="?\d+"?\s*\|', '', cell).strip()
            cleaned_cells.append(cell)

        # Determine which cells map to which columns
        # Table: Date | Name | Age | Location | Circumstances | Ref
        # But some rows inherit date from rowspan

        # Check if first cell looks like a date
        first_cell = clean_wiki_markup(cleaned_cells[0]) if cleaned_cells else ""

        # Date patterns
        date_pattern = re.compile(
            r'^(\d{1,2}\s+(?:September|October|November|December|January|February|March)(?:\s+\d{4})?)',
            re.IGNORECASE
        )
        until_pattern = re.compile(r'^Until\s+(\d{1,2}\s+\w+)', re.IGNORECASE)
        dateless_pattern = re.compile(r'^dateless', re.IGNORECASE)

        date_match = date_pattern.match(first_cell)
        until_match = until_pattern.match(first_cell)
        dateless_match = dateless_pattern.match(first_cell)

        if date_match:
            date_str = date_match.group(1)
            if "2023" in date_str:
                current_year = "2023"
            current_date = parse_date_str(date_str, current_year)
            # Remove date cell, remaining are: Name, Age, Location, Circumstances, Ref
            cleaned_cells = cleaned_cells[1:]
        elif until_match:
            date_str = until_match.group(1)
            current_date = parse_date_str(date_str, current_year)
            cleaned_cells = cleaned_cells[1:]
        elif dateless_match:
            current_date = None
            cleaned_cells = cleaned_cells[1:]

        # Need at least name
        if len(cleaned_cells) < 1:
            continue

        name_raw = cleaned_cells[0]
        age_raw = cleaned_cells[1] if len(cleaned_cells) > 1 else ""
        location_raw = cleaned_cells[2] if len(cleaned_cells) > 2 else ""
        circumstances_raw = cleaned_cells[3] if len(cleaned_cells) > 3 else ""

        # Clean
        name = clean_wiki_markup(name_raw).strip()
        age_str = clean_wiki_markup(age_raw).strip()
        location = clean_wiki_markup(location_raw).strip()
        circumstances = clean_wiki_markup(circumstances_raw).strip()

        if not name or name.lower().startswith("date of death"):
            continue

        # Skip if name is clearly not a person
        if name.lower() in ["", "name", "people killed"]:
            continue

        age = parse_age(age_str)
        birth_year = estimate_birth_year(age_str, current_date)

        # Create slug
        base_slug = normalize_slug(name, birth_year)
        if not base_slug:
            continue

        # Handle duplicate slugs
        if base_slug in seen_slugs:
            seen_slugs[base_slug] += 1
            slug = f"{base_slug}-{seen_slugs[base_slug]}"
        else:
            seen_slugs[base_slug] = 1
            slug = base_slug

        province = determine_province(location)
        cause = determine_cause(circumstances)
        if not cause:
            cause = determine_cause(clean_wiki_markup(cleaned_cells[3]) if len(cleaned_cells) > 3 else "")

        victim = {
            "id": slug,
            "name_latin": name.split("/")[0].strip(),
            "name_raw": name,  # Keep for reference
            "date_of_death": current_date,
            "age_at_death": age,
            "birth_year_est": birth_year,
            "place_of_death": location if location else None,
            "province": province,
            "cause_of_death": cause if cause else ("Gunshot" if "gunshot" in circumstances.lower() else None),
            "circumstances": circumstances if circumstances else None,
        }
        victims.append(victim)

    return victims


def parse_date_str(date_str, default_year="2022"):
    """Parse date string like '16 September' into ISO format."""
    date_str = date_str.strip()

    month_map = {
        "january": "01", "february": "02", "march": "03",
        "april": "04", "may": "05", "june": "06",
        "july": "07", "august": "08", "september": "09",
        "october": "10", "november": "11", "december": "12",
    }

    # Check if year is included
    year_match = re.search(r'(\d{4})', date_str)
    year = year_match.group(1) if year_match else default_year

    for month_name, month_num in month_map.items():
        if month_name in date_str.lower():
            day_match = re.search(r'(\d{1,2})', date_str)
            if day_match:
                day = int(day_match.group(1))
                return f"{year}-{month_num}-{day:02d}"

    return None


def write_yaml(victim, output_dir):
    """Write a single victim YAML file."""
    slug = victim["id"]
    filepath = os.path.join(output_dir, f"{slug}.yaml")

    # Skip Mahsa Amini - she already exists
    if "amini-mahsa" in slug:
        print(f"  SKIP (exists): {slug}")
        return False

    # Build YAML content manually to match template format
    lines = []

    # Identity
    lines.append(f'id: {slug}')
    lines.append(f'name_latin: "{escape_yaml(victim["name_latin"])}"')
    lines.append('name_farsi: null')

    if victim.get("name_raw") and "/" in victim["name_raw"]:
        aliases = [a.strip() for a in victim["name_raw"].split("/")[1:]]
        aliases = [clean_wiki_markup(a) for a in aliases if a.strip()]
        if aliases:
            lines.append(f'aliases: [{", ".join(repr(a) for a in aliases)}]')

    if victim.get("birth_year_est"):
        lines.append(f'date_of_birth: null  # est. birth year: {victim["birth_year_est"]}')
    else:
        lines.append('date_of_birth: null')

    if victim.get("place_of_death"):
        place = victim["place_of_death"]
        province = victim.get("province")
        if province:
            birth_place = f"{place}, {province} Province" if province not in place else place
        else:
            birth_place = None
        lines.append(f'place_of_birth: null')
    else:
        lines.append('place_of_birth: null')

    lines.append('gender: null')
    lines.append('ethnicity: null')
    lines.append('photo: null')
    lines.append('')

    # Death
    lines.append('# --- DEATH ---')
    if victim.get("date_of_death"):
        lines.append(f'date_of_death: {victim["date_of_death"]}')
    else:
        lines.append('date_of_death: null')

    if victim.get("age_at_death"):
        lines.append(f'age_at_death: {victim["age_at_death"]}')
    else:
        lines.append('age_at_death: null')

    if victim.get("place_of_death"):
        pod = victim["place_of_death"]
        province = victim.get("province")
        if province and province not in pod:
            pod = f"{pod}, {province} Province"
        lines.append(f'place_of_death: "{escape_yaml(pod)}"')
    else:
        lines.append('place_of_death: null')

    if victim.get("province"):
        lines.append(f'province: "{victim["province"]}"')

    if victim.get("cause_of_death"):
        lines.append(f'cause_of_death: "{escape_yaml(victim["cause_of_death"])}"')
    else:
        lines.append('cause_of_death: null')

    if victim.get("circumstances") and len(victim["circumstances"]) > 5:
        lines.append(f'circumstances: >')
        # Wrap long text
        words = victim["circumstances"].split()
        current_line = "  "
        for word in words:
            if len(current_line) + len(word) + 1 > 80:
                lines.append(current_line)
                current_line = "  " + word
            else:
                current_line += " " + word if current_line.strip() else "  " + word
        if current_line.strip():
            lines.append(current_line)
    else:
        lines.append('circumstances: null')

    lines.append('event_context: "Woman, Life, Freedom movement (2022 Mahsa Amini protests)"')
    lines.append('responsible_forces: null')
    lines.append('')

    # Verification
    lines.append('# --- VERIFICATION ---')
    lines.append('status: "unverified"')
    lines.append('sources:')
    lines.append('  - url: "https://en.wikipedia.org/wiki/Deaths_during_the_Mahsa_Amini_protests"')
    lines.append('    name: "Wikipedia — Deaths during the Mahsa Amini protests"')
    lines.append('    date: null')
    lines.append('    type: encyclopedia')
    lines.append(f'last_updated: {date.today().isoformat()}')
    lines.append('updated_by: "wikipedia-parser-script"')
    lines.append('')

    content = '\n'.join(lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True


def escape_yaml(text):
    """Escape special YAML characters in strings."""
    if not text:
        return ""
    return text.replace('"', '\\"').replace('\n', ' ').strip()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    wikitext = fetch_wikitext()
    victims = parse_table(wikitext)

    print(f"\nParsed {len(victims)} victims from Wikipedia table")
    print(f"Output directory: {OUTPUT_DIR}\n")

    written = 0
    skipped = 0

    for v in victims:
        if write_yaml(v, OUTPUT_DIR):
            written += 1
            print(f"  WROTE: {v['id']} — {v['name_latin']}")
        else:
            skipped += 1

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total parsed: {len(victims)}")
    print(f"Files written: {written}")
    print(f"Skipped (existing): {skipped}")

    # Stats
    with_age = sum(1 for v in victims if v.get("age_at_death"))
    with_date = sum(1 for v in victims if v.get("date_of_death"))
    with_location = sum(1 for v in victims if v.get("place_of_death"))
    with_cause = sum(1 for v in victims if v.get("cause_of_death"))
    with_circumstances = sum(1 for v in victims if v.get("circumstances") and len(v["circumstances"]) > 5)
    with_province = sum(1 for v in victims if v.get("province"))

    print(f"\nFIELD COVERAGE:")
    print(f"  name_latin:    {len(victims)}/{len(victims)} ({100:.0f}%)")
    print(f"  date_of_death: {with_date}/{len(victims)} ({with_date/len(victims)*100:.0f}%)")
    print(f"  age_at_death:  {with_age}/{len(victims)} ({with_age/len(victims)*100:.0f}%)")
    print(f"  place_of_death:{with_location}/{len(victims)} ({with_location/len(victims)*100:.0f}%)")
    print(f"  province:      {with_province}/{len(victims)} ({with_province/len(victims)*100:.0f}%)")
    print(f"  cause_of_death:{with_cause}/{len(victims)} ({with_cause/len(victims)*100:.0f}%)")
    print(f"  circumstances: {with_circumstances}/{len(victims)} ({with_circumstances/len(victims)*100:.0f}%)")

    # Fields always empty from Wikipedia
    print(f"\nFIELDS ALWAYS EMPTY (from Wikipedia alone):")
    print(f"  name_farsi, gender, ethnicity, photo, occupation,")
    print(f"  education, family, dreams, beliefs, personality,")
    print(f"  quotes, burial, family_persecution, legal_proceedings, tributes")

    # Location breakdown
    locations = {}
    for v in victims:
        loc = v.get("place_of_death", "Unknown")
        if loc:
            # Get base city
            base = loc.split(",")[0].strip().split(" in ")[0].strip()
            locations[base] = locations.get(base, 0) + 1
    print(f"\nTOP LOCATIONS:")
    for loc, count in sorted(locations.items(), key=lambda x: -x[1])[:15]:
        print(f"  {loc}: {count}")

    # Age distribution
    ages = [v["age_at_death"] for v in victims if v.get("age_at_death")]
    if ages:
        print(f"\nAGE DISTRIBUTION:")
        print(f"  Youngest: {min(ages)}")
        print(f"  Oldest: {max(ages)}")
        print(f"  Average: {sum(ages)/len(ages):.1f}")
        children = sum(1 for a in ages if a < 18)
        print(f"  Children (<18): {children}")


if __name__ == "__main__":
    main()
