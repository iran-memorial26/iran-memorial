"""CPJ (Committee to Protect Journalists) — Iranian journalists killed in the line of duty.

Scrapes https://cpj.org/wp-json/cpj-datamanager/v1/people_list

The API returns all 5,410+ global journalist records across 271 pages.
Server-side filtering (status=Killed&location=Iran) silently returns zero rows
without a WP nonce, so we paginate the full set and filter client-side.

Scope: only Iran + Killed entries (memorial site policy). Imprisoned entries
skipped. Expected yield: ~20 entries (high overlap with Boroumand expected).
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.cpj")

BASE_URL = "https://cpj.org"
# NOTE: the API ignores `pageNum=` (silently returns zero rows). The working
# pagination param is `page=`. Without any param the endpoint returns page 1.
API_URL = BASE_URL + "/wp-json/cpj-datamanager/v1/people_list?page={page}"

TARGET_COUNTRY = "Iran"
TARGET_STATUS = "Killed"

# CPJ's WordPress API silently returns an empty payload for non-browser UAs.
# Override the default enricher UA with a browser-like string per-request.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://cpj.org/data/",
}


def parse_start_display(raw: Optional[str]) -> Optional[date]:
    """Parse CPJ's human-readable date format 'Month Day, Year' into a date.

    Returns None if unparseable or missing — CPJ sometimes only has year.
    """
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ("%B %d, %Y", "%B %Y", "%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def slug_from_mtpage(mtpage: Optional[str]) -> Optional[str]:
    """Extract the slug from an mtpage URL like
    'https://cpj.org/data/people/javad-heydari/' -> 'javad-heydari'.
    """
    if not mtpage:
        return None
    stripped = mtpage.rstrip("/")
    last = stripped.rsplit("/", 1)[-1]
    return last or None


def build_occupation(record: dict) -> Optional[str]:
    """Compose 'Journalist — Outlet1, Outlet2' from type + organizations."""
    kind = (record.get("type") or "").strip()
    orgs = (record.get("organizations") or "").strip()
    if kind and orgs:
        return f"{kind} — {orgs}"
    return kind or orgs or None


def build_circumstances(record: dict) -> Optional[str]:
    """Compose an English circumstances string from CPJ's structured fields."""
    parts: list[str] = []
    type_of_death = (record.get("typeOfDeath") or "").strip()
    if type_of_death:
        parts.append(f"Type of death: {type_of_death}")
    motive = (record.get("motiveConfirmed") or "").strip()
    if motive:
        parts.append(f"Motive: {motive}")
    charges = record.get("charges")
    if charges:
        parts.append(f"Charges: {charges}")
    return " | ".join(parts) if parts else None


def is_target(record: dict) -> bool:
    """True if the record is an Iran + Killed entry (memorial scope)."""
    return (
        record.get("location") == TARGET_COUNTRY
        and record.get("status") == TARGET_STATUS
    )


def record_to_external_victim(record: dict) -> Optional[ExternalVictim]:
    """Map a CPJ API record into an ExternalVictim. Returns None if required
    fields (name, slug) are missing."""
    name = (record.get("fullName") or "").strip()
    slug = slug_from_mtpage(record.get("mtpage"))
    if not name or not slug:
        return None

    return ExternalVictim(
        source_id=f"cpj_{slug}",
        source_name="Committee to Protect Journalists",
        source_url=record.get("mtpage") or f"{BASE_URL}/data/people/{slug}/",
        source_type="human_rights_org",
        name_latin=name,
        occupation=build_occupation(record),
        date_of_death=parse_start_display(record.get("startDisplay")),
        cause_of_death=(record.get("typeOfDeath") or "").strip() or None,
        circumstances_en=build_circumstances(record),
    )


@register
class CpjPlugin(SourcePlugin):
    """CPJ — killed Iranian journalists, filtered client-side."""

    @property
    def name(self) -> str:
        return "cpj"

    @property
    def full_name(self) -> str:
        return "Committee to Protect Journalists — Iran Killed"

    @property
    def base_url(self) -> str:
        return BASE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Paginate all CPJ records; yield Iran + Killed entries only."""
        first_body = await fetch_with_retry(
            self.session,
            API_URL.format(page=1),
            rate_limit=(0.8, 1.2),
            cache_dir=self.cache_dir,
            extra_headers=BROWSER_HEADERS,
        )
        if not first_body:
            log.error("CPJ: failed to fetch API page 1")
            return

        try:
            first = json.loads(first_body)
        except json.JSONDecodeError as exc:
            log.error(f"CPJ: invalid JSON on page 1: {exc}")
            return

        max_page = int(first.get("pageCount") or 1)
        row_count = int(first.get("rowCount") or 0)
        log.info(f"CPJ: {row_count} global records across {max_page} pages")

        start_page = self.progress.get_checkpoint("browse_page", 1)
        total_yielded = 0
        total_seen = 0
        total_iran_other = 0

        for page in range(start_page, max_page + 1):
            if page == 1:
                body = first_body
            else:
                body = await fetch_with_retry(
                    self.session,
                    API_URL.format(page=page),
                    rate_limit=(0.8, 1.2),
                    cache_dir=self.cache_dir,
                    extra_headers=BROWSER_HEADERS,
                )
                if not body:
                    log.warning(f"CPJ: failed to fetch page {page}")
                    continue

            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                log.warning(f"CPJ: invalid JSON on page {page}")
                continue

            records = payload.get("data") or []
            total_seen += len(records)

            for record in records:
                if record.get("location") == TARGET_COUNTRY and record.get("status") != TARGET_STATUS:
                    total_iran_other += 1
                if not is_target(record):
                    continue

                victim = record_to_external_victim(record)
                if not victim:
                    continue

                if self.progress.is_processed(victim.source_id):
                    continue

                yield victim
                self.progress.mark_processed(victim.source_id)
                total_yielded += 1

            self.progress.set_checkpoint("browse_page", page)

            if page % 25 == 0 or page == max_page:
                log.info(
                    f"CPJ page {page}/{max_page}: "
                    f"seen={total_seen}, yielded={total_yielded}, "
                    f"iran_other_status={total_iran_other}"
                )

        log.info(
            f"CPJ done: {total_yielded} Iran+Killed yielded "
            f"(out of {total_seen} global records scanned; "
            f"{total_iran_other} Iran records with other statuses skipped)"
        )
