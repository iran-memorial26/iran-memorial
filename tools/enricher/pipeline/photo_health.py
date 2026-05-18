"""Photo URL health-check.

HEAD-checks every photo URL in the DB and marks broken ones (4xx/5xx, timeout,
DNS error) so the frontend can filter them out instead of rendering broken-image
fallbacks.

Pattern: Telegram public-CDN URLs (cdn*.telesco.pe) expire after a few months;
that's the dominant source of breakage. Other domains (storage.googleapis.com,
iranrights.org, witness.report) are stable.

Usage:
    python3 -m tools.enricher photo-health --dry-run -v
    python3 -m tools.enricher photo-health --apply
    python3 -m tools.enricher photo-health --apply --recheck-broken   # re-test known-broken
    python3 -m tools.enricher photo-health --apply --domain telesco.pe  # restrict to one host
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Iterable

import aiohttp

from ..db.pool import get_pool

log = logging.getLogger("enricher.photo_health")


# Per-host concurrency cap — Telegram CDN rate-limits aggressively.
DEFAULT_CONCURRENCY = 32
PER_HOST_CONCURRENCY = 4
HEAD_TIMEOUT = aiohttp.ClientTimeout(total=10, connect=5)
USER_AGENT = "iran-memorial-photo-health/1.0 (+https://github.com/iran-memorial26/iran-memorial)"


@dataclass
class HealthStats:
    checked: int = 0
    ok: int = 0
    newly_broken: int = 0
    still_broken: int = 0
    recovered: int = 0
    errors: int = 0
    by_status: dict[int, int] = field(default_factory=dict)
    legacy_checked: int = 0
    legacy_nulled: int = 0


async def _check_one(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    photo_id: str,
    url: str,
) -> tuple[str, int | None, bool]:
    """Return (photo_id, status_code_or_None, is_broken)."""
    async with sem:
        try:
            async with session.head(url, allow_redirects=True, timeout=HEAD_TIMEOUT) as r:
                status = r.status
            # Some CDNs return 405 on HEAD but 200 on GET — fall back.
            if status in (403, 405):
                async with session.get(
                    url, allow_redirects=True, timeout=HEAD_TIMEOUT,
                    headers={"Range": "bytes=0-0"},
                ) as r:
                    status = r.status
            return photo_id, status, status >= 400
        except asyncio.TimeoutError:
            return photo_id, None, True
        except aiohttp.ClientError:
            return photo_id, None, True


async def _fetch_targets(
    pool, domain: str | None, recheck_broken: bool, limit: int | None
) -> list[tuple[str, str, bool]]:
    """Return (id, url, was_broken) tuples to check."""
    where = ["url LIKE 'http%'"]  # mirrored URLs start with /photos/, skip
    args: list = []
    if not recheck_broken:
        where.append("is_broken = FALSE")
    if domain:
        args.append(f"%{domain}%")
        where.append(f"url LIKE ${len(args)}")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    limit_sql = f"LIMIT {int(limit)}" if limit else ""
    sql = f"""
        SELECT id::text, url, is_broken
        FROM photos
        {where_sql}
        ORDER BY last_checked_at NULLS FIRST, created_at DESC
        {limit_sql}
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return [(r["id"], r["url"], r["is_broken"]) for r in rows]


async def _apply_results(
    pool, results: Iterable[tuple[str, int | None, bool]], dry_run: bool
) -> None:
    if dry_run:
        return
    rows = [(pid, status, broken) for pid, status, broken in results]
    if not rows:
        return
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            UPDATE photos
               SET is_broken = $3,
                   last_status_code = $2,
                   last_checked_at = NOW()
             WHERE id = $1::uuid
            """,
            rows,
        )


async def _check_legacy_photo_urls(
    pool, domain: str | None, dry_run: bool
) -> tuple[int, int]:
    """Test victims.photo_url (legacy column, separate from photos table) and
    NULL out broken ones. Returns (checked, nulled).
    """
    where_sql = "WHERE photo_url LIKE 'http%'"  # skip mirrored /photos/ paths
    args: list = []
    if domain:
        args.append(f"%{domain}%")
        where_sql += f" AND photo_url LIKE ${len(args)}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT id::text, photo_url FROM victims {where_sql}", *args
        )
    if not rows:
        return 0, 0

    sem = asyncio.Semaphore(DEFAULT_CONCURRENCY)
    connector = aiohttp.TCPConnector(limit_per_host=PER_HOST_CONCURRENCY, ssl=False)
    broken_ids: list[str] = []
    async with aiohttp.ClientSession(
        connector=connector, headers={"User-Agent": USER_AGENT}
    ) as session:
        async def one(vid: str, url: str):
            _, _, broken = await _check_one(session, sem, vid, url)
            if broken:
                broken_ids.append(vid)
        await asyncio.gather(*[one(r["id"], r["photo_url"]) for r in rows])

    if not dry_run and broken_ids:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE victims SET photo_url = NULL WHERE id = ANY($1::uuid[])",
                broken_ids,
            )
    return len(rows), len(broken_ids)


async def run_photo_health(
    database_url: str,
    *,
    dry_run: bool = True,
    domain: str | None = None,
    recheck_broken: bool = False,
    limit: int | None = None,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> HealthStats:
    pool = await get_pool(database_url)
    targets = await _fetch_targets(pool, domain, recheck_broken, limit)
    log.info("Checking %d photo URLs (dry_run=%s)", len(targets), dry_run)

    stats = HealthStats()
    if not targets:
        return stats

    sem = asyncio.Semaphore(concurrency)
    connector = aiohttp.TCPConnector(limit_per_host=PER_HOST_CONCURRENCY, ssl=False)

    results: list[tuple[str, int | None, bool]] = []
    async with aiohttp.ClientSession(
        connector=connector, headers={"User-Agent": USER_AGENT}
    ) as session:
        coros = [_check_one(session, sem, pid, url) for pid, url, _ in targets]
        for fut in asyncio.as_completed(coros):
            pid, status, broken = await fut
            results.append((pid, status, broken))
            stats.checked += 1
            if status is not None:
                stats.by_status[status] = stats.by_status.get(status, 0) + 1
            if broken:
                stats.errors += 1 if status is None else 0
            if stats.checked % 200 == 0:
                log.info("  ... %d/%d checked", stats.checked, len(targets))

    # Diff against previous state for stats
    was_broken_map = {pid: was for pid, _url, was in targets}
    for pid, _status, broken in results:
        was = was_broken_map.get(pid, False)
        if broken and not was:
            stats.newly_broken += 1
        elif broken and was:
            stats.still_broken += 1
        elif not broken and was:
            stats.recovered += 1
        else:
            stats.ok += 1

    await _apply_results(pool, results, dry_run)

    # Also sweep the legacy victims.photo_url column.
    legacy_checked, legacy_nulled = await _check_legacy_photo_urls(pool, domain, dry_run)
    stats.legacy_checked = legacy_checked
    stats.legacy_nulled = legacy_nulled
    return stats
