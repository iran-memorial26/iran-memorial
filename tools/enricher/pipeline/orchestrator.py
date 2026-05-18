"""Main enrichment pipeline orchestrator."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Optional

from ..db.models import ExternalVictim, RunStats
from ..db.pool import close_pool, get_pool
from ..db.queries import (
    batch_enrich,
    batch_insert_photos,
    batch_insert_sources,
    batch_insert_victims,
    load_all_cities,
    load_all_photo_urls,
    load_all_source_urls,
    load_all_victims,
)
from ..sources import get_plugin, list_plugins
from ..utils.http import create_session
from ..utils.provinces import build_city_resolver, resolve_city_id
from ..utils.progress import ProgressTracker
from .enricher import compute_enrichment, count_new_fields
from .matcher import build_index, match

log = logging.getLogger("enricher")


def make_slug(name: str, birth_year: Optional[int] = None) -> str:
    """Generate a URL-safe slug from a Latin name."""
    s = name.lower().strip()
    s = re.sub(r"['\"`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    # Rearrange: "firstname lastname" → "lastname-firstname"
    parts = s.split("-")
    if len(parts) >= 2:
        s = f"{parts[-1]}-{'-'.join(parts[:-1])}"
    if birth_year:
        s += f"-{birth_year}"
    return s


async def run_enrichment(
    source_name: str,
    database_url: str,
    state_dir: str,
    mode: str = "enrich",
    dry_run: bool = False,
    limit: Optional[int] = None,
    batch_size: int = 100,
    resume: bool = False,
    verbose: bool = False,
) -> RunStats:
    """Run the enrichment pipeline for a source.

    Args:
        source_name: Plugin name (e.g. "boroumand")
        database_url: PostgreSQL connection string
        state_dir: Directory for progress/cache state
        mode: "enrich" (fill NULLs), "import-new" (add unmatched), "full" (both)
        dry_run: Preview without writing to DB
        limit: Max entries to process
        batch_size: DB batch commit size
        resume: Resume from last progress
        verbose: Verbose output
    """
    stats = RunStats()
    pool = await get_pool(database_url)

    # 1. Build victim index from DB
    log.info("Loading victims from database...")
    t0 = time.time()
    victims = await load_all_victims(pool)
    source_urls = await load_all_source_urls(pool)
    photo_urls = await load_all_photo_urls(pool)
    cities = await load_all_cities(pool)
    city_resolver = build_city_resolver(cities)
    index = build_index(victims, source_urls)
    log.info(
        f"Index built: {len(victims)} victims, "
        f"{sum(len(v) for v in source_urls.values())} source URLs, "
        f"{sum(len(v) for v in photo_urls.values())} photo URLs, "
        f"{len(cities)} cities "
        f"({time.time()-t0:.1f}s)"
    )

    # 2. Initialize plugin
    plugin_cls = get_plugin(source_name)
    plugin = plugin_cls()
    progress = ProgressTracker(source_name, state_dir)

    if not resume:
        progress.reset()

    session = create_session()

    try:
        await plugin.setup(
            config={},
            http_session=session,
            progress=progress,
            cache_dir=f"{state_dir}/cache/{source_name}",
        )

        enrich_batch: list[tuple] = []
        source_batch: list[tuple[str, str, str, str]] = []
        photo_batch: list[tuple[str, str, str | None, str]] = []
        new_victims: list[ExternalVictim] = []
        field_counts: dict[str, int] = {}

        # 3. Stream external victims
        log.info(f"Fetching from {plugin.full_name}...")
        async for ext in plugin.fetch_all():
            if limit and stats.processed >= limit:
                break

            stats.processed += 1

            # 4. Match against index
            result = match(ext, index)

            if result.matched:
                stats.matched += 1
                victim = result.victim

                # 5a. Compute enrichment
                update = compute_enrichment(victim, ext)
                if update:
                    # Append resolved city_id ($18) to the tuple
                    city_id = resolve_city_id(
                        ext.place_of_death, city_resolver
                    )
                    enrich_batch.append(update + (city_id,))
                    source_batch.append((
                        str(victim["id"]),
                        ext.source_url,
                        ext.source_name,
                        ext.source_type,
                    ))
                    stats.enriched += 1
                    stats.fields_updated += count_new_fields(victim, ext)

                    if verbose:
                        n = count_new_fields(victim, ext)
                        log.info(
                            f"  ENRICH {victim['slug']} "
                            f"(+{n} fields, score={result.score})"
                        )
                # Add photo if available and not already present
                if ext.photo_url:
                    vid = str(victim["id"])
                    existing_photos = photo_urls.get(vid, set())
                    if ext.photo_url not in existing_photos:
                        credit = ext.source_name if ext.source_name else None
                        photo_batch.append((vid, ext.photo_url, credit, "portrait"))
                        existing_photos.add(ext.photo_url)
                        photo_urls.setdefault(vid, set()).add(ext.photo_url)
                        stats.photos_added += 1

                if not update:
                    # Source URL still might be new
                    vid = str(victim["id"])
                    existing = source_urls.get(vid, set())
                    if ext.source_url not in existing:
                        source_batch.append((
                            vid,
                            ext.source_url,
                            ext.source_name,
                            ext.source_type,
                        ))
                        stats.sources_added += 1
                    else:
                        stats.no_new_data += 1

            elif result.ambiguous:
                stats.ambiguous += 1
                if verbose:
                    log.warning(
                        f"  AMBIGUOUS {ext.name_latin} "
                        f"(score={result.score}): "
                        f"{[c['slug'] for c in result.candidates]}"
                    )

            else:
                stats.unmatched += 1
                if mode in ("import-new", "full"):
                    new_victims.append(ext)
                    if verbose:
                        log.info(f"  NEW {ext.name_latin}")

            # 6. Batch commit
            if len(enrich_batch) >= batch_size:
                if not dry_run:
                    await batch_enrich(pool, enrich_batch, batch_size)
                    await batch_insert_sources(pool, source_batch, batch_size)
                    if photo_batch:
                        await batch_insert_photos(pool, photo_batch, batch_size)
                enrich_batch.clear()
                source_batch.clear()
                photo_batch.clear()
                progress.save(stats)
                log.info(
                    f"  Progress: {stats.processed} processed, "
                    f"{stats.enriched} enriched"
                )

        # 7. Final flush
        if enrich_batch and not dry_run:
            await batch_enrich(pool, enrich_batch, batch_size)
        if source_batch and not dry_run:
            await batch_insert_sources(pool, source_batch, batch_size)
        if photo_batch and not dry_run:
            await batch_insert_photos(pool, photo_batch, batch_size)

        if new_victims and not dry_run and mode in ("import-new", "full"):
            tuples = []
            for ext in new_victims:
                slug = make_slug(
                    ext.name_latin or "unknown",
                    ext.date_of_birth.year if ext.date_of_birth else None,
                )
                city_id = resolve_city_id(
                    ext.place_of_death, city_resolver
                )
                tuples.append((
                    slug,
                    ext.name_latin or "Unknown",
                    ext.name_farsi,
                    ext.date_of_birth,
                    ext.place_of_birth,
                    ext.gender,
                    ext.religion,
                    ext.photo_url,
                    ext.occupation,
                    ext.education,
                    ext.date_of_death,
                    ext.age_at_death,
                    ext.place_of_death,
                    ext.province,
                    ext.cause_of_death,
                    ext.circumstances_en,
                    ext.event_context,
                    ext.responsible_forces,
                    source_name,
                    city_id,
                ))
            inserted = await batch_insert_victims(pool, tuples)
            stats.new_imported = sum(1 for r in inserted if r)

            # Attach source URLs and photos to the freshly-imported victims.
            # The ON CONFLICT (slug) DO NOTHING branch yields None here; skip those.
            new_sources: list[tuple[str, str, str, str]] = []
            new_photos: list[tuple[str, str, str, str]] = []
            for row, ext in zip(inserted, new_victims):
                if not row:
                    continue
                victim_id, _slug = row
                if ext.source_url:
                    new_sources.append((
                        victim_id,
                        ext.source_url,
                        ext.source_name or source_name,
                        ext.source_type or "external",
                    ))
                if ext.photo_url:
                    new_photos.append((
                        victim_id,
                        ext.photo_url,
                        ext.source_name or source_name,
                        "portrait",
                    ))
            if new_sources:
                stats.sources_added += await batch_insert_sources(
                    pool, new_sources, batch_size
                )
            if new_photos:
                stats.photos_added += await batch_insert_photos(
                    pool, new_photos, batch_size
                )

        progress.save(stats)
        await plugin.teardown()

    finally:
        await session.close()
        await close_pool()

    return stats


async def run_all_sources(
    database_url: str, state_dir: str, **kwargs
) -> dict[str, RunStats]:
    """Run enrichment for all registered plugins."""
    results = {}
    for name in list_plugins():
        log.info(f"\n{'='*60}\nSource: {name}\n{'='*60}")
        try:
            stats = await run_enrichment(
                name, database_url, state_dir, **kwargs
            )
            results[name] = stats
        except Exception as e:
            log.error(f"Source {name} failed: {e}")
            results[name] = RunStats(errors=1)
    return results
