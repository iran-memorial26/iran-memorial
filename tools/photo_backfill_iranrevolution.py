#!/usr/bin/env python3
"""Targeted photo backfill: match photoless DB victims against
iranrevolution.online's Supabase storage by name and copy media.photo.

Strategy:
  1. Fetch all iranrevolution memorial records (paginated, ~5K)
  2. Build a name index: latin name (lowercased, normalized whitespace) →
     photo URL. Also Farsi name → photo URL.
  3. For each photoless DB victim with date_of_death since 2022, look up
     the name in the index. On match, set photo_url + insert photos row.

Run on the server:
    cd /opt/iran-stack/iran-memorial
    set -a; source .env; set +a
    .venv/bin/python3 tools/photo_backfill_iranrevolution.py [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
import sys
from typing import Optional

import asyncpg

logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    level=logging.INFO,
)
log = logging.getLogger("photo_iranrev")

SUPABASE_URL = "https://umkenikezuigjqspgaub.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVta2VuaWtlenVpZ2pxc3BnYXViIiwi"
    "cm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTQ1NzQsImV4cCI6MjA4Mzk3MDU3NH0."
    "gfz_WC_0NtozHAP-CEERLKAYX-vDpH_yqOdd2s9HDgE"
)
API = f"{SUPABASE_URL}/rest/v1/memorials"
PAGE_SIZE = 1000


def normalize(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.strip()).lower()


async def fetch_all_iranrev() -> dict[str, str]:
    """Returns {normalized_name: photo_url} index."""
    from curl_cffi.requests import AsyncSession

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    index: dict[str, str] = {}
    async with AsyncSession(impersonate="chrome120") as s:
        offset = 0
        total = 0
        while True:
            url = f"{API}?select=name,name_fa,media&limit={PAGE_SIZE}&offset={offset}"
            r = await s.get(url, headers=headers, timeout=60)
            if r.status_code != 200:
                log.error(f"iranrev API HTTP {r.status_code} at offset {offset}")
                break
            try:
                rows = r.json()
            except Exception as exc:
                log.error(f"JSON decode failed at offset {offset}: {exc}")
                break
            if not rows:
                break
            for row in rows:
                media = row.get("media") or {}
                photo = (media.get("photo") or "").strip() if isinstance(media, dict) else ""
                if not photo:
                    continue
                # Skip generic placeholders
                if any(skip in photo.lower() for skip in ("flag.png", "logo", "default", "placeholder")):
                    continue
                # Make absolute if relative
                if photo.startswith("/"):
                    photo = SUPABASE_URL + photo
                elif not photo.startswith("http"):
                    photo = f"{SUPABASE_URL}/storage/v1/object/public/{photo.lstrip('/')}"

                for key in (normalize(row.get("name")), normalize(row.get("name_fa"))):
                    if key and key not in index:
                        index[key] = photo
            total += len(rows)
            log.info(f"  iranrev page offset={offset}: {len(rows)} rows ({total} total, {len(index)} unique-name photos)")
            if len(rows) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    log.info(f"iranrev index built: {len(index)} unique-name photo mappings from {total} rows")
    return index


async def main(dry_run: bool):
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        log.error("DATABASE_URL not set")
        sys.exit(1)

    log.info("Phase 1: fetching iranrevolution Supabase records...")
    index = await fetch_all_iranrev()

    log.info("Phase 2: matching against photoless DB victims since 2022...")
    pool = await asyncpg.create_pool(db_url, min_size=1, max_size=2)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, slug, name_latin, name_farsi
            FROM victims
            WHERE photo_url IS NULL
              AND (date_of_death >= '2022-01-01'::date OR date_of_death IS NULL)
            """
        )
        log.info(f"  loaded {len(rows)} candidate victims")

        matched = 0
        for row in rows:
            v = dict(row)
            keys = [normalize(v["name_latin"]), normalize(v["name_farsi"])]
            photo: Optional[str] = None
            for k in keys:
                if k and k in index:
                    photo = index[k]
                    break
            if not photo:
                continue
            matched += 1
            log.info(f"  ✓ {v['slug']}: {photo[:90]}")
            if dry_run:
                continue
            await conn.execute(
                "UPDATE victims SET photo_url = $2, updated_at = NOW() WHERE id = $1 AND photo_url IS NULL",
                v["id"], photo,
            )
            await conn.execute(
                """
                INSERT INTO photos (victim_id, url, source_credit, photo_type, is_primary, sort_order)
                SELECT $1, $2, 'iranrevolution', 'portrait',
                       NOT EXISTS (SELECT 1 FROM photos WHERE victim_id = $1),
                       COALESCE((SELECT MAX(sort_order)+1 FROM photos WHERE victim_id = $1), 0)
                WHERE NOT EXISTS (SELECT 1 FROM photos WHERE victim_id = $1 AND url = $2)
                """,
                v["id"], photo,
            )

        log.info(f"\nDone: {matched}/{len(rows)} photos backfilled (dry_run={dry_run})")
    await pool.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(main(args.dry_run))
