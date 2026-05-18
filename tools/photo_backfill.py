#!/usr/bin/env python3
"""Multi-source photo backfill for victims since 2022 without photo_url.

For each photoless victim with at least one external source URL, walks
the URLs in priority order (HRANA > Wikipedia > Boroumand > iranrevolution
> witness.report) and tries to extract a portrait image via og:image
or known patterns. Updates victims.photo_url and inserts a photos row
on success.

Cloudflare-aware via curl_cffi (chrome120 TLS impersonation), same as
the witness/hrana enricher plugins.

Run on the server (where DB is local on :5434):
    cd /opt/iran-stack/iran-memorial
    set -a; source .env; set +a
    .venv/bin/python3 tools/photo_backfill.py [--limit N] [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
import sys
import urllib.parse
from typing import Optional

import asyncpg

logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
    level=logging.INFO,
)
log = logging.getLogger("photo_backfill")

# Source priority — first match wins
SOURCE_PRIORITY = [
    ("hrana", lambda u: "en-hrana.org" in u),
    ("wikipedia", lambda u: "wikipedia.org" in u),
    ("iranrevolution", lambda u: "iranrevolution" in u),
    ("witness", lambda u: "witness.report" in u),
    ("boroumand", lambda u: "iranrights.org" in u),
]

OG_IMAGE_RE = re.compile(
    r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']'
)
TWITTER_IMAGE_RE = re.compile(
    r'<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']'
)
# Boroumand pages: /English/persons/<id>.htm with photo in <img class="photo"
BOROUMAND_IMG_RE = re.compile(
    r'<img[^>]*src=["\']([^"\']*persons[^"\']*\.(?:jpg|jpeg|png))["\']',
    re.IGNORECASE,
)
# Wikipedia: infobox image
WIKIPEDIA_INFOBOX_IMG_RE = re.compile(
    r'<table[^>]*class="[^"]*infobox[^"]*"[^>]*>.*?<img[^>]*src="(//upload\.wikimedia\.org[^"]+)"',
    re.DOTALL | re.IGNORECASE,
)


async def fetch_url(url: str) -> Optional[str]:
    """Fetch URL via curl_cffi with Chrome120 impersonation."""
    try:
        from curl_cffi.requests import AsyncSession
    except ImportError:
        log.error("curl_cffi not installed — pip install curl_cffi")
        return None
    async with AsyncSession(impersonate="chrome120") as s:
        try:
            r = await s.get(url, timeout=30)
            if r.status_code == 200:
                return r.text
            log.debug(f"  HTTP {r.status_code} for {url[:80]}")
            return None
        except Exception as exc:
            log.debug(f"  fetch error for {url[:80]}: {exc}")
            return None


def absolutize(url: str, base: str) -> str:
    """Resolve relative URLs against base."""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith(("http://", "https://")):
        return url
    return urllib.parse.urljoin(base, url)


def is_generic_site_image(url_lower: str) -> bool:
    """Reject site-wide defaults that aren't the victim's photo."""
    return any(
        skip in url_lower
        for skip in (
            "logo", "favicon", "default",
            "/flag.", "flag.png", "flag.jpg",  # iranrevolution.online
            "social-share", "og-default",
            "placeholder", "no-image", "no-photo",
            "wp-content/themes/",  # WP theme assets — not subject photos
        )
    )


def extract_photo(html: str, source: str, url: str) -> Optional[str]:
    """Pull a portrait photo URL out of HTML for the given source.

    Source-specific extractors are tried FIRST for sources where og:image
    is known to be a site-global default (iranrevolution.online's og:image
    is always the country flag).
    """
    if not html:
        return None

    # iranrevolution: og:image is global flag — must use record-specific
    # extractor or skip. The Supabase-API plugin already has the photo path,
    # so HTML scraping won't help for past records that didn't have a
    # media.photo at import time. Skip iranrevolution here entirely.
    if source == "iranrevolution":
        return None

    # Source-specific structural extractors (more reliable than og:image)
    if source == "boroumand":
        m = BOROUMAND_IMG_RE.search(html)
        if m:
            return absolutize(m.group(1), url)
    if source == "wikipedia":
        m = WIKIPEDIA_INFOBOX_IMG_RE.search(html)
        if m:
            return absolutize(m.group(1), url)

    # og:image — works for HRANA, witness.report (when fetchable)
    m = OG_IMAGE_RE.search(html)
    if m:
        candidate = absolutize(m.group(1), url)
        if not is_generic_site_image(candidate.lower()):
            return candidate

    # twitter:image fallback
    m = TWITTER_IMAGE_RE.search(html)
    if m:
        candidate = absolutize(m.group(1), url)
        if not is_generic_site_image(candidate.lower()):
            return candidate

    return None


def classify_source(url: str) -> Optional[str]:
    for name, predicate in SOURCE_PRIORITY:
        if predicate(url):
            return name
    return None


def is_per_victim_url(kind: str, url: str, victim_name: str) -> bool:
    """Is this URL a victim-specific page (vs a shared list article)?

    Wikipedia in particular: a hundred Mahsa-Amini-protest victims may
    all link to /wiki/Mahsa_Amini_protests (list article), in which case
    the og:image is the article-level banner — not a per-victim photo.
    A Wikipedia URL is per-victim only if at least one name token is in
    the article slug.
    """
    if kind != "wikipedia":
        return True
    m = re.search(r"/wiki/([^?#]+)", url)
    if not m:
        return False
    article_lower = m.group(1).lower()
    # Hard-skip list / aggregate articles — they share a banner image
    list_markers = ("_protests", "list_of_", "_demonstration", "_killed", "_uprising", "deaths_during", "deaths_in_")
    if any(m in article_lower for m in list_markers):
        return False
    # Require the article slug to contain the LAST name (most distinctive token).
    tokens = [t for t in (victim_name or "").split() if len(t) > 3]
    if not tokens:
        return False
    last = tokens[-1].lower()
    return last in article_lower


async def backfill_one(
    conn: asyncpg.Connection, victim: dict, dry_run: bool
) -> bool:
    """Try to find a photo for one victim. Returns True on success."""
    source_urls = victim["source_urls"] or []
    name = victim.get("name_latin") or ""
    # Order URLs by SOURCE_PRIORITY, skipping per-victim-fail filters
    ordered: list[tuple[str, str]] = []
    for url in source_urls:
        kind = classify_source(url)
        if kind and is_per_victim_url(kind, url, name):
            ordered.append((kind, url))
    ordered.sort(key=lambda x: [n for n, _ in SOURCE_PRIORITY].index(x[0]))

    for kind, url in ordered:
        html = await fetch_url(url)
        photo_url = extract_photo(html or "", kind, url)
        if not photo_url:
            continue
        log.info(f"  ✓ {victim['slug']}: {kind} → {photo_url[:90]}")
        if dry_run:
            return True
        # Update victims.photo_url + insert into photos table
        await conn.execute(
            "UPDATE victims SET photo_url = $2, updated_at = NOW() WHERE id = $1 AND photo_url IS NULL",
            victim["id"], photo_url,
        )
        # Idempotent insert into photos
        await conn.execute(
            """
            INSERT INTO photos (victim_id, url, source_credit, photo_type, is_primary, sort_order)
            SELECT $1, $2, $3, 'portrait',
                   NOT EXISTS (SELECT 1 FROM photos WHERE victim_id = $1),
                   COALESCE((SELECT MAX(sort_order)+1 FROM photos WHERE victim_id = $1), 0)
            WHERE NOT EXISTS (SELECT 1 FROM photos WHERE victim_id = $1 AND url = $2)
            """,
            victim["id"], photo_url, kind,
        )
        return True
    return False


async def main(limit: Optional[int], dry_run: bool):
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        log.error("DATABASE_URL not set in environment")
        sys.exit(1)

    pool = await asyncpg.create_pool(db_url, min_size=1, max_size=4)
    async with pool.acquire() as conn:
        # Filter to records that have at least one *victim-specific* URL.
        # Generic root URLs (iranvictims.com, iranrevolution.online without a
        # path) cannot yield a portrait photo. Only paths with /persons/,
        # /people/, /wiki/, en-hrana article slugs etc. are useful.
        sql = """
        SELECT v.id, v.slug, v.name_latin,
               COALESCE(ARRAY_AGG(s.url) FILTER (WHERE s.url IS NOT NULL), '{}') AS source_urls
        FROM victims v
        JOIN sources s ON s.victim_id = v.id
        WHERE v.date_of_death >= '2022-01-01'::date
          AND v.photo_url IS NULL
          AND (
            s.url LIKE '%iranrights.org/%/memorial/%'
            OR s.url LIKE '%iranrights.org/English/%'
            OR s.url LIKE '%wikipedia.org/wiki/%'
            OR s.url LIKE '%en-hrana.org/%-%'
            OR s.url LIKE '%witness.report/people/%'
          )
        GROUP BY v.id, v.slug, v.name_latin
        ORDER BY v.date_of_death ASC, v.slug
        """
        if limit:
            sql += f" LIMIT {limit}"
        rows = await conn.fetch(sql)
        log.info(f"Loaded {len(rows)} photoless victims since 2022 with source URLs")

        success = 0
        for i, row in enumerate(rows):
            victim = dict(row)
            try:
                if await backfill_one(conn, victim, dry_run):
                    success += 1
            except Exception as exc:
                log.warning(f"  ✗ {victim['slug']}: {exc}")
            if (i + 1) % 50 == 0:
                log.info(f"Progress: {i+1}/{len(rows)}, {success} photos found")
            await asyncio.sleep(0.6)  # rate limit politeness

        log.info(f"Done: {success}/{len(rows)} photos backfilled "
                 f"(dry_run={dry_run})")
    await pool.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(main(args.limit, args.dry_run))
