"""iranrevolution.online — community memorial (Supabase backend)."""

from __future__ import annotations

import json
import logging
from datetime import date
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from ..utils.provinces import extract_province
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.iranrevolution")

SITE_URL = "https://iranrevolution.online"
SUPABASE_URL = "https://umkenikezuigjqspgaub.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVta2VuaWtlenVpZ2pxc3BnYXViIiwi"
    "cm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTQ1NzQsImV4cCI6MjA4Mzk3MDU3NH0."
    "gfz_WC_0NtozHAP-CEERLKAYX-vDpH_yqOdd2s9HDgE"
)
API_URL = f"{SUPABASE_URL}/rest/v1/memorials"
PAGE_SIZE = 1000


@register
class IranrevolutionPlugin(SourcePlugin):
    """iranrevolution.online — community memorial via Supabase API."""

    @property
    def name(self) -> str:
        return "iranrevolution"

    @property
    def full_name(self) -> str:
        return "iranrevolution.online Memorial"

    @property
    def base_url(self) -> str:
        return SITE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Paginate through Supabase REST API and yield victims."""
        offset = 0

        while True:
            data = await self._fetch_page(offset)
            if data is None:
                log.error(f"Failed to fetch page at offset {offset}")
                break
            if not data:
                break

            log.info(
                f"iranrevolution.online: page at offset {offset}, "
                f"{len(data)} records"
            )

            for record in data:
                victim = self._parse_record(record)
                if victim is None:
                    continue

                if self.progress.is_processed(victim.source_id):
                    continue

                yield victim
                self.progress.mark_processed(victim.source_id)

            if len(data) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

    async def _fetch_page(self, offset: int) -> list[dict] | None:
        """Fetch a page of memorials from the Supabase REST API."""
        url = (
            f"{API_URL}?select=*"
            f"&order=date.desc"
            f"&offset={offset}"
            f"&limit={PAGE_SIZE}"
        )
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        }
        text = await fetch_with_retry(
            self.session,
            url,
            rate_limit=(0.5, 1.0),
            extra_headers=headers,
        )
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            log.error(f"Invalid JSON at offset {offset}")
            return None

    def _parse_record(self, record: dict) -> ExternalVictim | None:
        """Parse a single Supabase memorial record into ExternalVictim."""
        record_id = record.get("id", "")
        if not record_id:
            return None

        name_en = (record.get("name") or "").strip()
        name_fa = (record.get("name_fa") or "").strip() or None
        if not name_en and not name_fa:
            return None

        # Parse date
        death_date = None
        raw_date = record.get("date")
        if raw_date:
            try:
                death_date = date.fromisoformat(raw_date[:10])
            except (ValueError, TypeError):
                pass

        # City/province
        city = (record.get("city") or "").strip()
        province = extract_province(city)

        # Bio texts
        bio_en = (record.get("bio") or "").strip() or None
        bio_fa = (record.get("bio_fa") or "").strip() or None

        # Photo from media object
        media = record.get("media") or {}
        photo_url = (media.get("photo") or "").strip() or None

        # Source links
        source_links = record.get("source_links") or []

        # Build source URL — link to the specific entry if possible
        source_url = SITE_URL

        return ExternalVictim(
            source_id=f"iranrevolution_{record_id}",
            source_name="iranrevolution.online Memorial",
            source_url=source_url,
            source_type="community_database",
            name_latin=name_en or None,
            name_farsi=name_fa,
            photo_url=photo_url,
            date_of_death=death_date,
            place_of_death=city or None,
            province=province,
            circumstances_en=bio_en,
            circumstances_fa=bio_fa,
        )

    async def fetch_detail(self, source_id: str) -> Optional[ExternalVictim]:
        return None
