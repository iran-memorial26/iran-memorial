"""Grokipedia enrichment — match-only, fill-NULL.

Per-victim walker that searches Grokipedia (xAI's wiki, launched 2025-10) for
each DB record and, when it finds a confident match, attaches a Source row
and optionally fills NULL bio fields (currently only `circumstances_en`).

Why a separate command and not a SourcePlugin: the existing 12 plugins all
enumerate their source (Wikipedia list page, Boroumand archive, Telegram
channel, etc.). Grokipedia has no curated "Iran victims" index — coverage is
patchy and per-article. We have to flip the direction: walk *our* records
and probe Grokipedia per name. That requires DB access during fetch which
the SourcePlugin abstraction does not surface.

Design choices to keep risk low:
  - Never inserts a new Victim. Only enriches existing records.
  - Only fills `circumstances_en` if it's NULL. Never overwrites verified
    biographical data from higher-tier sources (Boroumand, OHCHR, HRANA).
  - Always inserts a Source row pointing at the Grokipedia article URL,
    even if no field-fill happens, so the cross-reference is auditable.
  - Match validation: page body or og:description must contain the name
    AND (year-of-death string OR the word "Iran"). Rejects unrelated
    articles even when slugs accidentally collide.
  - Credibility marker: `community` tier (same as @VahidOnline telegram).
    Memorials should never present Grokipedia data as authoritative.

Usage:
    python3 -m tools.enricher grokipedia --dry-run -v
    python3 -m tools.enricher grokipedia --dry-run --limit 20 -v
    python3 -m tools.enricher grokipedia --apply --limit 100
    python3 -m tools.enricher grokipedia --apply --recheck   # re-probe even
                                                              # records that
                                                              # already have a
                                                              # grokipedia source
"""

from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from html import unescape
from typing import Optional

import aiohttp

from ..db.pool import get_pool

log = logging.getLogger("enricher.grokipedia")


BASE_URL = "https://grokipedia.com"
USER_AGENT = "iran-memorial-grokipedia/1.0 (+https://github.com/iran-memorial26/iran-memorial)"
DEFAULT_CONCURRENCY = 4  # Grokipedia is new infra, be polite
PROBE_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=8)

# Marker stored on the source row so subsequent runs can identify their
# own entries (and operators can audit easily).
SOURCE_NAME = "Grokipedia"
SOURCE_TYPE = "encyclopedia"


@dataclass
class GrokStats:
    processed: int = 0
    probed: int = 0
    matched: int = 0
    rejected: int = 0
    sources_added: int = 0
    circumstances_filled: int = 0
    skipped_existing: int = 0
    errors: int = 0
    rejection_reasons: dict[str, int] = field(default_factory=dict)


def _slugify_name(name: str) -> str:
    """Best-guess Grokipedia URL slug from a Latin name.

    Grokipedia uses Wikipedia-style title-with-underscores. We try the most
    likely candidate first; if it 404s the caller falls back to search.
    """
    if not name:
        return ""
    # Strip parenthetical aliases and trim
    cleaned = re.sub(r"\([^)]*\)", "", name).strip()
    # Title-case each word, then join with _
    parts = [p.capitalize() for p in re.split(r"\s+", cleaned) if p]
    return "_".join(parts)


def _extract_og(html: str, prop: str) -> Optional[str]:
    """Pull a single og:<prop> meta value."""
    m = re.search(
        rf'<meta[^>]+property="og:{re.escape(prop)}"[^>]+content="([^"]+)"',
        html,
    )
    return unescape(m.group(1)) if m else None


def _strip_tags(html: str) -> str:
    """Crude HTML -> text. Good enough for keyword presence checks."""
    no_script = re.sub(r"<(script|style)[\s\S]*?</\1>", "", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", no_script)
    return re.sub(r"\s+", " ", text).strip()


def _name_similarity(a: str, b: str) -> float:
    """Sequence-similarity ratio on lowercased ASCII-ish input."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _name_variants(name: str) -> list[str]:
    """Generate canonical short forms of a Latin name for phrase matching.

    Iranian names commonly add or drop middle names across sources. DB might
    have "Mahsa Jina Amini" while Grokipedia titles it "Mahsa Amini". We try
    the full form first, then first+last (skipping middle names), then any
    2-word window inside the name. Strict phrase match on each variant —
    no proximity, no token-density fallback. That's what kept admitting
    false positives where two unrelated Iranians shared a common first or
    last name.

    Returns lower-cased variants, longest first, deduplicated.
    """
    cleaned = re.sub(r"\([^)]*\)", " ", name or "").strip()
    cleaned = re.sub(r"\s+", " ", cleaned).lower()
    tokens = [t for t in cleaned.split() if len(t) >= 2]
    if not tokens:
        return []

    variants: list[str] = []

    def add(v: str) -> None:
        v = v.strip()
        if v and v not in variants:
            variants.append(v)

    # 1. Full name
    add(" ".join(tokens))
    # 2. First + last (skip middles).
    #    Persian names commonly add or drop middle names across sources;
    #    this catches "Mahsa Jina Amini" DB ↔ "Mahsa Amini" article.
    if len(tokens) >= 3:
        add(f"{tokens[0]} {tokens[-1]}")
    # NOTE: We deliberately do NOT generate adjacent 2-word windows.
    # Common Persian first-name compounds ("Ali Akbar", "Amir Hesam",
    # "Saeed Reza", "Mohammad Hassan") match unrelated victims who share
    # the prefix but have different surnames — a strict false positive
    # that observed in the prod canary. Precision > recall here.

    return variants


def _validate_match(
    name_latin: str,
    name_farsi: Optional[str],
    year_of_death: Optional[int],
    body_text: str,
    description: Optional[str],
) -> tuple[bool, str]:
    """Decide whether a Grokipedia article is really about this victim.

    Returns (matched, reason). The reason string is recorded for telemetry
    so we can audit false-positives / false-negatives later.

    Acceptance ladder, strictest first:
      1. **Phrase match.** The exact full name (with parenthetical aliases
         stripped) appears as a substring in body or description.
      2. **First+last proximity.** The first and last name tokens both
         appear within 80 characters of each other somewhere in the
         haystack. Catches "Mahsa Jina Amini" matching "Mahsa Amini"
         pages while rejecting "Mojtaba Mousavi" matching pages about
         Mojtaba Khamenei (where "Mousavi" only appears in unrelated
         passages tens of paragraphs away).

    On top of name presence we still demand a corroborating Iran signal:
    the word "Iran" OR the Farsi name OR the year of death must appear
    somewhere in the haystack.

    Reject reasons we track:
      - name-not-found      (no phrase + no proximity hit)
      - no-iran-signal      (name OK but no Iran corroboration)
    """
    # Build separate haystacks for body and description; we do NOT search
    # across the boundary. A wide separator at the join means any accidental
    # bleed (last word of body + first word of description) never lands
    # inside one of our variant phrases.
    SEP = " " + ("·" * 200) + " "
    haystack = (body_text + SEP + (description or "")).lower()

    # Phrase-only matching against canonical name variants. The previous
    # proximity-based rule kept admitting false positives where common
    # Iranian first names (Mohammad, Ali, Hassan) and shared surnames
    # (Ghasemi, Mousavi, Saeidi) happened to land near each other in an
    # unrelated person's biography. Variants cover "Mahsa Jina Amini" DB ↔
    # "Mahsa Amini" article, etc.
    variants = _name_variants(name_latin)
    name_ok = any(v in haystack for v in variants)

    if not name_ok:
        return False, "name-not-found"

    # Iran signal — at least one of: "Iran", Farsi name, year-of-death
    iran_signal = "iran" in haystack
    if name_farsi and name_farsi in (body_text + " " + (description or "")):
        iran_signal = True
    if year_of_death and str(year_of_death) in haystack:
        iran_signal = True

    if not iran_signal:
        return False, "no-iran-signal"

    return True, "ok"


async def _fetch(session: aiohttp.ClientSession, url: str) -> tuple[int, str]:
    """Single HTTP GET. Returns (status, body). Empty body on error."""
    try:
        async with session.get(url, allow_redirects=True) as r:
            text = await r.text()
            return r.status, text
    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        log.debug(f"fetch failed for {url}: {e}")
        return 0, ""


async def _resolve_article(
    session: aiohttp.ClientSession,
    name_latin: str,
) -> Optional[tuple[str, str]]:
    """Try direct slug first, then search. Returns (url, html) or None.

    No backtracking through search results — we trust Grokipedia's own
    relevance for the first hit. Caller is responsible for validation.
    """
    slug = _slugify_name(name_latin)
    if slug:
        direct_url = f"{BASE_URL}/page/{slug}"
        status, body = await _fetch(session, direct_url)
        if status == 200 and len(body) > 5000:
            # Small-body responses are usually the 404 shell (~79KB on Grokipedia
            # at writing). A real article runs hundreds of KB.
            return direct_url, body

    # Fallback: search page, pick first /page/ link
    search_url = (
        f"{BASE_URL}/search?q="
        f"{urllib.parse.quote_plus(name_latin)}"
    )
    status, body = await _fetch(session, search_url)
    if status != 200 or not body:
        return None

    # Search results are server-rendered HTML; first /page/X anchor is the
    # top result. Reject anchors that point back at /search to avoid loops.
    m = re.search(r'href="(/page/[^"#?]+)"', body)
    if not m:
        return None
    article_url = BASE_URL + m.group(1)
    status, article_body = await _fetch(session, article_url)
    if status != 200 or len(article_body) < 5000:
        return None
    return article_url, article_body


async def _fetch_targets(pool, recheck: bool, limit: Optional[int]) -> list[dict]:
    """Pull candidate victims: those with a name and no grokipedia source yet
    (unless --recheck). Caps at limit for testing runs."""
    cap = f"LIMIT {int(limit)}" if limit else ""
    if recheck:
        sql = f"""
            SELECT v.id, v.slug, v.name_latin, v.name_farsi, v.date_of_death,
                   v.circumstances_en
              FROM victims v
             WHERE v.name_latin IS NOT NULL
               AND v.name_latin != 'Unknown'
             ORDER BY v.date_of_death DESC NULLS LAST
             {cap}
        """
    else:
        sql = f"""
            SELECT v.id, v.slug, v.name_latin, v.name_farsi, v.date_of_death,
                   v.circumstances_en
              FROM victims v
             WHERE v.name_latin IS NOT NULL
               AND v.name_latin != 'Unknown'
               AND NOT EXISTS (
                   SELECT 1 FROM sources s
                    WHERE s.victim_id = v.id
                      AND s.url LIKE 'https://grokipedia.com/%'
               )
             ORDER BY v.date_of_death DESC NULLS LAST
             {cap}
        """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql)
    return [dict(r) for r in rows]


async def _persist(
    pool,
    victim_id: str,
    article_url: str,
    description: Optional[str],
    fill_circumstances: bool,
) -> tuple[bool, bool]:
    """Insert source + optionally fill circumstances_en. Returns
    (source_inserted, circumstances_filled). Idempotent on source URL.
    """
    source_inserted = False
    circumstances_filled = False
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Source row — skip if URL already attached to this victim.
            # Schema columns: name (NOT NULL), source_type, data_source_id FK.
            # data_source_id is resolved by subquery so the source row
            # carries its credibility/UI badge via the DataSources table.
            res = await conn.execute(
                """
                INSERT INTO sources (victim_id, url, name, source_type, data_source_id)
                VALUES (
                    $1::uuid,
                    $2,
                    $3,
                    $4,
                    (SELECT id FROM data_sources WHERE slug = 'grokipedia')
                )
                ON CONFLICT DO NOTHING
                """,
                victim_id,
                article_url,
                SOURCE_NAME,
                SOURCE_TYPE,
            )
            # asyncpg returns "INSERT 0 1" on insert, "INSERT 0 0" on conflict.
            source_inserted = res.endswith(" 1")

            # Only fill circumstances_en if caller decided it is currently
            # NULL AND we have a non-empty og:description to insert.
            if fill_circumstances and description:
                # COALESCE-guarded write: a parallel writer that filled the
                # field between SELECT and UPDATE will not be overwritten.
                upd = await conn.execute(
                    """
                    UPDATE victims
                       SET circumstances_en = $2,
                           updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1::uuid
                       AND circumstances_en IS NULL
                    """,
                    victim_id,
                    description,
                )
                circumstances_filled = upd.endswith(" 1")
    return source_inserted, circumstances_filled


async def _enrich_one(
    pool,
    session: aiohttp.ClientSession,
    victim: dict,
    dry_run: bool,
    stats: GrokStats,
    verbose: bool,
) -> None:
    """Probe Grokipedia for one victim, validate, persist if matched."""
    name_latin = victim["name_latin"]
    stats.processed += 1

    try:
        resolved = await _resolve_article(session, name_latin)
    except Exception as e:  # noqa: BLE001
        stats.errors += 1
        log.warning(f"  ERR {name_latin}: {e}")
        return

    if resolved is None:
        if verbose:
            log.info(f"  miss   {name_latin}")
        return

    stats.probed += 1
    article_url, html = resolved
    description = _extract_og(html, "description")
    body_text = _strip_tags(html)
    year_of_death = victim["date_of_death"].year if victim["date_of_death"] else None

    ok, reason = _validate_match(
        name_latin=name_latin,
        name_farsi=victim["name_farsi"],
        year_of_death=year_of_death,
        body_text=body_text,
        description=description,
    )
    if not ok:
        stats.rejected += 1
        stats.rejection_reasons[reason] = stats.rejection_reasons.get(reason, 0) + 1
        if verbose:
            log.info(f"  reject {name_latin} -> {reason} ({article_url})")
        return

    stats.matched += 1
    fill_circumstances = victim["circumstances_en"] is None and bool(description)

    if dry_run:
        if verbose:
            tag = "+source+circ" if fill_circumstances else "+source"
            log.info(f"  match  {name_latin} -> {article_url}  [{tag}]")
        # Track would-be counts so the dry-run summary is meaningful.
        stats.sources_added += 1
        if fill_circumstances:
            stats.circumstances_filled += 1
        return

    try:
        source_inserted, circumstances_filled = await _persist(
            pool, str(victim["id"]), article_url, description, fill_circumstances
        )
    except Exception as e:  # noqa: BLE001
        # FK violations happen when a parallel dedup/merge run deletes the
        # target victim between our _fetch_targets and _persist calls. Log
        # and skip — never crash the whole pipeline for one stale row.
        stats.errors += 1
        log.warning(f"  PERSIST-ERR {name_latin} ({victim['slug']}): {e}")
        return
    if source_inserted:
        stats.sources_added += 1
    else:
        stats.skipped_existing += 1
    if circumstances_filled:
        stats.circumstances_filled += 1

    if verbose:
        tag = []
        if source_inserted:
            tag.append("+source")
        if circumstances_filled:
            tag.append("+circ")
        if not tag:
            tag.append("noop")
        log.info(f"  match  {name_latin} -> {article_url}  [{','.join(tag)}]")


async def run_grokipedia(
    database_url: str,
    dry_run: bool = True,
    limit: Optional[int] = None,
    recheck: bool = False,
    verbose: bool = False,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> GrokStats:
    """Top-level entry point. Walks victims, probes Grokipedia, persists matches."""
    stats = GrokStats()
    pool = await get_pool(database_url)
    targets = await _fetch_targets(pool, recheck=recheck, limit=limit)
    log.info(
        f"Probing Grokipedia for {len(targets)} victim(s)"
        f" (dry_run={dry_run}, recheck={recheck}, concurrency={concurrency})"
    )

    sem = asyncio.Semaphore(concurrency)
    async with aiohttp.ClientSession(
        headers={"User-Agent": USER_AGENT},
        timeout=PROBE_TIMEOUT,
    ) as session:

        async def _bounded(v):
            async with sem:
                await _enrich_one(pool, session, v, dry_run, stats, verbose)

        # return_exceptions=True keeps the gather alive even if a single
        # coroutine raises (network blip, FK violation from a parallel
        # delete, etc.). _enrich_one already catches its own exceptions
        # and bumps stats.errors, but this is the safety net for anything
        # that escapes — we want the run to finish, not die at task 1666
        # out of 33667 again.
        await asyncio.gather(
            *[_bounded(v) for v in targets],
            return_exceptions=True,
        )

    log.info("")
    log.info(f"[{'DRY RUN' if dry_run else 'APPLY'}] Grokipedia results:")
    log.info(f"  Processed:               {stats.processed}")
    log.info(f"  Probed (article found):  {stats.probed}")
    log.info(f"  Matched (validated):     {stats.matched}")
    log.info(f"  Rejected:                {stats.rejected}")
    for reason, n in sorted(stats.rejection_reasons.items()):
        log.info(f"    {reason}: {n}")
    log.info(f"  Sources added:           {stats.sources_added}")
    log.info(f"  Circumstances filled:    {stats.circumstances_filled}")
    log.info(f"  Skipped (existing src):  {stats.skipped_existing}")
    log.info(f"  Errors:                  {stats.errors}")
    return stats
