#!/usr/bin/env python3
"""
One-off merge for the Jamshid Sharmahd duplicate pair.

Two records exist with the same Farsi name (جمشید شارمهد) but were not
caught by automated dedup because witness.report and OHCHR disagreed on
the death date by 61 days. New dedup logic graduates the date penalty but
still classifies this pair as "review tier" (score 35, threshold for
auto-merge is 50). This script merges them explicitly:

  loser:  sharmahd-jamshid-1955  (witness.report, date 2024-08-28)
  winner: sharmahd-jamshid-2024  (OHCHR + 6 verified sources, date 2024-10-28)

Steps mirror the standard dedup merge pipeline:
  1. Migrate sources (loser -> winner, dedupe by URL)
  2. Migrate photos (loser -> winner, dedupe by URL)
  3. merge_victim_data (fill NULLs on winner from loser)
  4. Insert slug redirect (loser slug -> winner id)
  5. Delete loser victim row

Idempotent: re-running after a successful merge is a no-op (loser
already gone, redirect already present).

Usage:
    set -a; . .env; set +a
    python3 scripts/merge-sharmahd.py --dry-run     # preview
    python3 scripts/merge-sharmahd.py --apply       # execute
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from tools.enricher.db.pool import get_pool  # noqa: E402
from tools.enricher.db.queries import (  # noqa: E402
    delete_victim,
    merge_victim_data,
    migrate_photos,
    migrate_sources,
    record_slug_redirect,
)


LOSER_SLUG = "sharmahd-jamshid-1955"
WINNER_SLUG = "sharmahd-jamshid-2024"


async def fetch(pool, slug: str):
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT * FROM victims WHERE slug = $1",
            slug,
        )


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Execute (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Preview only (default)")
    args = parser.parse_args()
    apply = args.apply and not args.dry_run

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    pool = await get_pool(dsn)
    try:
        winner = await fetch(pool, WINNER_SLUG)
        loser = await fetch(pool, LOSER_SLUG)

        if winner is None:
            print(f"ERROR: winner '{WINNER_SLUG}' not found", file=sys.stderr)
            sys.exit(1)
        if loser is None:
            print(f"OK: loser '{LOSER_SLUG}' not present — nothing to merge")
            return

        winner_id = str(winner["id"])
        loser_id = str(loser["id"])

        print(f"WINNER: {WINNER_SLUG} ({winner_id})")
        print(f"  name:     {winner['name_latin']} / {winner['name_farsi']}")
        print(f"  death:    {winner['date_of_death']}")
        print(f"  source:   {winner['data_source']}")
        print(f"")
        print(f"LOSER:  {LOSER_SLUG} ({loser_id})")
        print(f"  name:     {loser['name_latin']} / {loser['name_farsi']}")
        print(f"  death:    {loser['date_of_death']}")
        print(f"  source:   {loser['data_source']}")
        print(f"")

        if not apply:
            print("[dry-run] would: migrate sources/photos, fill NULLs, record redirect, delete loser")
            print("Run with --apply to execute.")
            return

        print("Migrating sources...")
        src_count = await migrate_sources(pool, winner_id, loser_id)
        print(f"  {src_count} sources migrated")

        print("Migrating photos...")
        photo_count = await migrate_photos(pool, winner_id, loser_id)
        print(f"  {photo_count} photos migrated")

        print("Filling winner NULLs from loser...")
        await merge_victim_data(pool, winner_id, dict(loser))

        print("Recording slug redirect...")
        await record_slug_redirect(
            pool,
            from_slug=LOSER_SLUG,
            to_victim_id=winner_id,
            reason="deduplicated:sharmahd",
        )

        print("Deleting loser victim row...")
        await delete_victim(pool, loser_id)

        print("\nDONE.")
        print(f"  <SITE>/en/victims/{LOSER_SLUG}  -> 308 -> /{WINNER_SLUG}")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
