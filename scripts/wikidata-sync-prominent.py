#!/usr/bin/env python3
"""
wikidata-sync-prominent.py
==========================

Backfill Phase-1 (Education + Online presence) and Phase-2 (Tier-2 goldstandard)
columns in iran-memorial `victims` table from Wikidata for prominent cases.

USAGE
-----
    python3 scripts/wikidata-sync-prominent.py --dry-run         # default
    python3 scripts/wikidata-sync-prominent.py --apply           # actually write
    python3 scripts/wikidata-sync-prominent.py --simulate        # offline fixture
    python3 scripts/wikidata-sync-prominent.py --only sharmahd-jamshid-2024

SAFETY
------
- NEVER overwrites a non-NULL DB value.
- Booleans only set if Wikidata has a positive signal AND DB value is currently false.
- All UPDATEs are parameterized (asyncpg / psycopg) — never string-interpolated SQL.
- Defaults to dry-run; --apply required to write.

DEPS
----
asyncpg, httpx  (both optional — falls back to psycopg/urllib if missing).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from typing import Any, Optional
from urllib.parse import quote

# --- Optional deps with graceful fallback -----------------------------------
try:
    import httpx  # type: ignore

    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False
    import urllib.request
    import urllib.error

try:
    import asyncpg  # type: ignore

    _HAS_ASYNCPG = True
except ImportError:
    _HAS_ASYNCPG = False
    try:
        import psycopg  # type: ignore  # noqa: F401

        _HAS_PSYCOPG = True
    except ImportError:
        _HAS_PSYCOPG = False

USER_AGENT = "iran-memorial-wikidata-sync/0.1 (https://iran-memorial.org; contact: dev@iran-memorial.org)"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# ----------------------------------------------------------------------------
# Target slugs → known QIDs (None means resolve via search API)
# ----------------------------------------------------------------------------
TARGETS: list[tuple[str, Optional[str], str]] = [
    ("sharmahd-jamshid-2024", "Q105749155", "Jamshid Sharmahd"),
    ("amini-mahsa-2022", "Q113948245", "Mahsa Amini"),
    ("karami-mohammad-mahdi-2023", "Q116249389", "Mohammad Mehdi Karami"),
    ("ghobadlou-mohammad-2024", "Q121876920", "Mohammad Ghobadlou"),
    ("hosseini-seyed-mohammad-2023", None, "Seyed Mohammad Hosseini Iran protester"),
    ("sepehri-fatemeh-2022", None, "Fatemeh Sepehri activist Iran"),
    ("afkari-navid-2020", "Q98970432", "Navid Afkari"),
    ("rajabi-farzaneh", None, "Farzaneh Rajabi journalist Sweden Iran"),
    ("panahi-shahriar", None, "Shahriar Panahi Iran"),
]

# ----------------------------------------------------------------------------
# Wikidata property → victims column mapping
# ----------------------------------------------------------------------------
PROPERTY_MAP: dict[str, str] = {
    # Phase 1 — Education
    "P69": "university_name",      # educated at (also drives university_city)
    "P512": "degree_level",        # academic degree
    # P106 (occupation) is already populated in DB for most rows — skip unless empty
    # graduation_year: not reliably structured on Wikidata; leave for OHCHR
    # field_of_study: rare on Wikidata individual items; skip

    # Phase 1 — Online presence
    "P2002": "x_handle",           # Twitter username
    "P2003": "instagram_handle",   # Instagram
    "P2013": "facebook_url",       # Facebook (needs https:// prefix)
    "P6634": "linkedin_url",       # LinkedIn personal profile
    "P2037": "github_handle",      # GitHub username
    "P856":  "website_url",        # official website
    "P5345": "telegram_handle",    # Telegram

    # Phase 2 — Tier-2 goldstandard
    "P103": "mother_tongue",       # native language
    "P166": "international_recognition",  # award received (joined labels)
}

# Degree QID → enum
DEGREE_MAP = {
    "Q1765120": "bachelor",       # Bachelor of Arts (and variants)
    "Q163727":  "bachelor",       # Bachelor's degree
    "Q1240671": "bachelor",
    "Q186375":  "master",         # Master's degree
    "Q752297":  "phd",            # Doctor of Philosophy
    "Q4220920": "phd",
    "Q1969955": "undergraduate",
}


# ============================================================================
# HTTP helpers
# ============================================================================
async def http_get_json(url: str, params: dict[str, str]) -> dict[str, Any]:
    """Async GET → JSON. Uses httpx if present, else stdlib urllib in a thread."""
    if _HAS_HTTPX:
        async with httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json,application/json"},
            timeout=30.0,
        ) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()
    # Fallback: stdlib in default executor
    qs = "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
    full_url = f"{url}?{qs}"
    req = urllib.request.Request(
        full_url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )

    def _do() -> dict[str, Any]:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))

    return await asyncio.get_event_loop().run_in_executor(None, _do)


# ============================================================================
# Wikidata QID resolution
# ============================================================================
async def resolve_qid(name: str) -> Optional[str]:
    """Use wbsearchentities to resolve a free-text name to a QID."""
    try:
        data = await http_get_json(
            WIKIDATA_API,
            {
                "action": "wbsearchentities",
                "search": name,
                "language": "en",
                "format": "json",
                "type": "item",
                "limit": "3",
            },
        )
        hits = data.get("search", [])
        if not hits:
            return None
        # Prefer the first hit (Wikidata ranks by relevance)
        return hits[0].get("id")
    except Exception as e:
        print(f"  ! resolve_qid({name!r}) failed: {e}", file=sys.stderr)
        return None


# ============================================================================
# SPARQL fetch
# ============================================================================
def _sparql_for_qid(qid: str) -> str:
    """Single-QID SPARQL: pull all interesting properties + labels."""
    return f"""
SELECT ?prop ?value ?valueLabel ?cityLabel WHERE {{
  VALUES ?prop {{
    wd:P69 wd:P512 wd:P106 wd:P103
    wd:P2002 wd:P2003 wd:P2013 wd:P6634 wd:P2037 wd:P856 wd:P5345
    wd:P166
  }}
  wd:{qid} ?p ?value .
  ?prop wikibase:directClaim ?p .
  OPTIONAL {{
    ?value wdt:P131 ?city .
    SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". ?city rdfs:label ?cityLabel . }}
  }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". ?value rdfs:label ?valueLabel . }}
}}
"""


async def fetch_wikidata(qid: str) -> dict[str, list[dict[str, Any]]]:
    """
    Returns {property_pid: [{value: Q-id-or-literal, label: en-label, city: city-label}, ...]}
    """
    if not qid:
        return {}
    try:
        data = await http_get_json(
            WIKIDATA_SPARQL,
            {"query": _sparql_for_qid(qid), "format": "json"},
        )
    except Exception as e:
        print(f"  ! fetch_wikidata({qid}) failed: {e}", file=sys.stderr)
        return {}

    out: dict[str, list[dict[str, Any]]] = {}
    for row in data.get("results", {}).get("bindings", []):
        prop_uri = row.get("prop", {}).get("value", "")
        pid = prop_uri.rsplit("/", 1)[-1]  # http://www.wikidata.org/entity/P69 → P69
        value = row.get("value", {}).get("value", "")
        # Strip entity URI prefix to get Q-id when applicable
        if value.startswith("http://www.wikidata.org/entity/"):
            value = value.rsplit("/", 1)[-1]
        out.setdefault(pid, []).append({
            "value": value,
            "label": row.get("valueLabel", {}).get("value", ""),
            "city": row.get("cityLabel", {}).get("value", ""),
        })
    return out


# ============================================================================
# Mapping: Wikidata data → DB column updates
# ============================================================================
def map_to_victim_columns(
    wd: dict[str, list[dict[str, Any]]],
    current_row: dict[str, Any],
) -> dict[str, Any]:
    """
    Build {column: value} dict for columns where:
      - Wikidata has a value, AND
      - current_row[column] is NULL/empty
    Booleans only set if Wikidata is positive AND current value is False.
    """
    updates: dict[str, Any] = {}

    def is_null(col: str) -> bool:
        v = current_row.get(col)
        return v is None or (isinstance(v, str) and v.strip() == "")

    # --- Education ----------------------------------------------------------
    if "P69" in wd and is_null("university_name"):
        first = wd["P69"][0]
        if first["label"]:
            updates["university_name"] = first["label"]
            if first["city"] and is_null("university_city"):
                updates["university_city"] = first["city"]

    if "P512" in wd and is_null("degree_level"):
        for entry in wd["P512"]:
            mapped = DEGREE_MAP.get(entry["value"])
            if mapped:
                updates["degree_level"] = mapped
                break

    # --- Mother tongue ------------------------------------------------------
    if "P103" in wd and is_null("mother_tongue"):
        first = wd["P103"][0]
        if first["label"]:
            updates["mother_tongue"] = first["label"]

    # --- Online presence ----------------------------------------------------
    handle_map = {
        "P2002": "x_handle",
        "P2003": "instagram_handle",
        "P2037": "github_handle",
        "P5345": "telegram_handle",
    }
    for pid, col in handle_map.items():
        if pid in wd and is_null(col):
            v = wd[pid][0]["value"]
            if v:
                updates[col] = v.lstrip("@")

    if "P2013" in wd and is_null("facebook_url"):
        v = wd["P2013"][0]["value"]
        if v:
            updates["facebook_url"] = f"https://facebook.com/{v}"

    if "P6634" in wd and is_null("linkedin_url"):
        v = wd["P6634"][0]["value"]
        if v:
            if v.startswith("http"):
                updates["linkedin_url"] = v
            else:
                updates["linkedin_url"] = f"https://www.linkedin.com/in/{v}"

    if "P856" in wd and is_null("website_url"):
        v = wd["P856"][0]["value"]
        if v and v.startswith("http"):
            updates["website_url"] = v

    # --- International recognition (awards) ---------------------------------
    if "P166" in wd and is_null("international_recognition"):
        labels = [e["label"] for e in wd["P166"] if e["label"]]
        if labels:
            updates["international_recognition"] = "; ".join(labels)

    return updates


# ============================================================================
# DB layer
# ============================================================================
async def get_db_pool(database_url: str):
    if not _HAS_ASYNCPG:
        raise RuntimeError(
            "asyncpg not installed. Install with: pip install asyncpg httpx"
        )
    return await asyncpg.create_pool(database_url, min_size=1, max_size=4)


async def fetch_victim(pool, slug: str) -> Optional[dict[str, Any]]:
    """Pull current row state. Returns None if not found."""
    async with pool.acquire() as conn:
        # Inspect column list once
        row = await conn.fetchrow(
            "SELECT * FROM victims WHERE slug = $1 LIMIT 1", slug
        )
        return dict(row) if row else None


# Whitelist of writable columns — safety guard against typos
ALLOWED_COLUMNS = {
    "field_of_study", "university_name", "university_city",
    "degree_level", "graduation_year",
    "instagram_handle", "x_handle", "linkedin_url", "github_handle",
    "telegram_handle", "facebook_url", "youtube_channel_url", "website_url",
    "mother_tongue", "prison_name", "prison_cell_block",
    "arrest_date", "arrest_location", "charges_en", "charges_fa",
    "lawyer_name", "lawyer_persecuted",
    "last_words_en", "last_words_fa", "international_recognition",
    "family_member_killed", "disability_status",
}


async def apply_update(
    pool,
    victim_id: Any,
    slug: str,
    updates: dict[str, Any],
    dry_run: bool,
) -> None:
    if not updates:
        print(f"  - {slug}: no changes")
        return

    safe = {k: v for k, v in updates.items() if k in ALLOWED_COLUMNS}
    if not safe:
        print(f"  - {slug}: no whitelisted columns to update")
        return

    print(f"  + {slug}: would update {len(safe)} column(s)")
    for col, val in safe.items():
        preview = (val[:80] + "…") if isinstance(val, str) and len(val) > 80 else val
        print(f"      {col} = {preview!r}")

    if dry_run:
        return

    # Build parameterized UPDATE with NULL-guard in WHERE so we *never* overwrite
    set_clauses = []
    where_null_clauses = []
    params: list[Any] = [victim_id]
    for i, (col, val) in enumerate(safe.items(), start=2):
        set_clauses.append(f"{col} = ${i}")
        # For booleans: only update if currently FALSE (matches the "default false" semantics)
        if isinstance(val, bool):
            where_null_clauses.append(f"({col} IS NULL OR {col} = FALSE)")
        else:
            where_null_clauses.append(f"{col} IS NULL")
        params.append(val)

    sql = (
        f"UPDATE victims SET {', '.join(set_clauses)} "
        f"WHERE id = $1 AND ({' OR '.join(where_null_clauses)})"
    )
    async with pool.acquire() as conn:
        result = await conn.execute(sql, *params)
        print(f"      → {result}")


# ============================================================================
# Simulate mode — offline fixture
# ============================================================================
SIMULATE_FIXTURE = {
    "sharmahd-jamshid-2024": {
        "P103": [{"value": "Q188", "label": "German", "city": ""}],
        "P166": [
            {"value": "Q-fake-1", "label": "Mass Media Award", "city": ""},
        ],
        "P856": [{"value": "https://tondar.org/", "label": "", "city": ""}],
    },
}


# ============================================================================
# Main
# ============================================================================
async def run(args: argparse.Namespace) -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not args.simulate and not database_url:
        print("ERROR: DATABASE_URL env var required (or use --simulate).", file=sys.stderr)
        return 2

    targets = TARGETS
    if args.only:
        targets = [t for t in TARGETS if t[0] == args.only]
        if not targets:
            print(f"ERROR: --only={args.only} matched no slug", file=sys.stderr)
            return 2

    # --- Resolve QIDs -------------------------------------------------------
    resolved: dict[str, Optional[str]] = {}
    if args.simulate:
        for slug, qid, _ in targets:
            resolved[slug] = qid or "Q-SIM"
    else:
        print("Resolving QIDs…")
        for slug, qid, search_name in targets:
            if qid:
                resolved[slug] = qid
                print(f"  • {slug}: {qid} (preset)")
            else:
                got = await resolve_qid(search_name)
                resolved[slug] = got
                print(f"  • {slug}: {got or 'NOT FOUND'} (via search {search_name!r})")
                await asyncio.sleep(0.5)  # rate-limit politeness

    # --- DB pool ------------------------------------------------------------
    pool = None
    if not args.simulate:
        try:
            pool = await get_db_pool(database_url)  # type: ignore[arg-type]
        except Exception as e:
            print(f"ERROR connecting to DB: {e}", file=sys.stderr)
            return 3

    # --- Per-victim loop ----------------------------------------------------
    print()
    print(f"Processing {len(targets)} victims  (dry_run={not args.apply}, simulate={args.simulate})")
    print("=" * 72)

    for slug, _, _ in targets:
        qid = resolved.get(slug)
        print(f"\n{slug}  (QID={qid})")
        if not qid:
            print("  ! skipped: no QID")
            continue

        # Fetch Wikidata
        if args.simulate:
            wd_data = SIMULATE_FIXTURE.get(slug, {})
        else:
            wd_data = await fetch_wikidata(qid)
            await asyncio.sleep(0.8)

        if not wd_data:
            print("  ! no wikidata data returned")
            continue

        # Fetch current DB row (or fake one for simulate)
        if args.simulate:
            current_row = {"id": -1, "slug": slug}  # everything else NULL
        else:
            current_row = await fetch_victim(pool, slug)  # type: ignore[arg-type]
            if not current_row:
                print(f"  ! skipped: slug not found in victims table")
                continue

        updates = map_to_victim_columns(wd_data, current_row)
        victim_id = current_row.get("id", -1)

        if args.simulate:
            # No pool in simulate — just print
            await apply_update(None, victim_id, slug, updates, dry_run=True)  # type: ignore[arg-type]
        else:
            await apply_update(pool, victim_id, slug, updates, dry_run=not args.apply)  # type: ignore[arg-type]

    if pool is not None:
        await pool.close()

    print()
    print("Done.")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="actually execute UPDATEs (default: dry-run)")
    p.add_argument("--dry-run", action="store_true", help="explicit dry-run (default behaviour)")
    p.add_argument("--simulate", action="store_true", help="offline mode using built-in fixture (no DB, no network)")
    p.add_argument("--only", type=str, default=None, help="restrict to a single slug")
    args = p.parse_args()

    if args.apply and args.dry_run:
        print("ERROR: --apply and --dry-run are mutually exclusive", file=sys.stderr)
        return 2

    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
