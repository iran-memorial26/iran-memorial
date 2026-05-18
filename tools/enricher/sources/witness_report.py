"""witness.report — community-sourced Iran detention/execution registry.

API: https://witness.report/api/advancedsearch_list.php
Format: DataTables-style (start, length, recordsTotal, data[]).
The server caps `length` at 200 regardless of the request value, so we
paginate via `start=0,200,400,…` per target status.

The list endpoint returns rich HTML-wrapped fields. We do not scrape the
detail pages (/people/{uuid}/{slug}), which require Google login.

Target statuses (memorial scope):
- Deceased (have date_of_death):  Executed, Murdered, Murdered in custody,
                                  Shot to death
- Living political prisoners:     Imprisoned, Sentenced to death, Kidnapped

Skipped: Arrested, Temporary detention, Released, Released on bail, Escaped,
"Shot in eyes", Lost — too transient or not memorial-relevant.

Expected yield: ~11,466 across all target statuses.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import random
import re
from datetime import date, datetime
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.witness_report")

BASE_URL = "https://witness.report"
API_URL = BASE_URL + "/api/advancedsearch_list.php"
PAGE_SIZE = 200  # server-side cap

# status -> (cause_of_death, has_date_of_death)
STATUS_MAP: dict[str, tuple[str, bool]] = {
    "Executed": ("Execution", True),
    "Murdered": ("Murder", True),
    "Murdered in custody": ("Death in custody", True),
    "Shot to death": ("Shot to death", True),
    "Imprisoned": ("Imprisoned", False),
    "Sentenced to death": ("Sentenced to death (imprisoned)", False),
    "Kidnapped": ("Disappeared", False),
}

BROWSER_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://witness.report/advancedsearch.php",
}

# witness.report sits behind Cloudflare's bot challenge, which fingerprints
# TLS handshakes (JA3/JA4). The aiohttp default fingerprint is flagged as a
# bot and gets a 403 challenge from Hetzner-class IPs. curl_cffi impersonates
# real Chrome's TLS fingerprint and bypasses the challenge.
CURL_IMPERSONATE = "chrome120"


def _cache_path(cache_dir: str, url: str) -> str:
    key = hashlib.sha256(url.encode()).hexdigest()[:16]
    return os.path.join(cache_dir, key + ".json")


def _read_cached(cache_dir: str, url: str) -> Optional[str]:
    path = _cache_path(cache_dir, url)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f).get("body")


def _write_cached(cache_dir: str, url: str, body: str) -> None:
    os.makedirs(cache_dir, exist_ok=True)
    with open(_cache_path(cache_dir, url), "w", encoding="utf-8") as f:
        json.dump({"url": url, "body": body}, f, ensure_ascii=False)


async def fetch_witness(
    url: str,
    cache_dir: str,
    rate_limit: tuple[float, float] = (0.5, 1.0),
    retries: int = 3,
) -> Optional[str]:
    """Fetch witness.report URL via curl_cffi (Chrome120 TLS impersonation).

    Reads from disk cache if present (cache layout matches utils.http for
    consistency). Falls back through retry/backoff on transient errors.
    """
    cached = _read_cached(cache_dir, url)
    if cached is not None:
        return cached

    try:
        from curl_cffi.requests import AsyncSession
    except ImportError:
        log.error(
            "curl_cffi not installed — required for witness.report. "
            "Install with: pip install curl_cffi"
        )
        return None

    async with AsyncSession(impersonate=CURL_IMPERSONATE) as s:
        for attempt in range(retries):
            try:
                r = await s.get(url, headers=BROWSER_HEADERS, timeout=30)
                if r.status_code == 200:
                    body = r.text
                    await asyncio.sleep(random.uniform(*rate_limit))
                    _write_cached(cache_dir, url, body)
                    return body
                if r.status_code == 429 or r.status_code >= 500:
                    await asyncio.sleep(5.0 * (2 ** attempt))
                    continue
                log.warning(f"witness.report HTTP {r.status_code} for {url}")
                return None
            except Exception as exc:
                log.warning(f"witness.report fetch error (attempt {attempt+1}): {exc}")
                await asyncio.sleep(5.0 * (attempt + 1))
    return None

UUID_RE = re.compile(
    r"/people/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([^\"'/]+)"
)
DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


def parse_iso_date(raw: Optional[str]) -> Optional[date]:
    """Parse 'YYYY-MM-DD' into a date; return None on failure."""
    if not raw:
        return None
    raw = raw.strip()
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


def extract_uuid_and_slug(html_field: str) -> tuple[Optional[str], Optional[str]]:
    """Extract UUID and slug from a /people/{uuid}/{slug} anchor."""
    if not html_field:
        return None, None
    m = UUID_RE.search(html_field)
    if not m:
        return None, None
    return m.group(1), m.group(2)


def split_full_name(full_name_en: str) -> tuple[Optional[str], Optional[str]]:
    """Split 'Latin<br>Farsi<br>...' into (latin, farsi).

    Trailing <small>…</small> blocks (More-Info button) are dropped.
    """
    if not full_name_en:
        return None, None
    parts = [p.strip() for p in re.split(r"<br\s*/?>", full_name_en)]
    parts = [p for p in parts if p and not p.startswith("<")]
    latin = parts[0] if parts else None
    farsi = parts[1] if len(parts) > 1 else None
    return latin or None, farsi or None


def parse_country_field(country: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Parse 'Iran<br>Province<br>City' into (country, province, city)."""
    if not country:
        return None, None, None
    parts = [p.strip() for p in re.split(r"<br\s*/?>", country) if p.strip()]
    c = parts[0] if parts else None
    p = parts[1] if len(parts) > 1 else None
    city = parts[2] if len(parts) > 2 else None
    return c, p, city


def parse_age_field(age_field: str) -> tuple[Optional[int], Optional[int]]:
    """Parse age '<br>19<br>2007<br>' into (age, year_of_birth)."""
    if not age_field:
        return None, None
    parts = [p.strip() for p in re.split(r"<br\s*/?>", age_field)]
    parts = [p for p in parts if p]
    age: Optional[int] = None
    yob: Optional[int] = None
    for p in parts:
        if p.isdigit():
            n = int(p)
            if 1900 <= n <= 2100 and yob is None:
                yob = n
            elif 0 < n < 130 and age is None:
                age = n
    return age, yob


def extract_health_date(health_status: str) -> Optional[date]:
    """Extract the trailing ISO date from healthStatus HTML.

    Example: '<span class="badge bg-dark">Deceased</span><br>2026-04-26'
    """
    if not health_status:
        return None
    m = DATE_RE.search(health_status)
    if not m:
        return None
    return parse_iso_date(m.group(1))


def is_iranian(record: dict) -> bool:
    """True if nationality or country is Iranian."""
    nat = (record.get("nationality") or "").strip().lower()
    if "iran" in nat:
        return True
    country, _, _ = parse_country_field(record.get("country") or "")
    return bool(country and "iran" in country.lower())


def record_to_external_victim(record: dict) -> Optional[ExternalVictim]:
    """Map a witness.report API record into an ExternalVictim.

    Returns None if required fields (UUID, name) are missing or status is
    not in our target set.
    """
    status = (record.get("detentionStatus") or "").strip()
    if status not in STATUS_MAP:
        return None
    if not is_iranian(record):
        return None

    uuid, slug = extract_uuid_and_slug(record.get("photo") or record.get("fullNameEn") or "")
    if not uuid:
        return None

    name_latin, name_farsi = split_full_name(record.get("fullNameEn") or "")
    if not name_latin:
        return None

    cause, has_death_date = STATUS_MAP[status]
    _, province, city = parse_country_field(record.get("country") or "")
    age, yob = parse_age_field(record.get("age") or "")

    date_of_death: Optional[date] = None
    if has_death_date:
        date_of_death = extract_health_date(record.get("healthStatus") or "")
        if not date_of_death:
            date_of_death = parse_iso_date(record.get("updateTime"))

    date_of_birth: Optional[date] = None
    if yob:
        date_of_birth = date(yob, 1, 1)

    detail_url = f"{BASE_URL}/people/{uuid}/{slug}" if slug else f"{BASE_URL}/people/{uuid}"
    photo_url = f"{BASE_URL}/images/{uuid}.jpg"

    circumstances = f"Status per witness.report: {status}."
    if status == "Sentenced to death":
        circumstances = "Sentenced to death; awaiting execution per witness.report."
    elif status == "Kidnapped":
        circumstances = "Forcibly disappeared per witness.report."

    return ExternalVictim(
        source_id=f"witness_{uuid}",
        source_name="witness.report",
        source_url=detail_url,
        source_type="community_database",
        name_latin=name_latin,
        name_farsi=name_farsi,
        date_of_birth=date_of_birth,
        place_of_death=city,
        province=province,
        date_of_death=date_of_death,
        age_at_death=age if has_death_date else None,
        cause_of_death=cause,
        circumstances_en=circumstances,
        photo_url=photo_url,
    )


@register
class WitnessReportPlugin(SourcePlugin):
    """witness.report — paginated by detention status."""

    @property
    def name(self) -> str:
        return "witness_report"

    @property
    def full_name(self) -> str:
        return "witness.report — Iran Detention & Execution Registry"

    @property
    def base_url(self) -> str:
        return BASE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Iterate target statuses; paginate each via start=0,200,400,…"""
        total_yielded = 0
        total_skipped = 0

        for status in STATUS_MAP.keys():
            start = self.progress.get_checkpoint(f"start_{status}", 0)
            page_index = start // PAGE_SIZE

            while True:
                url = (
                    f"{API_URL}?status={status.replace(' ', '+')}"
                    f"&start={start}&length={PAGE_SIZE}"
                )
                body = await fetch_witness(
                    url,
                    cache_dir=self.cache_dir,
                    rate_limit=(0.5, 1.0),
                )
                if not body:
                    log.warning(f"witness.report: failed status={status} start={start}")
                    break

                try:
                    payload = json.loads(body)
                except json.JSONDecodeError as exc:
                    log.warning(f"witness.report: invalid JSON status={status} start={start}: {exc}")
                    break

                records = payload.get("data") or []
                if not records:
                    break

                for record in records:
                    victim = record_to_external_victim(record)
                    if not victim:
                        total_skipped += 1
                        continue

                    if self.progress.is_processed(victim.source_id):
                        continue

                    yield victim
                    self.progress.mark_processed(victim.source_id)
                    total_yielded += 1

                page_index += 1
                start += PAGE_SIZE
                self.progress.set_checkpoint(f"start_{status}", start)

                if page_index % 5 == 0:
                    log.info(
                        f"witness.report [{status}] page {page_index}: "
                        f"yielded={total_yielded} skipped={total_skipped}"
                    )

                if len(records) < PAGE_SIZE:
                    break

            log.info(f"witness.report [{status}] done at start={start}")

        log.info(
            f"witness.report total yielded={total_yielded} "
            f"skipped={total_skipped} (non-target status or non-Iranian)"
        )
