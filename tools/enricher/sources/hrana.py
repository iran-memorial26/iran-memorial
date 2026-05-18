"""HRANA (Human Rights Activists News Agency) — source-enrichment plugin.

en-hrana.org is a WordPress news site with detailed reporting on Iranian
human rights violations. Unlike Boroumand or witness.report, it does NOT
publish a structured victim database — each article is hand-written
journalism. Roughly 2,000+ execution/prisoner articles total.

Strategy: cross-validation source. We crawl two category indexes
(executions + prisoners), extract name candidates from each article
headline using deterministic heuristics, and yield ExternalVictims
that carry only the source URL + name. The matcher then links them to
existing DB victims by name. We do NOT attempt to create new victims
from headlines (too noisy without structured fields).

Effect: each matched victim gains an additional HIGH-credibility source
domain, raising the count for auto-verification rules.

Cloudflare bypass: same curl_cffi pattern as witness_report.

Expected yield: 1,500-3,000 sources added across the documented corpus.
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

log = logging.getLogger("enricher.hrana")

BASE_URL = "https://www.en-hrana.org"
CATEGORIES = (
    "/category/news/executions/",
    "/category/news/prisoners/",
)
MAX_PAGES_PER_CATEGORY = 200  # ~2,000 articles per category
CURL_IMPERSONATE = "chrome120"

# 31 Iranian provinces (Latin transliterations seen in HRANA keywords).
# Matched against the JSON-LD `keywords` array to lift `province`.
IRANIAN_PROVINCES = {
    "Tehran", "Alborz", "Esfahan", "Isfahan", "Fars", "Khuzestan",
    "Mazandaran", "Gilan", "Khorasan", "Razavi Khorasan", "Khorasan-e Razavi",
    "Sistan and Baluchestan", "Sistan va Baluchestan", "Sistan-Baluchestan",
    "Kerman", "Kermanshah", "West Azarbaijan", "East Azarbaijan",
    "Azarbaijan-e Gharbi", "Azarbaijan-e Sharqi",
    "Hamedan", "Lorestan", "Zanjan", "Ilam", "Yazd",
    "Kohgilouyeh", "Kohgiluyeh and Boyer-Ahmad",
    "Semnan", "Qazvin", "Ardebil", "Bushehr", "Golestan",
    "Hormozgan", "Markazi", "Kurdistan", "Kordestan",
    "North Khorasan", "South Khorasan", "Chaharmahal and Bakhtiari", "Qom",
}

# Regexes for finding article links + titles in WP archive pages
ARTICLE_LINK_RE = re.compile(
    r'<h\d[^>]*>\s*<a [^>]*href="(https://www\.en-hrana\.org/[^"#?]+)"[^>]*>([^<]+)</a>'
)
PAGE_404_HINT = re.compile(r"404|Not Found|Page not found", re.IGNORECASE)


# -- Title parser --------------------------------------------------------

# Drop these wrapping phrases before extracting names
TITLE_PREFIX_NOISE = re.compile(
    r"^(?:"
    r"January\s+Protests:|"
    r"Iran\s+(?:Executes|Hangs|Arrests):?\s*|"
    r"Iran\s+Executes\s+|"
    r"Death\s+Sentence\s+(?:of|for|carried\s+out\s+for|upheld\s+for)\s+|"
    r"Execution\s+Sentence\s+(?:of|for)\s+|"
    r"Execution\s+of\s+|"
    r"Detention\s+of\s+|"
    r"Trial\s+of\s+|"
    r"Sentencing\s+of\s+|"
    r"Death\s+sentence\s+of\s+|"
    r"\d+(?:st|nd|rd|th)?[-\s]Year[-\s]Old\s+"
    r")\s*",
    re.IGNORECASE,
)

# After prefix strip, drop these trailing phrases
TITLE_SUFFIX_NOISE = re.compile(
    r"\s*(?:"
    r"Executed(?:\s+[a-z\s]+)?|"
    r"Hanged(?:\s+[a-z\s]+)?|"
    r"Arrested(?:\s+[a-z\s]+)?|"
    r"Sentenced(?:\s+to[a-z\s]+)?|"
    r"Detained(?:\s+[a-z\s]+)?|"
    r"Upheld\s+by\s+the\s+Supreme\s+Court|"
    r"Upheld\s+by\s+Supreme\s+Court|"
    r"Sentenced\s+to\s+Death|"
    r"on\s+Security\s+Charges|"
    r"Arrested|Detained|Released|"
    r"Junaqani|Jonqani|Kalvar|Kolor"  # already-handled suffixes
    r")\s*$",
    re.IGNORECASE,
)

# Match a Latin person name: 2-4 capitalized words
NAME_RE = re.compile(
    r"\b("
    r"[A-Z][a-z]+"
    r"(?:[\-\s][A-Z]?[a-z]+){1,3}"
    r")\b"
)

# Skip these as obvious non-names (places, charges, etc.)
NAME_BLACKLIST = {
    "Iran", "Tehran", "Karaj", "Qom", "Isfahan", "Esfahan",
    "Supreme Court", "Revolutionary Court", "Death Sentence",
    "Security Charges", "Political Prisoners", "Comprehensive List",
    "Tabriz Prison", "Alborz Province", "Ghezelhesar Prison",
    "Branch", "Ministry", "January Protests", "Death Penalty",
    "Human Rights", "Iran Executes", "Death Row", "Death Sentences",
    "Public Hanging", "Drug Charges", "Mossad", "Killed", "Killing",
    "Year Term", "Daughter", "Detained", "Arrested", "Executed",
    "One Woman", "Three Prisoners", "Two Prisoners", "Four Defendants",
    "Hanged", "Sentenced", "Family", "Lawyer",
}


def extract_name_candidates(title: str) -> list[str]:
    """Pull person-name candidates out of a HRANA article headline.

    Returns deduplicated list of candidate names (Latin script).
    Matcher will compare against name_latin in the DB index.
    """
    if not title:
        return []
    cleaned = TITLE_PREFIX_NOISE.sub("", title)
    cleaned = TITLE_SUFFIX_NOISE.sub("", cleaned)

    # Get all capitalized 2-4-word sequences
    raw_matches = NAME_RE.findall(cleaned)
    candidates: list[str] = []
    seen: set[str] = set()
    for m in raw_matches:
        name = re.sub(r"\s+", " ", m).strip()
        # 2+ words required: filter "Mohammad" alone
        if name.count(" ") < 1:
            continue
        if name in NAME_BLACKLIST:
            continue
        # All-uppercase nonsense like "ABC DEF"
        if name.isupper():
            continue
        if name in seen:
            continue
        seen.add(name)
        candidates.append(name)
    return candidates


def slug_from_url(url: str) -> str:
    """e.g. .../january-protests-erfan-kiani-executed/ -> 'january-protests-erfan-kiani-executed'."""
    return url.rstrip("/").rsplit("/", 1)[-1] or "unknown"


# -- Article body parser -------------------------------------------------

JSON_LD_RE = re.compile(
    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
    re.DOTALL,
)
META_RE = re.compile(
    r'<meta[^>]*property="([^"]+)"[^>]*content="([^"]+)"'
)
ENTRY_CONTENT_RE = re.compile(
    r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</article>',
    re.DOTALL,
)
AGE_RE = re.compile(
    r"\b(\d{1,2})[-\s]year[-\s]old\b|\baged\s+(\d{1,2})\b",
    re.IGNORECASE,
)
FARSI_NAME_RE = re.compile(r"[؀-ۿ][؀-ۿ\s]+[؀-ۿ]")


def _parse_iso_published(s: str) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except (ValueError, TypeError):
        return None


def parse_article_body(html: str) -> dict:
    """Extract structured fields from a HRANA article HTML page.

    Returns a dict with optional keys: published_date (date), keywords (list),
    article_section (list), photo_url (str), body_text (str),
    age (int), prison (str), province (str), name_farsi (str),
    main_subject (str — name from JSON-LD keywords).
    """
    out: dict = {}

    # 1. JSON-LD: keywords, articleSection, datePublished, image/thumbnailUrl, headline
    for m in JSON_LD_RE.finditer(html):
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        graph = data.get("@graph") if isinstance(data, dict) else None
        items = graph if isinstance(graph, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("@type") == "Article":
                pub = _parse_iso_published(item.get("datePublished") or "")
                if pub:
                    out["published_date"] = pub
                kws = item.get("keywords")
                if isinstance(kws, list):
                    out["keywords"] = [str(k).strip() for k in kws if str(k).strip()]
                sec = item.get("articleSection")
                if isinstance(sec, list):
                    out["article_section"] = [str(s).strip().lower() for s in sec]
                if not out.get("photo_url"):
                    out["photo_url"] = item.get("thumbnailUrl") or None

    # 2. og: meta fallback
    if "published_date" not in out:
        for prop, val in META_RE.findall(html):
            if prop == "article:published_time":
                pub = _parse_iso_published(val)
                if pub:
                    out["published_date"] = pub
            elif prop == "og:image" and not out.get("photo_url"):
                out["photo_url"] = val

    # 3. Article body text
    body_match = ENTRY_CONTENT_RE.search(html)
    if body_match:
        body_html = body_match.group(1)
        body_text = re.sub(r"<[^>]+>", " ", body_html)
        body_text = re.sub(r"\s+", " ", body_text).strip()
        out["body_text"] = body_text

        # Age extraction from body
        age_m = AGE_RE.search(body_text)
        if age_m:
            try:
                out["age"] = int(age_m.group(1) or age_m.group(2))
            except (TypeError, ValueError):
                pass

        # Farsi name from body (if any Farsi text appears at all)
        fa_m = FARSI_NAME_RE.search(body_text)
        if fa_m:
            out["name_farsi"] = fa_m.group(0).strip()

    # 4. Province + prison from keywords (JSON-LD has these clean).
    # Normalize province spellings to match the DB convention (we already
    # collapsed Isfahan→Esfahan, Bakhtaran→Kermanshah, etc. in the audit pass).
    province_aliases = {
        "Isfahan": "Esfahan",
        "Bakhtaran": "Kermanshah",
        "Azarbayjan-e Gharbi": "Azarbaijan-e Gharbi",
        "West Azarbaijan": "Azarbaijan-e Gharbi",
        "East Azarbaijan": "Azarbaijan-e Sharqi",
        "Sistan and Baluchestan": "Sistan va Baluchestan",
        "Sistan-Baluchestan": "Sistan va Baluchestan",
        "Razavi Khorasan": "Khorasan-e Razavi",
        "Kohgiluyeh and Boyer-Ahmad": "Kohgilouyeh va Boyer Ahmad",
        "Kurdistan": "Kordestan",
    }
    keywords = out.get("keywords") or []
    for kw in keywords:
        if kw in IRANIAN_PROVINCES and not out.get("province"):
            out["province"] = province_aliases.get(kw, kw)
        if "prison" in kw.lower() and not out.get("prison"):
            out["prison"] = kw

    # 5. Main-subject name = the keyword that contains 2+ capitalized words
    # and isn't a place/prison
    for kw in keywords:
        if kw in IRANIAN_PROVINCES or "prison" in kw.lower():
            continue
        if kw.upper() == kw:  # all caps like "HRANA"
            continue
        if kw.count(" ") < 1:
            continue
        out["main_subject"] = kw
        break

    return out


def is_execution_article(parsed: dict) -> bool:
    """True if the article reports a completed execution."""
    sections = parsed.get("article_section") or []
    return "executions" in sections


# -- HTTP --------------------------------------------------------------

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


async def fetch_hrana(url: str, cache_dir: str, retries: int = 3) -> Optional[str]:
    """Fetch via curl_cffi (Chrome120 TLS); use disk cache where present."""
    cached = _read_cached(cache_dir, url)
    if cached is not None:
        return cached
    try:
        from curl_cffi.requests import AsyncSession
    except ImportError:
        log.error("curl_cffi not installed — required for HRANA. pip install curl_cffi")
        return None
    async with AsyncSession(impersonate=CURL_IMPERSONATE) as s:
        for attempt in range(retries):
            try:
                r = await s.get(url, timeout=30)
                if r.status_code == 200:
                    body = r.text
                    await asyncio.sleep(random.uniform(0.5, 1.0))
                    _write_cached(cache_dir, url, body)
                    return body
                if r.status_code == 404:
                    return None  # end of pagination
                if r.status_code == 429 or r.status_code >= 500:
                    await asyncio.sleep(5.0 * (2 ** attempt))
                    continue
                log.warning(f"hrana HTTP {r.status_code} for {url}")
                return None
            except Exception as exc:
                log.warning(f"hrana fetch error attempt {attempt+1}: {exc}")
                await asyncio.sleep(5.0 * (attempt + 1))
    return None


# -- Plugin ------------------------------------------------------------

@register
class HranaPlugin(SourcePlugin):
    """HRANA — source-only enrichment via headline name extraction."""

    @property
    def name(self) -> str:
        return "hrana"

    @property
    def full_name(self) -> str:
        return "HRANA — Human Rights Activists News Agency"

    @property
    def base_url(self) -> str:
        return BASE_URL

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        total_articles = 0
        total_yielded = 0
        articles_to_visit: list[tuple[str, str]] = []  # (url, title) deduplicated
        seen_articles: set[str] = set()

        # Phase 1 — crawl category pages, collect all article URLs
        for category in CATEGORIES:
            cat_articles_start = total_articles
            for page in range(1, MAX_PAGES_PER_CATEGORY + 1):
                url = BASE_URL + category + (f"page/{page}/" if page > 1 else "")
                body = await fetch_hrana(url, cache_dir=self.cache_dir)
                if not body:
                    break

                articles = ARTICLE_LINK_RE.findall(body)
                if not articles:
                    break

                new_on_page = 0
                for article_url, title in articles:
                    if article_url in seen_articles:
                        continue
                    seen_articles.add(article_url)
                    articles_to_visit.append((article_url, title))
                    new_on_page += 1
                    total_articles += 1

                if new_on_page == 0:
                    break
                if page % 10 == 0:
                    log.info(f"hrana[{category}] page {page}: indexed {total_articles} articles")
            log.info(
                f"hrana[{category}] indexed: "
                f"articles+={total_articles - cat_articles_start}"
            )

        log.info(f"hrana phase 1 done: {total_articles} unique articles to fetch")

        # Phase 2 — fetch each article body, parse, yield rich victim records
        for idx, (article_url, title) in enumerate(articles_to_visit):
            slug = slug_from_url(article_url)
            article_html = await fetch_hrana(article_url, cache_dir=self.cache_dir)
            if not article_html:
                continue

            parsed = parse_article_body(article_html)

            # Determine target name(s): JSON-LD main_subject is most reliable,
            # falling back to headline regex.
            primary = parsed.get("main_subject")
            candidates = [primary] if primary else extract_name_candidates(title)
            if not candidates:
                continue

            published = parsed.get("published_date")
            is_execution = is_execution_article(parsed)
            place = parsed.get("prison") or parsed.get("province")

            for name in candidates:
                sid = f"hrana_{slug}_{name.replace(' ', '_').lower()}"
                if self.progress.is_processed(sid):
                    continue

                # Date heuristic: for execution articles, published_date ≈
                # date_of_death (HRANA reports same day or +1).
                date_of_death = published if is_execution else None

                ext = ExternalVictim(
                    source_id=sid,
                    source_name="HRANA",
                    source_url=article_url,
                    source_type="human_rights_org",
                    name_latin=name,
                    name_farsi=parsed.get("name_farsi"),
                    age_at_death=parsed.get("age") if is_execution else None,
                    place_of_death=place if is_execution else None,
                    province=parsed.get("province"),
                    date_of_death=date_of_death,
                    cause_of_death="Execution » Hanging" if is_execution else None,
                    photo_url=parsed.get("photo_url"),
                    circumstances_en=(parsed.get("body_text") or "")[:1500] or None,
                )
                yield ext
                self.progress.mark_processed(sid)
                total_yielded += 1

            if (idx + 1) % 100 == 0:
                log.info(
                    f"hrana phase 2 progress: {idx+1}/{total_articles} articles, "
                    f"{total_yielded} candidates yielded"
                )

        log.info(
            f"hrana TOTAL: articles_indexed={total_articles} candidates_yielded={total_yielded}"
        )
