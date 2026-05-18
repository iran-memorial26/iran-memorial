#!/usr/bin/env python3
"""
Import iranvictims.com CSV into YAML victim files for the iran-memorial project.

Usage:
    python3 tools/import_iranvictims_csv.py [--dry-run]

Input: data/victims/iranvictims_2026.csv
Output: YAML files in data/victims/2025/ and data/victims/2026/
"""

import csv
import os
import re
import sys
from datetime import date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
CSV_PATH = os.path.join(PROJECT_ROOT, "data", "victims", "iranvictims_2026.csv")
VICTIMS_DIR = os.path.join(PROJECT_ROOT, "data", "victims")

DRY_RUN = "--dry-run" in sys.argv

# --- Province mapping ---
CITY_PROVINCE = {
    "tehran": "Tehran", "shahr-e-ray": "Tehran", "shahr-e ray": "Tehran",
    "rey": "Tehran", "pakdasht": "Tehran", "varamin": "Tehran",
    "qods": "Tehran", "shahr-e-qods": "Tehran", "qarchak": "Tehran",
    "eslamshahr": "Tehran", "shahriar": "Tehran", "robat karim": "Tehran",
    "pardis": "Tehran", "damavand": "Tehran", "firouzkooh": "Tehran",
    "lavasan": "Tehran", "kahrizak": "Tehran", "sadeghiyeh": "Tehran",
    "pishva": "Tehran", "baharestan": "Tehran", "nasimshahr": "Tehran",
    "andisheh": "Tehran", "mallard": "Tehran", "malard": "Tehran",
    "parand": "Tehran", "nazi abad": "Tehran", "naziabad": "Tehran",
    "qaleh hassan khan": "Tehran", "shahrqods": "Tehran", "shahr qods": "Tehran",
    "karaj": "Alborz", "hashtgerd": "Alborz", "gohardasht": "Alborz",
    "mehrshahr": "Alborz", "fardis": "Alborz", "marlik": "Alborz",
    "meshkindasht": "Alborz", "mohammadshahr": "Alborz", "savojbolagh": "Alborz",
    "nazarabad": "Alborz", "eshtehard": "Alborz",
    "tabriz": "East Azerbaijan", "marand": "East Azerbaijan",
    "maragheh": "East Azerbaijan", "miyaneh": "East Azerbaijan",
    "sarab": "East Azerbaijan", "ahar": "East Azerbaijan",
    "bonab": "East Azerbaijan", "shabestar": "East Azerbaijan",
    "urmia": "West Azerbaijan", "mahabad": "West Azerbaijan",
    "piranshahr": "West Azerbaijan", "oshnavieh": "West Azerbaijan",
    "salmas": "West Azerbaijan", "shahin dez": "West Azerbaijan",
    "bukan": "West Azerbaijan", "khoy": "West Azerbaijan",
    "miandoab": "West Azerbaijan", "naghadeh": "West Azerbaijan",
    "sardasht": "West Azerbaijan", "takab": "West Azerbaijan",
    "shahindej": "West Azerbaijan",
    "ardabil": "Ardabil", "parsabad": "Ardabil", "meshginshahr": "Ardabil",
    "isfahan": "Isfahan", "esfahan": "Isfahan", "najafabad": "Isfahan",
    "shahinshahr": "Isfahan", "shahin shahr": "Isfahan",
    "fuladshahr": "Isfahan", "fooladshahr": "Isfahan",
    "lenjan": "Isfahan", "zarrinshahr": "Isfahan", "zarrin shahr": "Isfahan",
    "khomeinishahr": "Isfahan", "mobarakeh": "Isfahan", "falavarjan": "Isfahan",
    "ilam": "Ilam", "ivan": "Ilam", "dehloran": "Ilam",
    "bushehr": "Bushehr", "asaluyeh": "Bushehr",
    "borazjan": "Bushehr", "kangan": "Bushehr",
    "mashhad": "Razavi Khorasan", "neyshabur": "Razavi Khorasan",
    "sabzevar": "Razavi Khorasan", "torbat-e heydarieh": "Razavi Khorasan",
    "quchan": "Razavi Khorasan", "kashmar": "Razavi Khorasan",
    "gonabad": "Razavi Khorasan", "taybad": "Razavi Khorasan",
    "chenaran": "Razavi Khorasan", "torghabeh": "Razavi Khorasan",
    "birjand": "South Khorasan", "qaen": "South Khorasan",
    "bojnurd": "North Khorasan", "shirvan": "North Khorasan",
    "esfarayen": "North Khorasan", "maneh": "North Khorasan",
    "ahvaz": "Khuzestan", "dezful": "Khuzestan",
    "khorramshahr": "Khuzestan", "abadan": "Khuzestan",
    "shushtar": "Khuzestan", "mahshahr": "Khuzestan",
    "izeh": "Khuzestan", "behbahan": "Khuzestan",
    "andimeshk": "Khuzestan", "shoosh": "Khuzestan",
    "masjed soleyman": "Khuzestan", "ramhormoz": "Khuzestan",
    "shush": "Khuzestan", "susangerd": "Khuzestan",
    "omidiyeh": "Khuzestan", "shadegan": "Khuzestan",
    "zanjan": "Zanjan", "abhar": "Zanjan", "khodabandeh": "Zanjan",
    "semnan": "Semnan", "garmsar": "Semnan", "shahroud": "Semnan",
    "damghan": "Semnan",
    "zahedan": "Sistan-Baluchestan", "shirabad": "Sistan-Baluchestan",
    "khash": "Sistan-Baluchestan", "chabahar": "Sistan-Baluchestan",
    "saravan": "Sistan-Baluchestan", "sarbaz": "Sistan-Baluchestan",
    "iranshahr": "Sistan-Baluchestan", "lashar": "Sistan-Baluchestan",
    "konarak": "Sistan-Baluchestan", "nikshahr": "Sistan-Baluchestan",
    "rask": "Sistan-Baluchestan", "dalgan": "Sistan-Baluchestan",
    "delgan": "Sistan-Baluchestan", "suran": "Sistan-Baluchestan",
    "qasr-e qand": "Sistan-Baluchestan", "mirjaveh": "Sistan-Baluchestan",
    "hirmand": "Sistan-Baluchestan", "zabul": "Sistan-Baluchestan",
    "zabol": "Sistan-Baluchestan", "sarbisheh": "Sistan-Baluchestan",
    "nimroz": "Sistan-Baluchestan", "pishin": "Sistan-Baluchestan",
    "fanuj": "Sistan-Baluchestan", "taftan": "Sistan-Baluchestan",
    "sirik": "Hormozgan",
    "shiraz": "Fars", "marvdasht": "Fars", "kazerun": "Fars",
    "jahrom": "Fars", "fasa": "Fars", "darab": "Fars",
    "neyriz": "Fars", "firouzabad": "Fars", "lamerd": "Fars",
    "larestan": "Fars", "lar": "Fars", "sepidan": "Fars",
    "qazvin": "Qazvin", "buin zahra": "Qazvin", "takestan": "Qazvin",
    "qom": "Qom",
    "sanandaj": "Kurdistan", "saqqez": "Kurdistan",
    "divandarreh": "Kurdistan", "marivan": "Kurdistan",
    "kamyaran": "Kurdistan", "baneh": "Kurdistan",
    "bijar": "Kurdistan", "qorveh": "Kurdistan", "dehgolan": "Kurdistan",
    "kerman": "Kerman", "bam": "Kerman", "rafsanjan": "Kerman",
    "jiroft": "Kerman", "sirjan": "Kerman", "zarand": "Kerman",
    "ravar": "Kerman",
    "kermanshah": "Kermanshah", "eslamabad-e gharb": "Kermanshah",
    "islamabad-e gharb": "Kermanshah", "javanrud": "Kermanshah",
    "kangavar": "Kermanshah", "harsin": "Kermanshah",
    "salas-e babajani": "Kermanshah", "qasr-e shirin": "Kermanshah",
    "sonqor": "Kermanshah", "paveh": "Kermanshah",
    "gorgan": "Golestan", "gonbad-e kavus": "Golestan",
    "gonbad": "Golestan", "azadshahr": "Golestan",
    "minoodasht": "Golestan", "aliabad": "Golestan",
    "bandar-e gaz": "Golestan", "bandar gaz": "Golestan",
    "rasht": "Gilan", "lahijan": "Gilan", "langroud": "Gilan",
    "rudsar": "Gilan", "talesh": "Gilan", "anzali": "Gilan",
    "bandar-e anzali": "Gilan", "rezvanshahr": "Gilan",
    "astaneh": "Gilan", "astara": "Gilan", "fuman": "Gilan",
    "sowme'eh sara": "Gilan", "siahkal": "Gilan", "shaft": "Gilan",
    "masal": "Gilan", "roudbar": "Gilan", "ramsar": "Gilan",
    "amol": "Mazandaran", "babol": "Mazandaran",
    "qaemshahr": "Mazandaran", "sari": "Mazandaran",
    "nowshahr": "Mazandaran", "chalus": "Mazandaran",
    "neka": "Mazandaran", "babolsar": "Mazandaran",
    "tonekabon": "Mazandaran", "mahmoudabad": "Mazandaran",
    "savadkuh": "Mazandaran", "juybar": "Mazandaran",
    "noshahr": "Mazandaran",
    "hamedan": "Hamedan", "malayer": "Hamedan",
    "nahavand": "Hamedan", "tuyserkan": "Hamedan",
    "arak": "Markazi", "saveh": "Markazi", "khomein": "Markazi",
    "delijan": "Markazi", "shazand": "Markazi",
    "khorramabad": "Lorestan", "borujerd": "Lorestan",
    "dorud": "Lorestan", "aligoudarz": "Lorestan",
    "azna": "Lorestan", "pol-e dokhtar": "Lorestan",
    "lorestan": "Lorestan",
    "dehdasht": "Kohgiluyeh and Boyer-Ahmad",
    "yasouj": "Kohgiluyeh and Boyer-Ahmad",
    "gachsaran": "Kohgiluyeh and Boyer-Ahmad",
    "noorabad mamasani": "Fars", "mamasani": "Fars",
    "golpayegan": "Isfahan", "shahreza": "Isfahan",
    "dizicheh": "Isfahan",
    "rostamabad": "Gilan", "manjil": "Gilan", "prehsar": "Gilan",
    "shahsavar": "Mazandaran", "behshahr": "Mazandaran",
    "chamestan": "Mazandaran", "zirab": "Mazandaran",
    "kuhdasht": "Lorestan", "pol dokhtar": "Lorestan",
    "mahallat": "Markazi",
    "torbat-e jam": "Razavi Khorasan",
    "hamadan": "Hamedan",
    "bandar abbas": "Hormozgan", "minab": "Hormozgan",
    "qeshm": "Hormozgan", "minab": "Hormozgan", "sirik": "Hormozgan",
    "kish": "Hormozgan", "kish island": "Hormozgan",
    "shahrekord": "Chaharmahal and Bakhtiari",
    "borujen": "Chaharmahal and Bakhtiari",
    "lordegan": "Chaharmahal and Bakhtiari",
    "yazd": "Yazd", "meybod": "Yazd", "ardakan": "Yazd",
}


def determine_province(location):
    """Map city to province."""
    if not location:
        return None
    loc_lower = location.lower().strip()
    # Try direct match on last part (e.g. "Astaneh, Gilan" -> try "Gilan" first as province)
    parts = [p.strip() for p in loc_lower.split(",")]
    for part in parts:
        clean = part.replace(" province", "").strip()
        # Check if it's a known province name
        for city, prov in CITY_PROVINCE.items():
            if prov.lower() == clean:
                return prov
    # Try each part as city
    for part in parts:
        clean = part.strip()
        for city, prov in CITY_PROVINCE.items():
            if city in clean:
                return prov
    return None


def normalize_slug(name, birth_year=None):
    """Create lastname-firstname-birthyear slug."""
    if not name:
        return None
    # Remove parenthetical info
    name = re.sub(r'\([^)]*\)', '', name).strip()
    # Remove quotes
    name = name.replace('"', '').replace("'", "").strip()

    slug = name.lower()
    # Transliterate
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')

    if not slug:
        return None

    # Move last part to front: "mahsa-amini" -> "amini-mahsa"
    parts = slug.split('-')
    if len(parts) >= 2:
        slug = parts[-1] + '-' + '-'.join(parts[:-1])

    if birth_year:
        slug += f"-{birth_year}"

    return slug


def estimate_birth_year(age_str, death_date):
    """Estimate birth year from age and death date."""
    if not age_str or not death_date:
        return None
    try:
        age = int(str(age_str).strip())
        year = int(death_date[:4])
        return year - age
    except (ValueError, IndexError):
        return None


def escape_yaml(text):
    """Escape special YAML characters."""
    if not text:
        return ""
    return text.replace('"', '\\"').replace('\n', ' ').strip()


def write_yaml(victim, output_dir, seen_slugs):
    """Write a single victim YAML file. Returns True if written."""
    slug = victim["id"]

    # Handle duplicate slugs
    if slug in seen_slugs:
        seen_slugs[slug] += 1
        slug = f"{slug}-{seen_slugs[slug]}"
    else:
        seen_slugs[slug] = 1

    victim["id"] = slug
    filepath = os.path.join(output_dir, f"{slug}.yaml")

    # Skip if file already exists
    if os.path.exists(filepath):
        return False, "exists"

    if DRY_RUN:
        return True, "dry-run"

    lines = []

    # Identity
    lines.append(f'id: {slug}')
    lines.append(f'name_latin: "{escape_yaml(victim["name_latin"])}"')
    if victim.get("name_farsi"):
        lines.append(f'name_farsi: "{victim["name_farsi"]}"')
    else:
        lines.append('name_farsi: null')

    if victim.get("birth_year_est"):
        lines.append(f'date_of_birth: null  # est. birth year: {victim["birth_year_est"]}')
    else:
        lines.append('date_of_birth: null')

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
        lines.append(f'place_of_death: "{escape_yaml(victim["place_of_death"])}"')
    else:
        lines.append('place_of_death: null')

    if victim.get("province"):
        lines.append(f'province: "{victim["province"]}"')

    if victim.get("cause_of_death"):
        lines.append(f'cause_of_death: "{escape_yaml(victim["cause_of_death"])}"')
    else:
        lines.append('cause_of_death: null')

    if victim.get("circumstances") and len(victim["circumstances"]) > 5:
        lines.append('circumstances: >')
        words = victim["circumstances"].split()
        current_line = ""
        for word in words:
            if len(current_line) + len(word) + 1 > 80:
                lines.append("  " + current_line)
                current_line = word
            else:
                current_line += " " + word if current_line else word
        if current_line:
            lines.append("  " + current_line)
    else:
        lines.append('circumstances: null')

    lines.append(f'event_context: "{victim.get("event_context", "2025-2026 Iranian nationwide protests")}"')
    lines.append('responsible_forces: null')
    lines.append('')

    # Verification
    lines.append('# --- VERIFICATION ---')
    lines.append('status: "unverified"')
    lines.append('sources:')

    # Add iranvictims.com as primary source
    lines.append(f'  - url: "https://iranvictims.com"')
    lines.append(f'    name: "iranvictims.com — Victim #{victim.get("card_id", "")}"')
    lines.append('    date: null')
    lines.append('    type: community_database')

    # Add original source URLs
    if victim.get("source_urls"):
        for url in victim["source_urls"][:3]:  # Max 3 source URLs
            url = url.strip()
            if url:
                lines.append(f'  - url: "{escape_yaml(url)}"')
                if "iranintl" in url:
                    lines.append('    name: "Iran International"')
                elif "hengaw" in url.lower():
                    lines.append('    name: "Hengaw Organization"')
                elif "haalvsh" in url.lower():
                    lines.append('    name: "Haalvsh"')
                elif "iranhrs" in url.lower():
                    lines.append('    name: "Iran Human Rights Society"')
                else:
                    lines.append('    name: "Source"')
                lines.append('    date: null')
                lines.append('    type: primary')

    lines.append(f'last_updated: {date.today().isoformat()}')
    lines.append('updated_by: "iranvictims-csv-import"')
    lines.append('')

    content = '\n'.join(lines)

    os.makedirs(output_dir, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True, "written"


def determine_cause(notes):
    """Extract cause of death from notes."""
    if not notes:
        return None
    n = notes.lower()
    if "executed" in n or "execution" in n:
        return "Judicial execution"
    if "shot" in n and ("head" in n or "headshot" in n):
        return "Gunshot (headshot)"
    if "shot" in n or "bullet" in n or "gunfire" in n or "gunshot" in n:
        return "Gunshot"
    if "beat" in n or "baton" in n or "blows" in n:
        return "Beating"
    if "torture" in n:
        return "Torture / death in custody"
    if "pellet" in n:
        return "Pellet gun injuries"
    if "tear gas" in n:
        return "Tear gas"
    if "stab" in n or "knife" in n:
        return "Stabbing"
    if "run over" in n or "vehicle" in n and "hit" in n:
        return "Vehicle attack"
    return None


def determine_event_context(death_date):
    """Determine event context from date."""
    if not death_date:
        return "2025-2026 Iranian nationwide protests"
    if death_date.startswith("2025-12"):
        return "2025-2026 Iranian nationwide protests (December 2025 uprising)"
    if death_date.startswith("2026-01"):
        return "2025-2026 Iranian nationwide protests (January 2026 uprising)"
    if death_date.startswith("2026"):
        return "2025-2026 Iranian nationwide protests"
    return "2025-2026 Iranian nationwide protests"


def load_existing_names(victims_dir):
    """Load all existing victim names for dedup."""
    import glob
    existing = set()
    for filepath in glob.glob(os.path.join(victims_dir, "*", "*.yaml")):
        basename = os.path.basename(filepath).replace(".yaml", "")
        existing.add(basename)
        # Also read name_latin from file for fuzzy matching
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('name_latin:'):
                        name = line.split(':', 1)[1].strip().strip('"')
                        existing.add(name.lower())
                        break
        except Exception:
            pass
    return existing


def main():
    print(f"Reading CSV: {CSV_PATH}")
    if DRY_RUN:
        print("*** DRY RUN MODE — no files will be written ***\n")

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Filter for killed only
    killed = [r for r in rows if r.get('Status', '').strip() == 'killed']
    print(f"Total entries: {len(rows)}")
    print(f"Killed: {len(killed)}")

    seen_slugs = {}
    written = 0
    skipped_exists = 0
    skipped_no_name = 0
    stats_by_year = {}

    for row in killed:
        name_en = row.get('English Name', '').strip()
        name_fa = row.get('Persian Name', '').strip()
        age_str = row.get('Age', '').strip()
        location = row.get('Location of Death', '').strip()
        death_date = row.get('Date of Death', '').strip()
        notes = row.get('Notes', '').strip()
        card_id = row.get('Card ID', '').strip()
        source_urls_raw = row.get('Source URLs', '').strip()

        if not name_en:
            skipped_no_name += 1
            continue

        # Parse age
        age = None
        try:
            age = int(age_str) if age_str else None
        except ValueError:
            age = None

        birth_year = estimate_birth_year(age_str, death_date)

        # Create slug
        slug = normalize_slug(name_en, birth_year)
        if not slug:
            skipped_no_name += 1
            continue

        # Determine output directory based on year
        if death_date and death_date.startswith("2025"):
            year_dir = "2025"
        else:
            year_dir = "2026"  # Default for 2026 or no-date entries

        output_dir = os.path.join(VICTIMS_DIR, year_dir)

        province = determine_province(location)
        cause = determine_cause(notes)
        event_context = determine_event_context(death_date)

        # Parse source URLs
        source_urls = [u.strip() for u in source_urls_raw.split(',') if u.strip()] if source_urls_raw else []

        victim = {
            "id": slug,
            "card_id": card_id,
            "name_latin": name_en,
            "name_farsi": name_fa if name_fa else None,
            "date_of_death": death_date if death_date else None,
            "age_at_death": age,
            "birth_year_est": birth_year,
            "place_of_death": location if location else None,
            "province": province,
            "cause_of_death": cause,
            "circumstances": notes if notes else None,
            "event_context": event_context,
            "source_urls": source_urls,
        }

        success, reason = write_yaml(victim, output_dir, seen_slugs)
        if success:
            written += 1
            stats_by_year[year_dir] = stats_by_year.get(year_dir, 0) + 1
        elif reason == "exists":
            skipped_exists += 1

    print(f"\n{'='*60}")
    print(f"IMPORT SUMMARY")
    print(f"{'='*60}")
    print(f"Total killed entries: {len(killed)}")
    print(f"Files written: {written}")
    print(f"Skipped (already exist): {skipped_exists}")
    print(f"Skipped (no name): {skipped_no_name}")
    print(f"\nBy year:")
    for year, count in sorted(stats_by_year.items()):
        print(f"  {year}: {count}")

    # Province coverage
    provinces = {}
    for row in killed:
        loc = row.get('Location of Death', '').strip()
        prov = determine_province(loc)
        if prov:
            provinces[prov] = provinces.get(prov, 0) + 1
        elif loc:
            provinces[f"UNMAPPED: {loc}"] = provinces.get(f"UNMAPPED: {loc}", 0) + 1

    print(f"\nTop provinces:")
    for prov, count in sorted(provinces.items(), key=lambda x: -x[1])[:20]:
        print(f"  {prov}: {count}")


if __name__ == "__main__":
    main()
