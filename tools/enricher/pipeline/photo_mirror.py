"""Photo mirror — download external photo URLs to local disk.

After mirroring, the row's URL is rewritten to ``/photos/<id>/<id>.<ext>``
(served by the Next.js app from PHOTO_STORE) and the external URL is preserved
in ``original_url`` for archival and re-mirror.

Two tables are mirrored:
- ``photos.url``         → ``photos.original_url`` + new ``photos.url``
- ``victims.photo_url``  → ``victims.photo_original_url`` + new ``victims.photo_url``

Files land under PHOTO_STORE in shards by id-prefix to avoid 30k files in one
directory: ``{store}/{aa}/{id}.{ext}``.

Usage:
    python3 -m tools.enricher photo-mirror --dry-run
    python3 -m tools.enricher photo-mirror --apply --limit 100      # canary
    python3 -m tools.enricher photo-mirror --apply                  # full
    python3 -m tools.enricher photo-mirror --apply --legacy-only    # victims col only
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import pathlib
from dataclasses import dataclass, field
from typing import Iterable, Tuple

import aiohttp

from ..db.pool import get_pool
from .photo_audit import is_blocked

log = logging.getLogger("enricher.photo_mirror")

# Defaults — overridable via CLI.
DEFAULT_CONCURRENCY = 16
PER_HOST_CONCURRENCY = 4
DOWNLOAD_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=10)
MAX_BYTES = 25 * 1024 * 1024  # 25 MB hard cap per file
USER_AGENT = "iran-memorial-mirror/1.0 (+https://github.com/iran-memorial26/iran-memorial)"

# Mime → ext mapping for files where the URL has no extension. The DB stores
# whatever extension we pick here, so keep it deterministic.
EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
}
ALLOWED_EXTS = set(EXT_BY_MIME.values())


@dataclass
class MirrorStats:
    photos_checked: int = 0
    photos_mirrored: int = 0
    photos_skipped_local: int = 0
    photos_failed: int = 0
    photos_blocked: int = 0
    legacy_checked: int = 0
    legacy_mirrored: int = 0
    legacy_failed: int = 0
    legacy_blocked: int = 0
    bytes_written: int = 0


def _sha256_file(path: pathlib.Path) -> str | None:
    """SHA-256 of a small image file. Stream to keep memory bounded even
    when MAX_BYTES creeps up over time."""
    try:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def _safe_ext(url: str, content_type: str | None) -> str:
    """Pick an image extension we trust. Prefer URL hint, fall back to mime."""
    url_ext = os.path.splitext(url.split("?")[0])[1].lower()
    if url_ext in ALLOWED_EXTS:
        return url_ext
    if content_type:
        primary = content_type.split(";")[0].strip().lower()
        if primary in EXT_BY_MIME:
            return EXT_BY_MIME[primary]
    return ".jpg"  # last-resort default


def _target_path(store: pathlib.Path, row_id: str, ext: str) -> Tuple[pathlib.Path, str]:
    """Return (absolute_path, relative_path_for_url)."""
    rid = row_id.lower().replace("-", "")
    shard = rid[:2]
    rel = f"{shard}/{rid}{ext}"
    return store / rel, rel


async def _download_one(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    url: str,
    dest: pathlib.Path,
) -> Tuple[bool, int, str | None]:
    """Return (ok, bytes_written, content_type_or_none)."""
    async with sem:
        try:
            async with session.get(
                url, allow_redirects=True, timeout=DOWNLOAD_TIMEOUT
            ) as r:
                if r.status >= 400:
                    return False, 0, None
                ctype = r.headers.get("content-type")
                # Stream to a temp file in the same dir so the rename is atomic.
                dest.parent.mkdir(parents=True, exist_ok=True)
                tmp = dest.with_suffix(dest.suffix + ".part")
                size = 0
                with open(tmp, "wb") as f:
                    async for chunk in r.content.iter_chunked(64 * 1024):
                        size += len(chunk)
                        if size > MAX_BYTES:
                            f.close()
                            tmp.unlink(missing_ok=True)
                            return False, 0, None
                        f.write(chunk)
                if size == 0:
                    tmp.unlink(missing_ok=True)
                    return False, 0, None
                os.replace(tmp, dest)
                return True, size, ctype
        except (asyncio.TimeoutError, aiohttp.ClientError, OSError):
            return False, 0, None


async def _fetch_photo_targets(pool, limit: int | None) -> list[tuple[str, str]]:
    """photos rows that still hold an external URL and aren't broken."""
    sql = """
        SELECT id::text, url
        FROM photos
        WHERE is_broken = FALSE
          AND original_url IS NULL
          AND url LIKE 'http%'
        ORDER BY created_at DESC
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql)
    return [(r["id"], r["url"]) for r in rows]


async def _fetch_legacy_targets(pool, limit: int | None) -> list[tuple[str, str]]:
    """victims rows with non-null photo_url that hasn't been mirrored yet."""
    sql = """
        SELECT id::text, photo_url
        FROM victims
        WHERE photo_url LIKE 'http%'
          AND photo_original_url IS NULL
        ORDER BY created_at DESC
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql)
    return [(r["id"], r["photo_url"]) for r in rows]


async def _apply_photo_updates(
    pool,
    updates: Iterable[tuple[str, str, str]],  # (id, new_url, original_url)
) -> None:
    rows = list(updates)
    if not rows:
        return
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            UPDATE photos
               SET url = $2,
                   original_url = $3
             WHERE id = $1::uuid
            """,
            rows,
        )


async def _apply_legacy_updates(
    pool,
    updates: Iterable[tuple[str, str, str]],
) -> None:
    rows = list(updates)
    if not rows:
        return
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            UPDATE victims
               SET photo_url = $2,
                   photo_original_url = $3
             WHERE id = $1::uuid
            """,
            rows,
        )


async def _mirror_batch(
    pool,
    targets: list[tuple[str, str]],
    store: pathlib.Path,
    concurrency: int,
) -> tuple[list[tuple[str, str, str, int]], int]:
    """Returns (results, blocked_count) where results = (id, new_url, orig, bytes)."""
    if not targets:
        return [], 0
    sem = asyncio.Semaphore(concurrency)
    connector = aiohttp.TCPConnector(limit_per_host=PER_HOST_CONCURRENCY, ssl=False)
    results: list[tuple[str, str, str, int]] = []
    blocked = 0
    async with aiohttp.ClientSession(
        connector=connector, headers={"User-Agent": USER_AGENT}
    ) as session:
        async def one(row_id: str, url: str):
            ext = _safe_ext(url, None)
            dest, rel = _target_path(store, row_id, ext)
            ok, size, ctype = await _download_one(session, sem, url, dest)
            if not ok:
                return None
            # If we picked the wrong ext (e.g. URL had .jpg but server says
            # png), rename to match the actual content-type.
            real_ext = _safe_ext(url, ctype)
            final_dest = dest
            if real_ext != ext:
                new_dest, new_rel = _target_path(store, row_id, real_ext)
                try:
                    os.replace(dest, new_dest)
                    rel = new_rel
                    final_dest = new_dest
                except OSError:
                    pass
            # Blocklist check: refuse to persist if SHA-256 is on bad_photo_hashes.
            sha = _sha256_file(final_dest)
            if sha and await is_blocked(pool, sha):
                try:
                    final_dest.unlink()
                except OSError:
                    pass
                log.info("BLOCKED %s — sha256 %s on blocklist, skipping", url, sha[:12])
                return ("__blocked__",)
            return (row_id, f"/photos/{rel}", url, size)

        tasks = [asyncio.create_task(one(rid, u)) for rid, u in targets]
        for i, fut in enumerate(asyncio.as_completed(tasks), 1):
            r = await fut
            if r and r[0] == "__blocked__":
                blocked += 1
            elif r:
                results.append(r)
            if i % 100 == 0:
                log.info("  ... %d/%d mirrored", i, len(targets))
    return results, blocked


async def run_photo_mirror(
    database_url: str,
    *,
    dry_run: bool = True,
    limit: int | None = None,
    concurrency: int = DEFAULT_CONCURRENCY,
    photo_store: str | None = None,
    photos_only: bool = False,
    legacy_only: bool = False,
) -> MirrorStats:
    store = pathlib.Path(photo_store or os.environ.get("PHOTO_STORE", "/var/photos"))
    store.mkdir(parents=True, exist_ok=True)
    pool = await get_pool(database_url)
    stats = MirrorStats()

    if not legacy_only:
        photo_targets = await _fetch_photo_targets(pool, limit)
        log.info("photos: %d to mirror (dry_run=%s)", len(photo_targets), dry_run)
        stats.photos_checked = len(photo_targets)
        results, blocked = await _mirror_batch(pool, photo_targets, store, concurrency)
        stats.photos_mirrored = len(results)
        stats.photos_blocked = blocked
        stats.photos_failed = stats.photos_checked - stats.photos_mirrored - blocked
        stats.bytes_written += sum(r[3] for r in results)
        if not dry_run:
            await _apply_photo_updates(
                pool, [(rid, new_url, orig) for rid, new_url, orig, _ in results]
            )

    if not photos_only:
        legacy_targets = await _fetch_legacy_targets(pool, limit)
        log.info("legacy: %d to mirror (dry_run=%s)", len(legacy_targets), dry_run)
        stats.legacy_checked = len(legacy_targets)
        results, blocked = await _mirror_batch(pool, legacy_targets, store, concurrency)
        stats.legacy_mirrored = len(results)
        stats.legacy_blocked = blocked
        stats.legacy_failed = stats.legacy_checked - stats.legacy_mirrored - blocked
        stats.bytes_written += sum(r[3] for r in results)
        if not dry_run:
            await _apply_legacy_updates(
                pool, [(rid, new_url, orig) for rid, new_url, orig, _ in results]
            )

    return stats
