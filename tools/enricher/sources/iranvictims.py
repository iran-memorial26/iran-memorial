"""iranvictims.com — community victim database with CSV export."""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import date
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from ..utils.provinces import extract_province
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.iranvictims")

SITE_URL = "https://iranvictims.com"
CSV_URL = f"{SITE_URL}/victims.csv"


def parse_csv_rows(text: str) -> list[dict]:
    """Parse the iranvictims CSV into a list of dicts."""
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        card_id = (row.get("Card ID") or "").strip()
        if not card_id:
            continue
        rows.append({
            "card_id": card_id,
            "name_en": (row.get("English Name") or "").strip(),
            "name_fa": (row.get("Persian Name") or "").strip() or None,
            "age": (row.get("Age") or "").strip() or None,
            "location": (row.get("Location of Death") or "").strip() or None,
            "date": (row.get("Date of Death") or "").strip() or None,
            "status": (row.get("Status") or "").strip().lower(),
            "source_urls": (row.get("Source URLs") or "").strip() or None,
            "notes": (row.get("Notes") or "").strip() or None,
        })
    return rows


def parse_age(age_str: str | None) -> int | None:
    """Parse age string to int."""
    if not age_str:
        return None
    match = re.search(r"\d+", age_str)
    if match:
        try:
            return int(match.group())
        except ValueError:
            pass
    return None


def parse_date(date_str: str | None) -> date | None:
    """Parse ISO date string (YYYY-MM-DD)."""
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str[:10])
    except (ValueError, TypeError):
        return None


def parse_source_urls(urls_str: str | None) -> list[str]:
    """Split comma-separated source URLs."""
    if not urls_str:
        return []
    return [
        u.strip()
        for u in urls_str.split(",")
        if u.strip() and u.strip().startswith("http")
    ]


@register
class IranvictimsPlugin(SourcePlugin):
    """iranvictims.com community database — CSV-based enrichment."""

    @property
    def name(self) -> str:
        return "iranvictims"

    @property
    def full_name(self) -> str:
        return "iranvictims.com"

    @property
    def base_url(self) -> str:
        return SITE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Download CSV and yield all victim entries."""
        log.info("Downloading iranvictims.com CSV...")
        csv_text = await fetch_with_retry(
            self.session,
            CSV_URL,
            rate_limit=(2.0, 4.0),
            cache_dir=self.cache_dir,
        )
        if not csv_text:
            log.error("Failed to download iranvictims CSV")
            return

        rows = parse_csv_rows(csv_text)
        log.info(f"Parsed {len(rows)} entries from CSV")

        for row in rows:
            source_id = f"iranvictims_{row['card_id']}"
            if self.progress.is_processed(source_id):
                continue

            # Only process killed victims for the memorial
            if row["status"] not in ("killed", ""):
                self.progress.mark_processed(source_id)
                continue

            name_en = row["name_en"]
            if not name_en:
                continue

            yield ExternalVictim(
                source_id=source_id,
                source_name=f"iranvictims.com — Victim #{row['card_id']}",
                source_url=SITE_URL,
                source_type="community_database",
                name_latin=name_en,
                name_farsi=row.get("name_fa"),
                date_of_death=parse_date(row["date"]),
                age_at_death=parse_age(row["age"]),
                place_of_death=row["location"],
                province=extract_province(row["location"]),
                circumstances_en=row["notes"],
                # Store source URLs in event_context temporarily for the pipeline
                # The pipeline handler will add them as proper sources
            )

            self.progress.mark_processed(source_id)

    async def fetch_detail(self, source_id: str) -> Optional[ExternalVictim]:
        return None  # iranvictims has no detail pages
