"""Photo audit + blocklist management.

Two responsibilities:

1. **Audit**: find every photo `content_hash` that is attached to MORE than
   one distinct victim. Same content on multiple victims is almost always a
   bad photo-mirror match (e.g. a generic protest image mis-attached to many
   profiles). Operators review the output and pick blocklist candidates.

2. **Blocklist management**: add / remove / list entries in
   `bad_photo_hashes`. Adding a hash also nukes every existing Photo row + on-
   disk file that references it.

Run via:

    python3 -m tools.enricher photo-audit
    python3 -m tools.enricher photo-audit --json > /tmp/photo-collisions.json

    python3 -m tools.enricher photo-block 5c96e08...  \
        --reason "generic protest image mis-attached"

    python3 -m tools.enricher photo-blocklist        # list current entries
    python3 -m tools.enricher photo-unblock 5c96e08...
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import pathlib
from dataclasses import dataclass, field
from typing import Sequence

from ..db.pool import get_pool


log = logging.getLogger("enricher")


@dataclass
class AuditStats:
    """Counts surfaced after a single audit run."""

    distinct_hashes: int = 0
    colliding_hashes: int = 0
    total_collision_rows: int = 0
    blocklist_size: int = 0


@dataclass
class CollisionGroup:
    """One sha256 that appears on >1 victim — i.e. a candidate to block."""

    sha256: str
    victim_count: int
    photo_count: int
    sample_victims: list[dict] = field(default_factory=list)
    on_blocklist: bool = False


# --------------------------------------------------------------------------
# Audit: find content-hash collisions across victims
# --------------------------------------------------------------------------

_AUDIT_SQL = """
WITH grouped AS (
    SELECT
        p.content_hash,
        COUNT(DISTINCT p.victim_id) AS victim_count,
        COUNT(*)                    AS photo_count
    FROM photos p
    WHERE p.content_hash IS NOT NULL
      AND p.victim_id    IS NOT NULL
    GROUP BY p.content_hash
    HAVING COUNT(DISTINCT p.victim_id) > 1
)
SELECT g.content_hash,
       g.victim_count,
       g.photo_count,
       (SELECT json_agg(json_build_object(
                    'slug',      v.slug,
                    'name_latin', v.name_latin,
                    'name_farsi', v.name_farsi,
                    'photo_url',  p2.url
                ))
          FROM photos p2
          JOIN victims v ON v.id = p2.victim_id
         WHERE p2.content_hash = g.content_hash
         LIMIT 10
       ) AS sample,
       EXISTS (SELECT 1 FROM bad_photo_hashes b WHERE b.sha256 = g.content_hash) AS on_blocklist
FROM grouped g
ORDER BY g.victim_count DESC, g.photo_count DESC
"""


async def _audit_collisions(pool) -> list[CollisionGroup]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(_AUDIT_SQL)
    out: list[CollisionGroup] = []
    for r in rows:
        sample_raw = r["sample"]
        if isinstance(sample_raw, str):
            sample = json.loads(sample_raw)
        else:
            sample = sample_raw or []
        out.append(
            CollisionGroup(
                sha256=r["content_hash"],
                victim_count=int(r["victim_count"]),
                photo_count=int(r["photo_count"]),
                sample_victims=sample,
                on_blocklist=bool(r["on_blocklist"]),
            )
        )
    return out


async def _audit_stats(pool, collisions: Sequence[CollisionGroup]) -> AuditStats:
    async with pool.acquire() as conn:
        distinct = await conn.fetchval(
            "SELECT COUNT(DISTINCT content_hash) FROM photos WHERE content_hash IS NOT NULL"
        )
        blocklist_size = await conn.fetchval("SELECT COUNT(*) FROM bad_photo_hashes")
    return AuditStats(
        distinct_hashes=int(distinct or 0),
        colliding_hashes=len(collisions),
        total_collision_rows=sum(c.photo_count for c in collisions),
        blocklist_size=int(blocklist_size or 0),
    )


async def run_photo_audit(database_url: str, *, as_json: bool = False) -> AuditStats:
    pool = await get_pool(database_url)
    collisions = await _audit_collisions(pool)
    stats = await _audit_stats(pool, collisions)

    if as_json:
        print(
            json.dumps(
                {
                    "stats": {
                        "distinct_hashes":      stats.distinct_hashes,
                        "colliding_hashes":     stats.colliding_hashes,
                        "total_collision_rows": stats.total_collision_rows,
                        "blocklist_size":       stats.blocklist_size,
                    },
                    "collisions": [
                        {
                            "sha256":        c.sha256,
                            "victim_count":  c.victim_count,
                            "photo_count":   c.photo_count,
                            "on_blocklist":  c.on_blocklist,
                            "sample":        c.sample_victims,
                        }
                        for c in collisions
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return stats

    # Human-readable
    log.info(
        "Photo audit — %d distinct content-hashes, %d are on >1 victim, %d photo rows total in collisions, %d on blocklist",
        stats.distinct_hashes,
        stats.colliding_hashes,
        stats.total_collision_rows,
        stats.blocklist_size,
    )
    if not collisions:
        log.info("✓ No collisions found.")
        return stats

    for c in collisions[:50]:
        flag = "  [BLOCKED]" if c.on_blocklist else ""
        log.info(
            "\n  %s%s\n    %d victims · %d photo rows",
            c.sha256,
            flag,
            c.victim_count,
            c.photo_count,
        )
        for v in c.sample_victims[:5]:
            log.info(
                "      → %s  (%s%s)",
                v.get("slug"),
                v.get("name_latin"),
                f" / {v['name_farsi']}" if v.get("name_farsi") else "",
            )
    if len(collisions) > 50:
        log.info("\n  ... %d more collisions truncated. Use --json for full output.", len(collisions) - 50)

    log.info(
        "\nReview the list above and run:\n  python3 -m tools.enricher photo-block <sha256> --reason '...'\nto block + retroactively delete each bad hash."
    )
    return stats


# --------------------------------------------------------------------------
# Blocklist management — add/remove/list + retroactive cleanup
# --------------------------------------------------------------------------

async def _photos_referencing_hash(pool, sha256: str) -> list[tuple[str, str]]:
    """Return (photo_id, url) for every Photo row with the given content_hash."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id::text, url FROM photos WHERE content_hash = $1",
            sha256,
        )
    return [(r["id"], r["url"]) for r in rows]


async def _files_for_sha256(pool, sha256: str, photo_store: pathlib.Path) -> list[pathlib.Path]:
    """Resolve every on-disk file whose URL is referenced by photos with this
    content-hash. Returns paths that exist on disk."""
    pairs = await _photos_referencing_hash(pool, sha256)
    paths: list[pathlib.Path] = []
    for _id, url in pairs:
        if not url or not url.startswith("/photos/"):
            continue
        rel = url[len("/photos/") :]
        p = photo_store / rel
        if p.exists():
            paths.append(p)
    return paths


async def add_to_blocklist(
    database_url: str,
    *,
    sha256: str,
    reason: str,
    added_by: str | None = None,
    delete_files: bool = True,
    dry_run: bool = False,
) -> dict:
    """Upsert into blocklist + retroactively scrub every reference.

    Steps:
      1. INSERT (or update) the blocklist row.
      2. Null out any victim.photo_url that points at a URL whose underlying
         Photo row carries this hash.
      3. Delete every Photo row with this hash.
      4. Optionally delete the on-disk files (default true).

    Idempotent: re-running prints "0 photos / 0 files" the second time."""
    sha256 = sha256.strip().lower()
    if len(sha256) != 64 or not all(c in "0123456789abcdef" for c in sha256):
        raise ValueError(f"sha256 must be 64 hex chars, got: {sha256!r}")

    store = pathlib.Path(
        os.environ.get("PHOTO_STORE", "/var/photos")
    )
    pool = await get_pool(database_url)

    affected_photos = await _photos_referencing_hash(pool, sha256)
    affected_files = await _files_for_sha256(pool, sha256, store) if delete_files else []

    summary = {
        "sha256":             sha256,
        "reason":             reason,
        "photo_rows_found":   len(affected_photos),
        "files_found":        len(affected_files),
        "dry_run":            dry_run,
    }

    if dry_run:
        return summary

    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. blocklist
            first_url = affected_photos[0][1] if affected_photos else None
            await conn.execute(
                """
                INSERT INTO bad_photo_hashes (sha256, reason, added_by, first_seen_url)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (sha256) DO UPDATE
                    SET reason = EXCLUDED.reason,
                        added_by = COALESCE(EXCLUDED.added_by, bad_photo_hashes.added_by),
                        first_seen_url = COALESCE(bad_photo_hashes.first_seen_url, EXCLUDED.first_seen_url)
                """,
                sha256,
                reason,
                added_by,
                first_url,
            )

            # 2. null victim.photo_url that points at any of these URLs
            urls = [u for _id, u in affected_photos if u]
            if urls:
                await conn.execute(
                    "UPDATE victims SET photo_url = NULL WHERE photo_url = ANY($1::text[])",
                    urls,
                )

            # 3. delete photo rows
            await conn.execute(
                "DELETE FROM photos WHERE content_hash = $1",
                sha256,
            )

    # 4. delete files (outside the transaction — best-effort)
    if delete_files:
        for p in affected_files:
            try:
                p.unlink()
            except OSError as e:
                log.warning("Could not unlink %s: %s", p, e)

    return summary


async def remove_from_blocklist(database_url: str, *, sha256: str) -> bool:
    sha256 = sha256.strip().lower()
    pool = await get_pool(database_url)
    async with pool.acquire() as conn:
        deleted = await conn.execute(
            "DELETE FROM bad_photo_hashes WHERE sha256 = $1",
            sha256,
        )
    # asyncpg returns "DELETE n" — check n>0
    return deleted.endswith(" 1") or deleted.endswith(" 0") and False  # type: ignore


async def list_blocklist(database_url: str, *, as_json: bool = False) -> None:
    pool = await get_pool(database_url)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT sha256, reason, added_by, first_seen_url, created_at FROM bad_photo_hashes ORDER BY created_at DESC"
        )
    items = [dict(r) for r in rows]
    if as_json:
        print(
            json.dumps(
                items,
                ensure_ascii=False,
                indent=2,
                default=str,
            )
        )
        return
    if not items:
        log.info("Blocklist is empty.")
        return
    log.info("%d hashes on blocklist:", len(items))
    for r in items:
        log.info("  %s  %s  (added_by=%s)", r["sha256"], r["reason"], r["added_by"] or "—")


# --------------------------------------------------------------------------
# Public read-only helper for photo_mirror (called inline, no asyncio.run)
# --------------------------------------------------------------------------

async def is_blocked(pool, sha256: str) -> bool:
    """Return True iff `sha256` is on the blocklist. Caller passes its own
    asyncpg pool so that this stays cheap inside the mirror loop."""
    if not sha256 or len(sha256) != 64:
        return False
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT 1 FROM bad_photo_hashes WHERE sha256 = $1",
            sha256.lower(),
        )
    return row is not None
