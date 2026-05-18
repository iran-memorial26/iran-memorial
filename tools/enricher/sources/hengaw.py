"""hengaw.net — Hengaw Organisation for Human Rights (Kurdistan focus).

Hengaw publishes daily SSR news articles on extrajudicial killings,
executions, sniper victims, and political prisoners with strong coverage
of West Iran (Kurdistan, Sistan-Baluchistan, Azerbaijan provinces). It
catches cases that KHRN and Boroumand miss — especially current sniper
deaths and femen-rights victims that don't yet have formal HR-org reports.

URL pattern: hengaw.net/en/news/{YYYY}/{MM}/article-{N}
Server-side rendered HTML with title in <h1> and body in <article>.
Cloudflare-aware via curl_cffi (chrome120 impersonation), same as the
witness_report and hrana plugins.

Strategy:
 1. Crawl /en/execution and /en/killed category pages (paginated).
 2. For each article URL, parse the title to identify the subject's name
    and what happened, then yield a name-only ExternalVictim that the
    matcher links to existing DB victims (or creates new in --import-new).

Scope: extrajudicial killings + judicial executions only. Articles about
arrests, trials, or non-victim topics are filtered by title heuristics.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import random
import re
from datetime import date
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.hengaw")

BASE_URL = "https://hengaw.net"
CATEGORIES = (
    "/en/execution",
    "/en/killed",
)
MAX_PAGES_PER_CATEGORY = 200  # ~22 articles/page → ~4,400 max
CURL_IMPERSONATE = "chrome120"

ARTICLE_LINK_RE = re.compile(r'/en/news/(\d{4})/(\d{2})/article-\d+(?:-\d+)?')
H1_RE = re.compile(r"<h1[^>]*>([^<]+)</h1>")
ARTICLE_BODY_RE = re.compile(r"<article[^>]*>(.*?)</article>", re.DOTALL)
DATE_IN_BODY_RE = re.compile(
    r"\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*,?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})\b",
)
ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
AGE_RE = re.compile(r"\b(?:a\s+)?(\d{1,2})[-\s]year[-\s]old\b", re.IGNORECASE)
PRISON_RE = re.compile(r"([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Prison|prison|Detention Center))")

# Title patterns we care about
EXECUTION_TITLE_RE = re.compile(
    r"\b(?:executed|hanged|hangings?|execution)\b", re.IGNORECASE
)
KILLED_TITLE_RE = re.compile(
    r"\b(?:killed|shot|martyr|gunfire|sniper|murder)\b", re.IGNORECASE
)


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


async def fetch_hengaw(url: str, cache_dir: str, retries: int = 3) -> Optional[str]:
    """curl_cffi fetch with Chrome120 TLS + disk cache."""
    cached = _read_cached(cache_dir, url)
    if cached is not None:
        return cached
    try:
        from curl_cffi.requests import AsyncSession
    except ImportError:
        log.error("curl_cffi not installed — pip install curl_cffi")
        return None
    async with AsyncSession(impersonate=CURL_IMPERSONATE) as s:
        for attempt in range(retries):
            try:
                r = await s.get(url, timeout=30)
                if r.status_code == 200:
                    body = r.text
                    await asyncio.sleep(random.uniform(0.4, 0.9))
                    _write_cached(cache_dir, url, body)
                    return body
                if r.status_code == 404:
                    return None
                if r.status_code == 429 or r.status_code >= 500:
                    await asyncio.sleep(5.0 * (2 ** attempt))
                    continue
                log.warning(f"hengaw HTTP {r.status_code} for {url}")
                return None
            except Exception as exc:
                log.warning(f"hengaw fetch error attempt {attempt+1}: {exc}")
                await asyncio.sleep(3.0 * (attempt + 1))
    return None


# -- Title parser --------------------------------------------------------

# Strip leading "Prisoner ", "Citizen ", etc. and trailing "executed at X"
NAME_PREFIX_RE = re.compile(
    r"^(?:Prisoner|Political Prisoner|Citizen|Activist|Young\s+\w+|"
    r"Death sentence (?:of|for)|Execution of|Hanging of|"
    r"Three|Two|Four|Five|Several)\s+",
    re.IGNORECASE,
)
NAME_SUFFIX_RE = re.compile(
    r"\s+(?:executed|hanged|killed|shot|murdered|sentenced|martyred|"
    r"died|loses?|loss of|suffers?|on hunger|on death row).*$",
    re.IGNORECASE,
)


def extract_name_from_title(title: str) -> Optional[str]:
    """Pull the subject's name out of a Hengaw article headline.

    Examples:
      "Prisoner Jafar Fakhrabadi executed at Yazd Central Prison" → "Jafar Fakhrabadi"
      "Citizen Ali Ahmadi killed by direct gunfire" → "Ali Ahmadi"
      "Execution of Reza Hosseini" → "Reza Hosseini"
    """
    if not title:
        return None
    cleaned = NAME_PREFIX_RE.sub("", title.strip())
    cleaned = NAME_SUFFIX_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Need at least one capitalized two-token sequence
    m = re.match(r"^([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){1,3})", cleaned)
    if not m:
        return None
    name = m.group(1)
    # Reject clearly non-name terms that survived heuristics
    non_names = {"Iran Iran", "Hengaw Organization", "Human Rights"}
    if name in non_names:
        return None
    return name


def is_target_title(title: str) -> bool:
    """Filter out arrests/trials/non-victim articles."""
    if not title:
        return False
    if EXECUTION_TITLE_RE.search(title) or KILLED_TITLE_RE.search(title):
        return True
    return False


def parse_article_body(body_html: str) -> dict:
    """Extract structured fields from Hengaw article body HTML."""
    text = re.sub(r"<[^>]+>", " ", body_html)
    text = re.sub(r"\s+", " ", text).strip()
    out: dict = {}

    # Date — prefer ISO if present, else parse weekday-month-day-year
    iso = ISO_DATE_RE.search(text)
    if iso:
        try:
            out["date"] = date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        except ValueError:
            pass
    if "date" not in out:
        m = DATE_IN_BODY_RE.search(text)
        # Just keep year — full date parsing is brittle
        if m:
            try:
                out["year"] = int(m.group(1))
            except ValueError:
                pass

    # Age
    age_m = AGE_RE.search(text)
    if age_m:
        try:
            out["age"] = int(age_m.group(1))
        except ValueError:
            pass

    # Prison
    prison_m = PRISON_RE.search(text)
    if prison_m:
        out["prison"] = prison_m.group(1).strip()

    out["body_text"] = text[:1500]
    return out


# -- Plugin --------------------------------------------------------------

@register
class HengawPlugin(SourcePlugin):
    """hengaw.net — Hengaw HR Kurdistan-focused enricher."""

    @property
    def name(self) -> str:
        return "hengaw"

    @property
    def full_name(self) -> str:
        return "Hengaw Organisation for Human Rights"

    @property
    def base_url(self) -> str:
        return BASE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        articles_to_visit: list[str] = []
        seen: set[str] = set()
        total_articles = 0
        total_yielded = 0

        # Phase 1: enumerate article URLs from category pages
        for category in CATEGORIES:
            cat_articles_start = total_articles
            for page in range(1, MAX_PAGES_PER_CATEGORY + 1):
                url = f"{BASE_URL}{category}" + (f"?page={page}" if page > 1 else "")
                body = await fetch_hengaw(url, cache_dir=self.cache_dir)
                if not body:
                    break

                articles_on_page = ARTICLE_LINK_RE.findall(body)
                if not articles_on_page:
                    break

                new_on_page = 0
                for year_str, _ in articles_on_page:
                    pass  # year captured but unused at index time

                # Re-extract full URLs (paths) for dedup
                paths = list(set(re.findall(
                    r'/en/news/\d{4}/\d{2}/article-\d+(?:-\d+)?', body
                )))
                for path in paths:
                    full_url = BASE_URL + path
                    if full_url in seen:
                        continue
                    seen.add(full_url)
                    articles_to_visit.append(full_url)
                    new_on_page += 1
                    total_articles += 1

                if new_on_page == 0:
                    break
                if page % 10 == 0:
                    log.info(f"hengaw[{category}] page {page}: indexed {total_articles}")

            log.info(
                f"hengaw[{category}] indexed: +{total_articles - cat_articles_start}"
            )

        log.info(f"hengaw phase 1 done: {total_articles} unique articles to fetch")

        # Phase 2: fetch each article body, parse, yield rich victim records
        for idx, article_url in enumerate(articles_to_visit):
            html = await fetch_hengaw(article_url, cache_dir=self.cache_dir)
            if not html:
                continue

            title_m = H1_RE.search(html)
            title = title_m.group(1).strip() if title_m else ""
            if not is_target_title(title):
                continue

            name = extract_name_from_title(title)
            if not name:
                continue

            body_match = ARTICLE_BODY_RE.search(html)
            parsed = parse_article_body(body_match.group(1)) if body_match else {}

            cause = "Execution » Hanging" if EXECUTION_TITLE_RE.search(title) else "Shot to death"
            slug = article_url.rstrip("/").rsplit("/", 1)[-1]
            sid = f"hengaw_{slug}_{name.replace(' ', '_').lower()}"
            if self.progress.is_processed(sid):
                continue

            ext = ExternalVictim(
                source_id=sid,
                source_name="Hengaw",
                source_url=article_url,
                source_type="human_rights_org",
                name_latin=name,
                age_at_death=parsed.get("age"),
                place_of_death=parsed.get("prison"),
                date_of_death=parsed.get("date"),
                cause_of_death=cause,
                circumstances_en=parsed.get("body_text"),
            )
            yield ext
            self.progress.mark_processed(sid)
            total_yielded += 1

            if (idx + 1) % 100 == 0:
                log.info(
                    f"hengaw phase 2 progress: {idx+1}/{len(articles_to_visit)} articles, "
                    f"{total_yielded} candidates yielded"
                )

        log.info(
            f"hengaw TOTAL: articles_indexed={total_articles} candidates_yielded={total_yielded}"
        )
