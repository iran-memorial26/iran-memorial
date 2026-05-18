#!/usr/bin/env python3
"""
Import victims from a duplicate-checked CSV.

Only imports rows where decision=IMPORT (use --decision to override).

Usage:
  python3 tools/import-victims.py tools/data/new-victims-checked.csv
  python3 tools/import-victims.py tools/data/new-victims-checked.csv --dry-run
  python3 tools/import-victims.py tools/data/new-victims-checked.csv --decision POSSIBLE_DUPLICATE

Input CSV columns:
  Required: name_latin
  Optional: card_id, name_farsi, age, location, date_of_death,
            cause_of_death, source_urls, notes, decision

Generated automatically:
  slug, verification_status (unverified), data_source (iranvictims.com)
"""

import sys
import csv
import re
import os
import uuid
import argparse
from datetime import date
from pathlib import Path

try:
    import psycopg2
except ImportError:
    sys.exit("Error: psycopg2 not installed. Run: pip install psycopg2-binary")


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def connect():
    url = os.environ.get("DATABASE_URL")
    if url:
        return psycopg2.connect(url)
    return psycopg2.connect(
        host="localhost",
        port=5432,
        database="iran_memorial",
        user=os.environ.get("USER", "Pedi"),
    )


def make_unique_slug(cur, base: str) -> str:
    """Return a unique slug, appending -2, -3, … if needed."""
    slug, i = base, 2
    while True:
        cur.execute("SELECT 1 FROM victims WHERE slug = %s", (slug,))
        if not cur.fetchone():
            return slug
        slug = f"{base}-{i}"
        i += 1


def lookup_city_id(cur, location: str) -> str | None:
    """Try to find a city by name (exact, then partial match on name_en)."""
    if not location:
        return None
    cur.execute(
        "SELECT id FROM cities WHERE LOWER(name_en) = LOWER(%s) LIMIT 1",
        (location.strip(),),
    )
    row = cur.fetchone()
    if row:
        return str(row[0])
    # Partial match — e.g. "Bagher Shahr Rey" → "Rey"
    cur.execute(
        "SELECT id FROM cities WHERE LOWER(name_en) LIKE LOWER(%s) LIMIT 1",
        (f"%{location.strip()}%",),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def parse_date(value: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def infer_cause(notes: str) -> str | None:
    """Infer cause of death from notes text."""
    if not notes:
        return None
    nl = notes.lower()
    if any(w in nl for w in ["shot", "bullet", "gunshot", "live ammunition", "birdshot", "pellet"]):
        return "Shot"
    if any(w in nl for w in ["executed", "execution", "hanged", "hanging"]):
        return "Execution"
    if any(w in nl for w in ["custody", "prison", "jail", "arrested"]):
        return "Death in custody"
    if "torture" in nl:
        return "Torture"
    return None


def source_type_for_url(url: str) -> str:
    if any(d in url for d in ["instagram.com", "x.com", "twitter.com", "t.me", "telegram.org", "telegram.me"]):
        return "SOCIAL_MEDIA"
    if "iranvictims.com" in url:
        return "MEMORIAL_PROJECT"
    return "MEDIA"


def parse_source_urls(raw: str) -> list[str]:
    """Split semicolon- or comma-separated URLs."""
    if not raw:
        return []
    # Try to split on ';' or ',' while keeping URLs intact
    parts = re.split(r"[;,]\s*(?=https?://)", raw)
    return [u.strip() for u in parts if u.strip().startswith("http")]


# ---------------------------------------------------------------------------
# Import logic
# ---------------------------------------------------------------------------


def import_row(conn, row: dict, dry_run: bool) -> str:
    """
    Import a single victim. Returns one of:
      IMPORTED:<slug>  — successfully inserted
      SKIPPED          — slug conflict (already exists)
      DRY_RUN          — dry run, no changes
      ERROR:<message>  — exception during insert
    """
    name_latin = row.get("name_latin", "").strip()
    if not name_latin:
        return "ERROR:missing name_latin"

    name_farsi = row.get("name_farsi", "").strip() or None
    age_raw = row.get("age", "").strip()
    location = row.get("location", "").strip() or None
    date_str = row.get("date_of_death", "").strip()
    cause_raw = row.get("cause_of_death", "").strip() or None
    notes = row.get("notes", "").strip() or None
    source_urls_raw = row.get("source_urls", "").strip()
    card_id = row.get("card_id", "").strip()

    # Parse date + extract year for slug
    dod = parse_date(date_str)
    year = str(dod.year) if dod else ""

    # Parse age
    age_at_death: int | None = None
    if age_raw:
        try:
            age_at_death = int(age_raw)
        except ValueError:
            pass

    # Slug: last-first-year (e.g. "tabasi-feyzabadi-ali-2026")
    # Use full name slugified + year
    base_slug = slugify(name_latin) + (f"-{year}" if year else "")

    # Cause of death
    cause_of_death = cause_raw or infer_cause(notes or "")

    # Sources
    source_urls = parse_source_urls(source_urls_raw)

    # Data source attribution
    data_source = f"iranvictims.com (#{card_id})" if card_id else "iranvictims.com"

    if dry_run:
        print(f"  [DRY RUN] {name_latin} ({date_str or '?'}) → {base_slug}")
        print(f"            cause: {cause_of_death or '—'}, sources: {len(source_urls)}")
        return "DRY_RUN"

    cur = conn.cursor()
    try:
        city_id = lookup_city_id(cur, location)
        slug = make_unique_slug(cur, base_slug)
        victim_id = str(uuid.uuid4())

        cur.execute(
            """
            INSERT INTO victims (
                id, slug, name_latin, name_farsi,
                date_of_death, age_at_death, place_of_death, city_id,
                cause_of_death, circumstances_en,
                verification_status, data_source
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                'unverified', %s
            )
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
            """,
            (
                victim_id, slug, name_latin, name_farsi,
                dod, age_at_death, location, city_id,
                cause_of_death, notes,
                data_source,
            ),
        )

        if not cur.fetchone():
            conn.rollback()
            return "SKIPPED"

        # Insert sources
        for url in source_urls:
            stype = source_type_for_url(url)
            try:
                src_name = re.search(r"https?://(?:www\.)?([^/]+)", url).group(1)[:80]  # type: ignore
            except Exception:
                src_name = url[:80]
            cur.execute(
                """
                INSERT INTO sources (victim_id, name, url, source_type)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (victim_id, src_name, url, stype),
            )

        conn.commit()
        return f"IMPORTED:{slug}"

    except Exception as exc:
        conn.rollback()
        return f"ERROR:{exc}"
    finally:
        cur.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Import victims from duplicate-checked CSV",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("input", help="Checked CSV (output of check-duplicates.py)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB changes")
    parser.add_argument(
        "--decision",
        default="IMPORT",
        help="Import rows with this decision value (default: IMPORT)",
    )
    args = parser.parse_args()

    if not os.path.exists(args.input):
        sys.exit(f"File not found: {args.input}")

    with open(args.input, encoding="utf-8") as f:
        all_rows = list(csv.DictReader(f))

    to_import = [r for r in all_rows if r.get("decision", "").strip() == args.decision]

    print(f"Total rows in file:         {len(all_rows)}")
    print(f"Rows with decision={args.decision}: {len(to_import)}")

    if not to_import:
        print("Nothing to import.")
        return

    if args.dry_run:
        print(f"\n--- DRY RUN (no DB changes) ---\n")
        for row in to_import:
            import_row(None, row, dry_run=True)
        print(f"\n→ {len(to_import)} entries would be imported.")
        return

    print(f"\nConnecting to DB...")
    conn = connect()

    imported, skipped, errors = 0, 0, 0

    for row in to_import:
        name = row.get("name_latin", "?")
        result = import_row(conn, row, dry_run=False)

        if result.startswith("IMPORTED:"):
            slug = result[9:]
            print(f"  ✓ {name} → {slug}")
            imported += 1
        elif result == "SKIPPED":
            print(f"  ~ {name} → skipped (slug already exists)")
            skipped += 1
        elif result.startswith("ERROR:"):
            print(f"  ✗ {name} → {result}")
            errors += 1

    conn.close()

    print(f"\n=== Import Complete ===")
    print(f"  Imported:  {imported}")
    print(f"  Skipped:   {skipped}")
    print(f"  Errors:    {errors}")

    if imported:
        print(f"\nVerifizierung:")
        print(f"  psql -h localhost -U Pedi -d iran_memorial -c \"SELECT slug, name_latin FROM victims ORDER BY created_at DESC LIMIT {imported}\"")


if __name__ == "__main__":
    main()
