"""Wikipedia — Deaths during the Mahsa Amini protests."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.wikipedia")

WIKI_API = (
    "https://en.wikipedia.org/w/api.php?"
    "action=parse&page=Deaths_during_the_Mahsa_Amini_protests"
    "&prop=wikitext&format=json"
)

WIKI_URL = "https://en.wikipedia.org/wiki/Deaths_during_the_Mahsa_Amini_protests"

MONTH_MAP = {
    "january": "01", "february": "02", "march": "03",
    "april": "04", "may": "05", "june": "06",
    "july": "07", "august": "08", "september": "09",
    "october": "10", "november": "11", "december": "12",
}

# Province from city
PROVINCE_MAP = {
    "tehran": "Tehran", "karaj": "Alborz", "isfahan": "Isfahan",
    "shiraz": "Fars", "mashhad": "Khorasan-e Razavi",
    "tabriz": "East Azerbaijan", "sanandaj": "Kurdistan",
    "mahabad": "West Azerbaijan", "bukan": "West Azerbaijan",
    "saqqez": "Kurdistan", "divandarreh": "Kurdistan",
    "zahedan": "Sistan va Baluchestan", "khash": "Sistan va Baluchestan",
    "ahvaz": "Khuzestan", "izeh": "Khuzestan",
    "bandar abbas": "Hormozgan", "rasht": "Gilan",
    "amol": "Mazandaran", "nowshahr": "Mazandaran",
    "kermanshah": "Kermanshah", "javanrud": "Kermanshah",
}


def clean_wiki_markup(text: str) -> str:
    """Remove wiki markup from text."""
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", text)  # [[link|text]]
    text = re.sub(r"\{\{[^}]*\}\}", "", text)  # {{templates}}
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.DOTALL)
    text = re.sub(r"<ref[^/]*/?>", "", text)
    text = re.sub(r"'''?", "", text)  # bold/italic
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_date_str(date_str: str, default_year: str = "2022") -> str | None:
    """Parse '16 September' or 'September 16, 2022' → '2022-09-16'."""
    date_str = date_str.strip()
    year_match = re.search(r"(\d{4})", date_str)
    year = year_match.group(1) if year_match else default_year

    for month_name, month_num in MONTH_MAP.items():
        if month_name in date_str.lower():
            day_match = re.search(r"(\d{1,2})", date_str)
            if day_match:
                day = int(day_match.group(1))
                return f"{year}-{month_num}-{day:02d}"
    return None


def parse_age(age_str: str) -> int | None:
    """Parse age, handling ranges like '16-18'."""
    if not age_str:
        return None
    m = re.search(r"(\d+)", age_str)
    return int(m.group(1)) if m else None


def determine_province(location: str) -> str | None:
    """Map city name to province."""
    if not location:
        return None
    loc_lower = location.lower()
    for city, prov in PROVINCE_MAP.items():
        if city in loc_lower:
            return prov
    return None


def parse_wikitext_table(wikitext: str) -> list[dict]:
    """Parse the wikitable into victim dicts."""
    table_match = re.search(
        r'\{\| class="wikitable sortable static-row-numbers".*?\n(.*?)\n\|\}',
        wikitext,
        re.DOTALL,
    )
    if not table_match:
        return []

    table_content = table_match.group(1)
    rows = re.split(r"\n\|-\s*\n", table_content)

    victims = []
    current_date = None
    current_year = "2022"

    for row in rows:
        row = row.strip()
        if not row or row.startswith("!"):
            continue

        cells = re.split(r"\n\|", row)
        cleaned = []
        for cell in cells:
            cell = cell.strip()
            if cell.startswith("|"):
                cell = cell[1:].strip()
            cell = re.sub(r'rowspan="?\d+"?\s*\|', "", cell).strip()
            cleaned.append(cell)

        first_cell = clean_wiki_markup(cleaned[0]) if cleaned else ""

        date_match = re.compile(
            r"^(\d{1,2}\s+(?:September|October|November|December|January|February|March)"
            r"(?:\s+\d{4})?)",
            re.IGNORECASE,
        ).match(first_cell)

        if date_match:
            date_str = date_match.group(1)
            if "2023" in date_str:
                current_year = "2023"
            current_date = parse_date_str(date_str, current_year)
            cleaned = cleaned[1:]
        elif re.match(r"^Until\s+", first_cell, re.IGNORECASE):
            m = re.search(r"Until\s+(\d{1,2}\s+\w+)", first_cell, re.IGNORECASE)
            if m:
                current_date = parse_date_str(m.group(1), current_year)
            cleaned = cleaned[1:]
        elif re.match(r"^dateless", first_cell, re.IGNORECASE):
            current_date = None
            cleaned = cleaned[1:]

        if len(cleaned) < 1:
            continue

        name = clean_wiki_markup(cleaned[0]).strip()
        age_str = clean_wiki_markup(cleaned[1]).strip() if len(cleaned) > 1 else ""
        location = clean_wiki_markup(cleaned[2]).strip() if len(cleaned) > 2 else ""
        circumstances = clean_wiki_markup(cleaned[3]).strip() if len(cleaned) > 3 else ""

        if not name or name.lower() in ("", "name", "people killed"):
            continue

        dod = None
        if current_date:
            try:
                dod = datetime.strptime(current_date, "%Y-%m-%d").date()
            except ValueError:
                pass

        cause = None
        circ_lower = circumstances.lower()
        if "gunshot" in circ_lower or "shot" in circ_lower:
            cause = "Gunshot"
        elif "beating" in circ_lower or "beaten" in circ_lower:
            cause = "Beating"
        elif "birdshot" in circ_lower or "pellet" in circ_lower:
            cause = "Birdshot/Pellet"

        victims.append({
            "name_latin": name.split("/")[0].strip(),
            "date_of_death": dod,
            "age_at_death": parse_age(age_str),
            "place_of_death": location or None,
            "province": determine_province(location),
            "cause_of_death": cause,
            "circumstances": circumstances or None,
        })

    return victims


@register
class WikipediaWLFPlugin(SourcePlugin):
    """Wikipedia — Deaths during the Mahsa Amini protests."""

    @property
    def name(self) -> str:
        return "wikipedia_wlf"

    @property
    def full_name(self) -> str:
        return "Wikipedia — Deaths during the Mahsa Amini protests"

    @property
    def base_url(self) -> str:
        return "https://en.wikipedia.org"

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Fetch wikitext via API, parse table, yield victims."""
        log.info("Fetching Wikipedia wikitext via API...")
        html = await fetch_with_retry(
            self.session,
            WIKI_API,
            rate_limit=(1.0, 2.0),
            cache_dir=self.cache_dir,
        )
        if not html:
            log.error("Failed to fetch Wikipedia API")
            return

        data = json.loads(html)
        wikitext = data["parse"]["wikitext"]["*"]

        victims = parse_wikitext_table(wikitext)
        log.info(f"Parsed {len(victims)} victims from Wikipedia table")

        for i, v in enumerate(victims):
            source_id = f"wikipedia_wlf_{i}_{v['name_latin']}"
            if self.progress.is_processed(source_id):
                continue

            yield ExternalVictim(
                source_id=source_id,
                source_name=self.full_name,
                source_url=WIKI_URL,
                source_type="encyclopedia",
                name_latin=v["name_latin"],
                date_of_death=v.get("date_of_death"),
                age_at_death=v.get("age_at_death"),
                place_of_death=v.get("place_of_death"),
                province=v.get("province"),
                cause_of_death=v.get("cause_of_death"),
                circumstances_en=v.get("circumstances"),
                event_context="Woman, Life, Freedom movement (2022 Mahsa Amini protests)",
            )

            self.progress.mark_processed(source_id)

    async def fetch_detail(self, source_id: str) -> Optional[ExternalVictim]:
        return None
