"""iranmonitor.org — memorial API from @RememberTheirNames Telegram channel."""

from __future__ import annotations

import json
import logging
from datetime import date
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.iranmonitor")

API_URL = "https://www.iranmonitor.org/api/memorial"
SITE_URL = "https://www.iranmonitor.org/memorial"
PAGE_SIZE = 50

# Photo URLs to skip (add hashes/URLs here if placeholder images are found)
SKIP_PHOTO_URLS: set[str] = set()


@register
class IranmonitorPlugin(SourcePlugin):
    """iranmonitor.org memorial — Telegram @RememberTheirNames photos."""

    @property
    def name(self) -> str:
        return "iranmonitor"

    @property
    def full_name(self) -> str:
        return "Iran Monitor Memorial (@RememberTheirNames)"

    @property
    def base_url(self) -> str:
        return SITE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Paginate through the JSON API and yield victims with photos."""
        # First request to get total count
        first_page = await self._fetch_page(1)
        if not first_page:
            log.error("Failed to load iranmonitor.org API")
            return

        total = first_page.get("total", 0)
        pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
        log.info(f"iranmonitor.org: {total} records across {pages} pages")

        # Process first page
        async for victim in self._process_page(first_page):
            yield victim

        # Process remaining pages
        for page in range(2, pages + 1):
            data = await self._fetch_page(page)
            if not data:
                log.warning(f"Failed to load page {page}, skipping")
                continue
            async for victim in self._process_page(data):
                yield victim

    async def _fetch_page(self, page: int) -> Optional[dict]:
        """Fetch a single API page and return parsed JSON."""
        url = f"{API_URL}?page={page}&pageSize={PAGE_SIZE}"
        text = await fetch_with_retry(
            self.session, url, rate_limit=(1.0, 2.0),
        )
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            log.error(f"Invalid JSON from page {page}")
            return None

    async def _process_page(self, data: dict) -> AsyncIterator[ExternalVictim]:
        """Process a single page of API results."""
        for record in data.get("data", []):
            photo_url = record.get("photo_url")
            if not photo_url:
                continue
            if photo_url in SKIP_PHOTO_URLS:
                continue

            record_id = record.get("id", "")
            source_id = f"iranmonitor_{record_id}"

            if self.progress.is_processed(source_id):
                continue

            name_en = (record.get("name_english") or "").strip()
            name_fa = (record.get("name_persian") or "").strip() or None
            if not name_en and not name_fa:
                continue

            # Parse date
            death_date = None
            raw_date = record.get("date_of_death")
            if raw_date:
                try:
                    death_date = date.fromisoformat(raw_date[:10])
                except (ValueError, TypeError):
                    pass

            # Parse age
            age = record.get("age")
            age_int = None
            if age is not None:
                try:
                    age_int = int(age)
                except (ValueError, TypeError):
                    pass

            # Build place of death
            city = (record.get("city_english") or "").strip()
            province = (record.get("province_english") or "").strip()
            place = city if city else province

            yield ExternalVictim(
                source_id=source_id,
                source_name="Iran Monitor Memorial",
                source_url=SITE_URL,
                source_type="community_database",
                name_latin=name_en or None,
                name_farsi=name_fa,
                photo_url=photo_url,
                date_of_death=death_date,
                age_at_death=age_int,
                place_of_death=place or None,
                province=province or None,
            )

            self.progress.mark_processed(source_id)

    async def fetch_detail(self, source_id: str) -> Optional[ExternalVictim]:
        return None
