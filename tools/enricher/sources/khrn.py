"""KHRN (Kurdistan Human Rights Network) — Hiwa prisoners database.

Scrapes https://kurdistanhumanrights.org/en/hiwa/list-of-political-prisoners
and filters for deceased entries only (memorial scope).

Note: At time of writing, the Hiwa database lists primarily *living*
political prisoners — a live run may yield 0 deceased entries. The plugin
is future-proofed for when KHRN adds executed/deceased cases.
"""

from __future__ import annotations

import html
import logging
import re
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from ..utils.provinces import extract_province
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.khrn")

BASE_URL = "https://kurdistanhumanrights.org"
LIST_URL_PAGE_1 = BASE_URL + "/en/hiwa/list-of-political-prisoners"
LIST_URL_PAGE_N = BASE_URL + "/en/hiwa/list-of-political-prisoners/page/{page}"

DECEASED_PATTERNS = (
    r"\bexecuted\b",
    r"\bdeceased\b",
    r"\bkilled\b",
    r"\bmartyr(?:ed)?\b",
    r"\bdied\b",
    r"\bshot dead\b",
    r"\bpassed away\b",
    r"\bdeath in custody\b",
)
_DECEASED_RE = re.compile("|".join(DECEASED_PATTERNS), re.IGNORECASE)


def is_deceased(status: Optional[str]) -> bool:
    """True if the Current Status indicates the prisoner is deceased.

    Uses word-boundary matching to avoid false positives like
    "Martyrdom Prison" or "studied" (substring of "died").
    """
    if not status:
        return False
    return bool(_DECEASED_RE.search(status))


def _extract_field(block: str, label: str) -> Optional[str]:
    """Pull '<strong>LABEL:</strong> VALUE<br>' from a card block."""
    pattern = rf"<strong>{re.escape(label)}:\s*</strong>\s*([^<]+?)(?:<br|</div)"
    match = re.search(pattern, block)
    if not match:
        return None
    value = html.unescape(match.group(1)).strip()
    value = re.sub(r"\s+", " ", value)
    return value or None


def _extract_max_page(html: str) -> int:
    """Find highest page number in the pagination block. Default: 1."""
    pages = re.findall(
        r'/en/hiwa/list-of-political-prisoners/page/(\d+)"', html
    )
    return max((int(p) for p in pages), default=1)


def parse_listing_page(html: str) -> list[dict]:
    """Extract prisoner cards from a listing page."""
    entries: list[dict] = []
    blocks = re.split(
        r'<div class="news-post-item row db-person-item-list">', html
    )

    for block in blocks[1:]:
        link_match = re.search(
            r'href="(https://kurdistanhumanrights\.org/en/prisoners-database/([^"]+))"',
            block,
        )
        if not link_match:
            continue
        detail_url = link_match.group(1)
        slug = link_match.group(2)

        name_match = re.search(r"<h2>\s*<span>([^<]+)</span>\s*</h2>", block)
        name = name_match.group(1).strip() if name_match else None
        if not name:
            continue

        photo_match = re.search(
            r'<img[^>]+src="(https://kurdistanhumanrights\.org/wp-content/uploads/[^"]+)"',
            block,
        )
        photo_url = photo_match.group(1) if photo_match else None

        entries.append({
            "slug": slug,
            "detail_url": detail_url,
            "name": name,
            "photo_url": photo_url,
            "born": _extract_field(block, "Born"),
            "field_of_activity": _extract_field(block, "Field of activity"),
            "charged_with": _extract_field(block, "Charged With"),
            "sentence": _extract_field(block, "Sentence"),
            "status": _extract_field(block, "Current Status"),
        })

    return entries


def build_circumstances(entry: dict) -> Optional[str]:
    """Concatenate charges, sentence, and status into circumstances_en."""
    parts: list[str] = []
    if entry.get("charged_with"):
        parts.append(f"Charged With: {entry['charged_with']}")
    if entry.get("sentence"):
        parts.append(f"Sentence: {entry['sentence']}")
    if entry.get("status"):
        parts.append(f"Status: {entry['status']}")
    return " | ".join(parts) if parts else None


@register
class KhrnPlugin(SourcePlugin):
    """Kurdistan Human Rights Network — Hiwa political prisoners DB."""

    @property
    def name(self) -> str:
        return "khrn"

    @property
    def full_name(self) -> str:
        return "Kurdistan Human Rights Network — Hiwa Database"

    @property
    def base_url(self) -> str:
        return BASE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Iterate all listing pages; yield deceased entries as ExternalVictim."""
        first_html = await fetch_with_retry(
            self.session,
            LIST_URL_PAGE_1,
            rate_limit=(1.0, 2.0),
            cache_dir=self.cache_dir,
        )
        if not first_html:
            log.error("Failed to fetch KHRN listing page 1")
            return

        max_page = _extract_max_page(first_html)
        log.info(f"KHRN: detected {max_page} listing pages")

        start_page = self.progress.get_checkpoint("browse_page", 1)
        total_yielded = 0
        total_skipped_alive = 0

        for page in range(start_page, max_page + 1):
            if page == 1:
                html_text = first_html
            else:
                html_text = await fetch_with_retry(
                    self.session,
                    LIST_URL_PAGE_N.format(page=page),
                    rate_limit=(1.0, 2.0),
                    cache_dir=self.cache_dir,
                )
                if not html_text:
                    log.warning(f"Failed to fetch KHRN page {page}")
                    continue

            entries = parse_listing_page(html_text)
            if not entries:
                log.warning(
                    f"KHRN page {page}/{max_page}: 0 entries parsed "
                    "(possible HTML change or transient issue; continuing)"
                )
                continue

            for entry in entries:
                source_id = f"khrn_{entry['slug']}"

                if not is_deceased(entry.get("status")):
                    total_skipped_alive += 1
                    continue

                if self.progress.is_processed(source_id):
                    continue

                province = extract_province(entry.get("born"))

                yield ExternalVictim(
                    source_id=source_id,
                    source_name=self.full_name,
                    source_url=entry["detail_url"],
                    source_type="memorial_database",
                    name_latin=entry["name"],
                    place_of_birth=entry.get("born"),
                    photo_url=entry.get("photo_url"),
                    occupation=entry.get("field_of_activity"),
                    province=province,
                    cause_of_death=entry.get("status"),
                    circumstances_en=build_circumstances(entry),
                )

                self.progress.mark_processed(source_id)
                total_yielded += 1

            self.progress.set_checkpoint("browse_page", page)
            log.info(
                f"KHRN page {page}/{max_page}: "
                f"{len(entries)} entries, "
                f"yielded={total_yielded}, skipped_alive={total_skipped_alive}"
            )

        log.info(
            f"KHRN done: yielded {total_yielded} deceased, "
            f"skipped {total_skipped_alive} living prisoners"
        )
