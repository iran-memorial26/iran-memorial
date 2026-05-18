"""Database queries for the enrichment pipeline."""

from __future__ import annotations

from typing import Any

import asyncpg

# Load all cities for building city resolver
LOAD_CITIES = """
    SELECT id, slug, name_en FROM cities ORDER BY slug
"""

# Load all victims (lightweight fields for matching)
LOAD_VICTIMS = """
    SELECT v.id, v.slug, v.name_latin, v.name_farsi, v.aliases,
           v.date_of_death, v.age_at_death, v.place_of_death, v.province,
           v.cause_of_death, v.photo_url, v.circumstances_en, v.circumstances_fa,
           v.gender, v.religion, v.place_of_birth, v.date_of_birth,
           v.occupation_en, v.education, v.responsible_forces,
           v.event_context, v.verification_status, v.data_source,
           v.city_id,
           COALESCE(p.name_en, v.province) AS effective_province
    FROM victims v
    LEFT JOIN cities c ON v.city_id = c.id
    LEFT JOIN provinces p ON c.province_id = p.id
    ORDER BY v.slug
"""

# Load source URLs grouped by victim
LOAD_SOURCE_URLS = """
    SELECT victim_id::text, url
    FROM sources
    WHERE victim_id IS NOT NULL AND url IS NOT NULL
"""

# Enrich: update only NULL fields using COALESCE
ENRICH_VICTIM = """
    UPDATE victims SET
        name_farsi          = COALESCE(name_farsi, $2::text),
        date_of_birth       = COALESCE(date_of_birth, $3::date),
        place_of_birth      = COALESCE(place_of_birth, $4::text),
        gender              = CASE WHEN gender IS NULL OR gender = 'unknown'
                                THEN COALESCE($5::text, gender) ELSE gender END,
        religion            = COALESCE(religion, $6::text),
        photo_url           = COALESCE(photo_url, $7::text),
        occupation_en       = COALESCE(occupation_en, $8::text),
        education           = COALESCE(education, $9::text),
        age_at_death        = COALESCE(age_at_death, $10::int),
        place_of_death      = COALESCE(place_of_death, $11::text),
        province            = COALESCE(province, $12::text),
        cause_of_death      = COALESCE(cause_of_death, $13::text),
        circumstances_en    = CASE
                                WHEN circumstances_en IS NULL THEN $14::text
                                WHEN $14::text IS NOT NULL
                                  AND LENGTH($14::text) > LENGTH(circumstances_en) * 3 / 2
                                THEN $14::text
                                ELSE circumstances_en
                              END,
        circumstances_fa    = CASE
                                WHEN circumstances_fa IS NULL THEN $15::text
                                WHEN $15::text IS NOT NULL
                                  AND LENGTH($15::text) > LENGTH(circumstances_fa) * 3 / 2
                                THEN $15::text
                                ELSE circumstances_fa
                              END,
        event_context       = COALESCE(event_context, $16::text),
        responsible_forces  = COALESCE(responsible_forces, $17::text),
        city_id             = COALESCE(city_id, $18::int),
        updated_at          = NOW()
    WHERE id = $1
    RETURNING id, slug
"""

# Insert source if not already present (dedup by victim_id + url)
INSERT_SOURCE = """
    INSERT INTO sources (victim_id, url, name, source_type)
    SELECT $1, $2, $3, $4
    WHERE NOT EXISTS (
        SELECT 1 FROM sources WHERE victim_id = $1 AND url = $2
    )
"""

# Load photo URLs grouped by victim (for dedup)
LOAD_VICTIM_PHOTO_URLS = """
    SELECT victim_id::text, url
    FROM photos
    WHERE victim_id IS NOT NULL
"""

# Insert photo if not already present (dedup by victim_id + url)
INSERT_PHOTO = """
    INSERT INTO photos (victim_id, url, source_credit, photo_type, is_primary, sort_order)
    SELECT $1, $2, $3, $4,
        NOT EXISTS (SELECT 1 FROM photos WHERE victim_id = $1),
        COALESCE((SELECT MAX(sort_order) + 1 FROM photos WHERE victim_id = $1), 0)
    WHERE NOT EXISTS (
        SELECT 1 FROM photos WHERE victim_id = $1 AND url = $2
    )
"""

# Insert new victim
INSERT_VICTIM = """
    INSERT INTO victims (
        slug, name_latin, name_farsi, date_of_birth, place_of_birth,
        gender, religion, photo_url, occupation_en, education,
        date_of_death, age_at_death, place_of_death, province,
        cause_of_death, circumstances_en, event_context, responsible_forces,
        verification_status, data_source, city_id
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        'unverified', $19, $20::int
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug
"""


async def load_all_cities(pool: asyncpg.Pool) -> list[dict]:
    """Load all cities for building the city resolver."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(LOAD_CITIES)
    return [dict(r) for r in rows]


async def load_all_victims(pool: asyncpg.Pool) -> list[dict]:
    """Load all victims for building the match index."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(LOAD_VICTIMS)
    return [dict(r) for r in rows]


async def load_all_source_urls(pool: asyncpg.Pool) -> dict[str, set[str]]:
    """Load all source URLs grouped by victim UUID."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(LOAD_SOURCE_URLS)
    result: dict[str, set[str]] = {}
    for r in rows:
        result.setdefault(r["victim_id"], set()).add(r["url"])
    return result


async def batch_enrich(
    pool: asyncpg.Pool,
    updates: list[tuple[Any, ...]],
    batch_size: int = 100,
) -> int:
    """Execute enrichment updates in batches."""
    total = 0
    async with pool.acquire() as conn:
        for i in range(0, len(updates), batch_size):
            batch = updates[i : i + batch_size]
            await conn.executemany(ENRICH_VICTIM, batch)
            total += len(batch)
    return total


async def batch_insert_sources(
    pool: asyncpg.Pool,
    sources: list[tuple[str, str, str, str]],
    batch_size: int = 100,
) -> int:
    """Insert sources in batches, skipping duplicates."""
    total = 0
    async with pool.acquire() as conn:
        for i in range(0, len(sources), batch_size):
            batch = sources[i : i + batch_size]
            await conn.executemany(INSERT_SOURCE, batch)
            total += len(batch)
    return total


async def batch_insert_victims(
    pool: asyncpg.Pool,
    victims: list[tuple[Any, ...]],
) -> list[tuple[str, str]]:
    """Insert new victims, skipping conflicts.

    Returns a list of (victim_id, slug) for rows that were actually inserted,
    preserving input order with None placeholders for skipped (conflict) rows
    so callers can align with their source-of-origin list.
    """
    inserted: list[tuple[str, str]] = []
    async with pool.acquire() as conn:
        for v in victims:
            result = await conn.fetchrow(INSERT_VICTIM, *v)
            if result:
                inserted.append((str(result["id"]), result["slug"]))
            else:
                inserted.append(None)  # type: ignore[arg-type]
    return inserted


async def load_all_photo_urls(pool: asyncpg.Pool) -> dict[str, set[str]]:
    """Load all photo URLs grouped by victim UUID."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(LOAD_VICTIM_PHOTO_URLS)
    result: dict[str, set[str]] = {}
    for r in rows:
        result.setdefault(r["victim_id"], set()).add(r["url"])
    return result


async def batch_insert_photos(
    pool: asyncpg.Pool,
    photos: list[tuple[str, str, str | None, str]],
    batch_size: int = 100,
) -> int:
    """Insert photos in batches, skipping duplicates."""
    total = 0
    async with pool.acquire() as conn:
        for i in range(0, len(photos), batch_size):
            batch = photos[i : i + batch_size]
            await conn.executemany(INSERT_PHOTO, batch)
            total += len(batch)
    return total


# ─── Dedup queries ───────────────────────────────────────────────────────────

# Load all victims with source/photo counts for dedup scoring
LOAD_VICTIMS_WITH_COUNTS = """
    SELECT v.*,
        COALESCE(sc.cnt, 0)::int AS source_count,
        COALESCE(pc.cnt, 0)::int AS photo_count
    FROM victims v
    LEFT JOIN (SELECT victim_id, COUNT(*) AS cnt FROM sources WHERE victim_id IS NOT NULL GROUP BY victim_id) sc
           ON sc.victim_id = v.id
    LEFT JOIN (SELECT victim_id, COUNT(*) AS cnt FROM photos  WHERE victim_id IS NOT NULL GROUP BY victim_id) pc
           ON pc.victim_id = v.id
    ORDER BY v.slug
"""

# Migrate sources from loser to winner (skip URL duplicates)
MIGRATE_SOURCES = """
    UPDATE sources SET victim_id = $1
    WHERE victim_id = $2
    AND url NOT IN (SELECT url FROM sources WHERE victim_id = $1)
"""

# Delete remaining orphaned sources after migration
DELETE_ORPHAN_SOURCES = """
    DELETE FROM sources WHERE victim_id = $1
"""

# Migrate photos from loser to winner (skip URL duplicates)
MIGRATE_PHOTOS = """
    UPDATE photos SET victim_id = $1
    WHERE victim_id = $2
    AND url NOT IN (SELECT url FROM photos WHERE victim_id = $1)
"""

# Delete remaining orphaned photos after migration
DELETE_ORPHAN_PHOTOS = """
    DELETE FROM photos WHERE victim_id = $1
"""

# Merge: fill NULL fields of winner with loser data (COALESCE pattern)
MERGE_VICTIM = """
    UPDATE victims SET
        name_farsi          = COALESCE(name_farsi, $2::text),
        aliases             = COALESCE(aliases, $3::text[]),
        date_of_birth       = COALESCE(date_of_birth, $4::date),
        place_of_birth      = COALESCE(place_of_birth, $5::text),
        gender              = CASE WHEN gender IS NULL OR gender = 'unknown'
                                THEN COALESCE($6::text, gender) ELSE gender END,
        ethnicity           = COALESCE(ethnicity, $7::text),
        religion            = COALESCE(religion, $8::text),
        photo_url           = COALESCE(photo_url, $9::text),
        occupation_en       = COALESCE(occupation_en, $10::text),
        occupation_fa       = COALESCE(occupation_fa, $11::text),
        education           = COALESCE(education, $12::text),
        date_of_death       = COALESCE(date_of_death, $13::date),
        age_at_death        = COALESCE(age_at_death, $14::int),
        place_of_death      = COALESCE(place_of_death, $15::text),
        province            = COALESCE(province, $16::text),
        cause_of_death      = COALESCE(cause_of_death, $17::text),
        circumstances_en    = CASE
                                WHEN circumstances_en IS NULL THEN $18::text
                                WHEN $18::text IS NOT NULL
                                  AND LENGTH($18::text) > LENGTH(circumstances_en) * 3 / 2
                                THEN $18::text
                                ELSE circumstances_en
                              END,
        circumstances_fa    = COALESCE(circumstances_fa, $19::text),
        event_context       = COALESCE(event_context, $20::text),
        responsible_forces  = COALESCE(responsible_forces, $21::text),
        witnesses           = COALESCE(witnesses, $22::text[]),
        last_seen           = COALESCE(last_seen, $23::text),
        burial_location     = COALESCE(burial_location, $24::text),
        city_id             = COALESCE(city_id, $25::int),
        updated_at          = NOW()
    WHERE id = $1
"""

# Delete a victim record
DELETE_VICTIM = "DELETE FROM victims WHERE id = $1"


async def load_all_victims_with_counts(pool: asyncpg.Pool) -> list[dict]:
    """Load all victims with source/photo counts for dedup scoring."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(LOAD_VICTIMS_WITH_COUNTS)
    return [dict(r) for r in rows]


async def migrate_sources(
    pool: asyncpg.Pool, winner_id: str, loser_id: str
) -> int:
    """Move sources from loser to winner, skip URL dups."""
    async with pool.acquire() as conn:
        result = await conn.execute(MIGRATE_SOURCES, winner_id, loser_id)
        migrated = int(result.split()[-1])
        await conn.execute(DELETE_ORPHAN_SOURCES, loser_id)
    return migrated


async def migrate_photos(
    pool: asyncpg.Pool, winner_id: str, loser_id: str
) -> int:
    """Move photos from loser to winner, skip URL dups."""
    async with pool.acquire() as conn:
        result = await conn.execute(MIGRATE_PHOTOS, winner_id, loser_id)
        migrated = int(result.split()[-1])
        await conn.execute(DELETE_ORPHAN_PHOTOS, loser_id)
    return migrated


async def merge_victim_data(
    pool: asyncpg.Pool, winner_id: str, loser: dict
) -> None:
    """Merge loser data into winner (fill NULLs only)."""
    async with pool.acquire() as conn:
        await conn.execute(
            MERGE_VICTIM,
            winner_id,
            loser.get("name_farsi"),
            loser.get("aliases"),
            loser.get("date_of_birth"),
            loser.get("place_of_birth"),
            loser.get("gender"),
            loser.get("ethnicity"),
            loser.get("religion"),
            loser.get("photo_url"),
            loser.get("occupation_en"),
            loser.get("occupation_fa"),
            loser.get("education"),
            loser.get("date_of_death"),
            loser.get("age_at_death"),
            loser.get("place_of_death"),
            loser.get("province"),
            loser.get("cause_of_death"),
            loser.get("circumstances_en"),
            loser.get("circumstances_fa"),
            loser.get("event_context"),
            loser.get("responsible_forces"),
            loser.get("witnesses"),
            loser.get("last_seen"),
            loser.get("burial_location"),
            loser.get("city_id"),
        )


async def delete_victim(pool: asyncpg.Pool, victim_id: str) -> None:
    """Delete a victim record."""
    async with pool.acquire() as conn:
        await conn.execute(DELETE_VICTIM, victim_id)


async def record_slug_redirect(
    pool: asyncpg.Pool,
    from_slug: str,
    to_victim_id: str,
    reason: str = "deduplicated",
) -> None:
    """Insert a permanent slug -> victim redirect.

    Called when a duplicate record is about to be deleted so that any
    external link still pointing at the losing slug 308-redirects to the
    surviving record. Idempotent: re-running upserts to the same target.

    Safe to call before delete_victim — the foreign key targets the
    *winner* victim id, not the loser.
    """
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO victim_slug_redirects (from_slug, to_victim_id, reason)
            VALUES ($1, $2::uuid, $3)
            ON CONFLICT (from_slug)
            DO UPDATE SET to_victim_id = EXCLUDED.to_victim_id,
                          reason = EXCLUDED.reason,
                          created_at = CURRENT_TIMESTAMP
            """,
            from_slug,
            to_victim_id,
            reason,
        )
