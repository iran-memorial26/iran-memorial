"""Telegram @VahidOnline — citizen journalism channel with victim documentation."""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from ..utils.jalali import parse_jalali_date
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.telegram_vahid")

BASE_URL = "https://t.me/s/VahidOnline"

# Keywords that indicate victim documentation (not general news)
VICTIM_KEYWORDS = [
    "کشته",  # killed
    "کشته‌شده",  # was killed
    "پیکر",  # body
    "بی‌جان",  # lifeless
    "زخمی",  # wounded
    "شلیک",  # gunfire
    "تیراندازی",  # shooting
    "جانش",  # life (lost)
    "شهید",  # martyr
]

# Keywords to EXCLUDE (general news, not victim posts)
EXCLUDE_KEYWORDS = [
    "نتانیاهو",  # Netanyahu
    "گراهام",  # Graham
    "اعلام کرد",  # announced (political statements)
    "هزار نفر",  # thousands (rally numbers)
    "سال داشت",  # years old (when NOT in victim context)
]


@register
class VahidOnlinePlugin(SourcePlugin):
    """Telegram @VahidOnline — filters victim posts from mixed content."""

    @property
    def name(self) -> str:
        return "telegram_vahid"

    @property
    def full_name(self) -> str:
        return "Telegram @VahidOnline"

    @property
    def base_url(self) -> str:
        return BASE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Scrape Telegram channel, filter victim posts only."""
        url = BASE_URL
        page_num = 0
        victim_count = 0
        skipped_count = 0

        while url and page_num < 200:  # Safety limit
            page_num += 1
            log.info(f"Fetching page {page_num}: {url}")

            html = await fetch_with_retry(self.session, url, cache_dir=self.cache_dir)
            if not html:
                log.warning(f"Failed to fetch {url}")
                break

            posts = self._extract_posts(html)
            log.info(f"Found {len(posts)} total posts on page {page_num}")

            for post_num, text, photo_url in posts:
                # Filter: only process posts with victim keywords
                if not self._is_victim_post(text):
                    skipped_count += 1
                    continue

                parsed = self._parse_post_text(text)
                if not parsed:
                    continue

                name, death_date, age, location, note = parsed
                victim = ExternalVictim(
                    source_id=f"vahid_{post_num}",
                    source_name="Telegram @VahidOnline",
                    source_url=f"{BASE_URL}/{post_num}",
                    source_type="citizen_journalism",
                    name_farsi=name,
                    date_of_death=death_date,
                    age_at_death=age,
                    place_of_death=location,
                    province=None,
                    photo_url=photo_url,
                    circumstances_fa=note,
                )
                victim_count += 1
                yield victim

            # Pagination
            prev_link = self._extract_prev_link(html)
            url = f"{BASE_URL}{prev_link}" if prev_link else None

            # Rate limiting handled inside fetch_with_retry()

        log.info(
            f"Completed: {victim_count} victims, {skipped_count} posts filtered out"
        )

    def _is_victim_post(self, text: str) -> bool:
        """Check if post documents a victim (not general news)."""
        if not text:
            return False

        text_lower = text.lower()

        # Exclude political/news posts
        for keyword in EXCLUDE_KEYWORDS:
            if keyword in text_lower:
                return False

        # Require at least one victim keyword
        for keyword in VICTIM_KEYWORDS:
            if keyword in text:
                return True

        return False

    def _extract_posts(self, html: str) -> list[tuple[int, str, Optional[str]]]:
        """Extract posts with their number, text, and photo URL."""
        posts = []
        # Match: data-post="VahidOnline/12345"
        post_pattern = re.compile(r'data-post="VahidOnline/(\d+)"')
        for match in post_pattern.finditer(html):
            post_num = int(match.group(1))
            # Extract post content block
            start = match.start()
            end = html.find('data-post="VahidOnline/', start + 1)
            if end == -1:
                end = len(html)
            post_html = html[start:end]

            # Extract text
            text_match = re.search(
                r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',
                post_html,
                re.DOTALL,
            )
            text = ""
            if text_match:
                raw = text_match.group(1)
                text = re.sub(r"<[^>]+>", "", raw)  # Strip HTML tags
                text = text.strip()

            # Extract photo URL
            photo_url = None
            photo_match = re.search(r"background-image:url\('([^']+)'\)", post_html)
            if photo_match:
                photo_url = photo_match.group(1)

            posts.append((post_num, text, photo_url))

        return posts

    def _extract_prev_link(self, html: str) -> Optional[str]:
        """Extract pagination link to previous page."""
        match = re.search(r'<link rel="prev" href="([^"]+)"', html)
        return match.group(1) if match else None

    def _parse_post_text(
        self, text: str
    ) -> Optional[tuple[str, Optional[date], Optional[int], Optional[str], Optional[str]]]:
        """Parse victim post text.

        Returns: (name, death_date, age, location, note) or None
        """
        if not text:
            return None

        # Skip service messages
        if "این پیام حذف شده است" in text or "This message was deleted" in text:
            return None

        # Extract name (usually first line, may have underscores)
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        if not lines:
            return None

        name_line = lines[0]
        # Remove underscores from name (formatting artifact)
        name = re.sub(r"_", " ", name_line)

        # Remove parenthetical notes from name FIRST
        note = None
        if "(" in name and ")" in name:
            paren_match = re.search(r"\(([^)]+)\)", name)
            if paren_match:
                note = paren_match.group(1)
                name = re.sub(r"\s*\([^)]+\)", "", name)

        # THEN remove trailing verbs/context from name (keep only the name part)
        # Stop at common verbs: کشته، زخمی، شهید
        verb_match = re.search(r"\s+(کشته|زخمی|شهید|درگذشته|جان)", name)
        if verb_match:
            name = name[:verb_match.start()].strip()

        # Clean up name (remove double spaces)
        name = re.sub(r"\s{2,}", " ", name).strip()

        # Extract age
        age = None
        age_match = re.search(r"(\d+)\s*ساله", text)
        if age_match:
            age = int(age_match.group(1))

        # Extract Jalali date
        death_date = parse_jalali_date(text)

        # Extract location (city name after date)
        location = None
        # Pattern: "۱۸ دی تهران" or "پنجشنبه ۱۸ دی در بروجرد"
        loc_match = re.search(
            r"(?:در\s+)?([آ-ی]+(?:\s+[آ-ی]+)?)\s+(?:کشته|زخمی)", text
        )
        if not loc_match:
            # Try: after date
            loc_match = re.search(r"دی\s+(?:در\s+)?([آ-ی]+)", text)
        if loc_match:
            location = loc_match.group(1).strip()

        # Build note from circumstances
        if not note:
            if "شلیک" in text or "تیراندازی" in text:
                note = "Shot during protests"
            elif "زخمی" in text and "جانش" in text:
                note = "Died from protest injuries"

        return (name, death_date, age, location, note)


# Farsi city mapping (subset from telegram_rtn.py)
FARSI_CITY_MAP = {
    "تهران": "tehran",
    "مشهد": "mashhad",
    "اصفهان": "isfahan",
    "کرج": "karaj",
    "شیراز": "shiraz",
    "تبریز": "tabriz",
    "قم": "qom",
    "اهواز": "ahvaz",
    "کرمانشاه": "kermanshah",
    "رشت": "rasht",
    "بروجرد": "borujerd",
    "پرند": "parand",
}
