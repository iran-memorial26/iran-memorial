"""Boroumand Foundation (iranrights.org) — 26K+ victim entries."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from ..utils.provinces import extract_province
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.boroumand")

BASE_URL = "https://www.iranrights.org"
BROWSE_URL = BASE_URL + "/memorial/browse/date/{page}"
TOTAL_PAGES = 545


def parse_browse_page(html: str) -> list[dict]:
    """Extract victim entries from a browse page."""
    entries = []
    blocks = re.split(r"<div class='memorial-list clearfix'>", html)

    for block in blocks[1:]:
        photo_match = re.search(r'<img src="(/actorphotos/[^"]+)"', block)
        photo_url = photo_match.group(1) if photo_match else None

        link_match = re.search(
            r"<a href='/memorial/story/(-?\d+)/([^']+)'>([^<]+)</a>", block
        )
        if not link_match:
            continue

        victim_id = int(link_match.group(1))
        slug = link_match.group(2)
        name = link_match.group(3).strip()

        mode_match = re.search(
            r"<strong>Mode of Killing</strong>:\s*([^<]+)", block
        )
        mode = (
            mode_match.group(1).strip().rstrip(";").strip()
            if mode_match
            else None
        )

        entries.append({
            "id": victim_id,
            "slug": slug,
            "name": name,
            "photo_url": photo_url,
            "mode": mode,
        })

    return entries


def parse_detail_en(html: str) -> dict:
    """Parse English detail page fields."""
    data = {}

    h1 = re.search(r"<h1 class='page-top'>([^<]+)</h1>", html)
    if h1:
        data["name"] = h1.group(1).strip()

    photo = re.search(r'<img[^>]+src="(/actorphotos/[^"]+)"', html)
    if photo:
        data["photo_url"] = photo.group(1)

    field_map = {
        "Age": "age",
        "Religion": "religion",
        "Date of Killing": "date_of_killing",
        "Location of Killing": "location",
        "Mode of Killing": "mode_of_killing",
        "Date of Birth": "date_of_birth",
        "Place of Birth": "place_of_birth",
        "Occupation": "occupation",
    }

    for m in re.finditer(r"<em>([^<]+)</em>\s*([^<]+)", html):
        label = m.group(1).strip().rstrip(":")
        value = m.group(2).strip()
        if value and value != "---" and label in field_map:
            data[field_map[label]] = value

    narr = re.search(
        r"<h2[^>]*>About this Case</h2>\s*(.*?)(?=<h2|<footer|<div\s+id=)",
        html,
        re.DOTALL,
    )
    if narr:
        text = re.sub(r"<[^>]+>", " ", narr.group(1))
        text = re.sub(r"&\w+;", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        text = re.sub(
            r"Correct/?\s*Complete This Entry\s*[❯>]?\s*", "", text
        ).strip()
        text = re.sub(
            r"The story of .+?is not complete\..+?We appreciate your support\.?\s*",
            "",
            text,
            flags=re.DOTALL,
        ).strip()
        if len(text) > 50:
            data["narrative"] = text[:5000]

    return data


def parse_detail_fa(html: str) -> dict:
    """Parse Farsi detail page — extract Farsi name."""
    data = {}
    h1 = re.search(r"<h1 class='page-top'>([^<]+)</h1>", html)
    if h1:
        text = h1.group(1).strip()
        if re.search(r"[\u0600-\u06FF]", text):
            data["name_farsi"] = text
    return data


def parse_boroumand_date(date_str: str | None) -> datetime | None:
    """Parse date like 'December 12, 2022' or '2022-12-12'."""
    if not date_str:
        return None
    for fmt in ("%B %d, %Y", "%Y-%m-%d", "%d %B %Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None



@register
class BoroumandPlugin(SourcePlugin):
    """Abdorrahman Boroumand Center — Omid Memorial."""

    @property
    def name(self) -> str:
        return "boroumand"

    @property
    def full_name(self) -> str:
        return "Abdorrahman Boroumand Center — Omid Memorial"

    @property
    def base_url(self) -> str:
        return BASE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Browse all pages, fetch EN+FA details, yield normalized victims."""
        start_page = self.progress.get_checkpoint("browse_page", 1)

        for page in range(start_page, TOTAL_PAGES + 1):
            url = BROWSE_URL.format(page=page)
            html = await fetch_with_retry(
                self.session,
                url,
                rate_limit=(0.8, 1.2),
                cache_dir=self.cache_dir,
            )
            if not html:
                log.warning(f"Failed to fetch page {page}")
                continue

            entries = parse_browse_page(html)
            if not entries:
                log.info(f"Page {page}: no entries (end reached?)")
                break

            for entry in entries:
                source_id = f"boroumand_{entry['id']}"
                if self.progress.is_processed(source_id):
                    continue

                # Fetch EN detail
                detail_url = f"{BASE_URL}/memorial/story/{entry['id']}/{entry['slug']}"
                detail_html = await fetch_with_retry(
                    self.session,
                    detail_url,
                    rate_limit=(0.8, 1.2),
                    cache_dir=self.cache_dir,
                )
                en_data = parse_detail_en(detail_html) if detail_html else {}

                # Fetch FA detail
                fa_url = f"{BASE_URL}/fa/memorial/story/{entry['id']}/{entry['slug']}"
                fa_html = await fetch_with_retry(
                    self.session,
                    fa_url,
                    rate_limit=(0.8, 1.2),
                    cache_dir=self.cache_dir,
                )
                fa_data = parse_detail_fa(fa_html) if fa_html else {}

                photo = en_data.get("photo_url") or entry.get("photo_url")
                photo_full = f"{BASE_URL}{photo}" if photo and photo.startswith("/") else photo

                dod = parse_boroumand_date(en_data.get("date_of_killing"))
                dob = parse_boroumand_date(en_data.get("date_of_birth"))

                age = None
                if en_data.get("age"):
                    try:
                        age = int(re.search(r"\d+", en_data["age"]).group())
                    except (ValueError, AttributeError):
                        pass

                yield ExternalVictim(
                    source_id=source_id,
                    source_name=self.full_name,
                    source_url=detail_url,
                    source_type="memorial_database",
                    name_latin=en_data.get("name", entry["name"]),
                    name_farsi=fa_data.get("name_farsi"),
                    date_of_birth=dob,
                    place_of_birth=en_data.get("place_of_birth"),
                    gender=None,
                    religion=en_data.get("religion"),
                    photo_url=photo_full,
                    occupation=en_data.get("occupation"),
                    date_of_death=dod,
                    age_at_death=age,
                    place_of_death=en_data.get("location"),
                    province=extract_province(en_data.get("location")),
                    cause_of_death=en_data.get("mode_of_killing") or entry.get("mode"),
                    circumstances_en=en_data.get("narrative"),
                )

                self.progress.mark_processed(source_id)

            self.progress.set_checkpoint("browse_page", page)
            log.info(f"Page {page}/{TOTAL_PAGES}: {len(entries)} entries")

    async def fetch_detail(self, source_id: str) -> Optional[ExternalVictim]:
        """Fetch a single victim by Boroumand ID."""
        bid = source_id.replace("boroumand_", "")
        url = f"{BASE_URL}/memorial/story/{bid}/"
        html = await fetch_with_retry(
            self.session, url, rate_limit=(1.0, 2.0)
        )
        if not html:
            return None
        en_data = parse_detail_en(html)
        return ExternalVictim(
            source_id=source_id,
            source_name=self.full_name,
            source_url=url,
            source_type="memorial_database",
            name_latin=en_data.get("name"),
            circumstances_en=en_data.get("narrative"),
        )
