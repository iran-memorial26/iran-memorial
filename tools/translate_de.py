"""Batch-translate victim texts from English to German using GPT-4o-mini.

Usage:
    python3 tools/translate_de.py                     # Translate circumstances_en → circumstances_de
    python3 tools/translate_de.py --field occupation   # Different field
    python3 tools/translate_de.py --dry-run            # Preview without DB update
    python3 tools/translate_de.py --limit 100          # Only first 100
    python3 tools/translate_de.py --batch-size 60      # API concurrency (default 45)
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

import asyncpg
from openai import AsyncOpenAI, RateLimitError

# ── Config ───────────────────────────────────────────────────────────────────

TRANSLATABLE_FIELDS = {
    "circumstances": ("circumstances_en", "circumstances_de"),
    "occupation": ("occupation_en", "occupation_de"),
    "beliefs": ("beliefs_en", "beliefs_de"),
    "personality": ("personality_en", "personality_de"),
    "dreams": ("dreams_en", "dreams_de"),
    "burial_circumstances": ("burial_circumstances_en", "burial_circumstances_de"),
    "family_persecution": ("family_persecution_en", "family_persecution_de"),
}

SYSTEM_PROMPT = (
    "Du bist ein professioneller Übersetzer. Übersetze den folgenden biografischen Text "
    "über ein Opfer der Islamischen Republik Iran vom Englischen ins Deutsche. "
    "Behalte den sachlichen, respektvollen Ton bei. "
    "Übersetze nur — füge keine Informationen hinzu und lass nichts weg. "
    "Gib NUR die deutsche Übersetzung zurück, ohne Einleitung oder Kommentar."
)

MODEL = "gpt-4o-mini"
DEFAULT_CONCURRENCY = 45
MAX_RETRIES = 5
BASE_RETRY_DELAY = 5  # seconds


# ── Database ─────────────────────────────────────────────────────────────────

def get_dsn() -> str:
    """Get database connection string."""
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return dsn
    # Fallback: try enricher.toml
    toml_path = Path(__file__).parent / "enricher" / "enricher.toml"
    if toml_path.exists():
        for line in toml_path.read_text().splitlines():
            if line.strip().startswith("database_url"):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return val
    return "postgresql://Pedi@localhost:5432/iran_memorial"


async def load_victims(pool: asyncpg.Pool, en_col: str, de_col: str, limit: int | None) -> list[dict]:
    """Load victims that need translation (en NOT NULL, de IS NULL)."""
    sql = f"""
        SELECT id, {en_col} AS text_en
        FROM victims
        WHERE {en_col} IS NOT NULL
          AND LENGTH(TRIM({en_col})) > 0
          AND ({de_col} IS NULL OR TRIM({de_col}) = '')
        ORDER BY LENGTH({en_col}) DESC
    """
    if limit:
        sql += f" LIMIT {limit}"
    rows = await pool.fetch(sql)
    return [{"id": r["id"], "text_en": r["text_en"]} for r in rows]


async def save_translation(pool: asyncpg.Pool, victim_id: str, de_col: str, text_de: str):
    """Save a single translation to the database."""
    await pool.execute(
        f'UPDATE victims SET {de_col} = $1 WHERE id = $2',
        text_de, victim_id,
    )


# ── Translation ──────────────────────────────────────────────────────────────

async def translate_text(client: AsyncOpenAI, text_en: str) -> str | None:
    """Translate a single text from English to German."""
    for attempt in range(MAX_RETRIES):
        try:
            response = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text_en},
                ],
                temperature=0.3,
                max_tokens=min(len(text_en) * 2, 16000),
            )
            return response.choices[0].message.content.strip()
        except RateLimitError:
            delay = BASE_RETRY_DELAY * (2 ** attempt)
            print(f"  Rate limit hit, waiting {delay}s...")
            await asyncio.sleep(delay)
        except Exception as e:
            print(f"  Error: {e}")
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(BASE_RETRY_DELAY)
            else:
                return None
    return None


async def translate_batch(
    client: AsyncOpenAI,
    pool: asyncpg.Pool,
    victims: list[dict],
    de_col: str,
    dry_run: bool,
    concurrency: int,
):
    """Translate victims with semaphore-based concurrency (no batch gaps)."""
    total = len(victims)
    translated = 0
    failed = 0
    start_time = time.time()
    sem = asyncio.Semaphore(concurrency)
    last_log = [0]  # mutable for closure

    print(f"\nTranslating {total} texts → {de_col}")
    print(f"Model: {MODEL} | Concurrency: {concurrency} | Dry run: {dry_run}\n")

    async def process_one(victim: dict):
        nonlocal translated, failed
        async with sem:
            text_de = await translate_text(client, victim["text_en"])

        if text_de is None:
            failed += 1
        else:
            if not dry_run:
                await save_translation(pool, victim["id"], de_col, text_de)
            translated += 1

        # Log every 45 completions
        done = translated + failed
        if done - last_log[0] >= concurrency:
            last_log[0] = done
            elapsed = time.time() - start_time
            rate = done / elapsed if elapsed > 0 else 0
            remaining = (total - done) / rate if rate > 0 else 0
            print(
                f"  Progress: {done}/{total} "
                f"({translated} OK, {failed} failed) "
                f"| {rate:.1f}/s | ~{remaining / 60:.0f}min remaining"
            )

    await asyncio.gather(*[process_one(v) for v in victims])

    elapsed = time.time() - start_time
    print(f"\nDone in {elapsed:.0f}s")
    print(f"  Translated: {translated}")
    print(f"  Failed: {failed}")


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Translate victim texts EN → DE")
    parser.add_argument("--field", default="circumstances", choices=TRANSLATABLE_FIELDS.keys(),
                        help="Field to translate (default: circumstances)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB update")
    parser.add_argument("--limit", type=int, default=None, help="Max victims to translate")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_CONCURRENCY,
                        help=f"API concurrency (default: {DEFAULT_CONCURRENCY})")
    args = parser.parse_args()

    en_col, de_col = TRANSLATABLE_FIELDS[args.field]

    # Load .env for OPENAI_API_KEY
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set. Add it to .env or environment.")
        sys.exit(1)

    client = AsyncOpenAI(api_key=api_key)
    dsn = get_dsn()

    print(f"Connecting to DB...")
    pool = await asyncpg.create_pool(dsn=dsn, min_size=2, max_size=5)

    try:
        victims = await load_victims(pool, en_col, de_col, args.limit)
        if not victims:
            print(f"No victims to translate ({en_col} → {de_col}). All done!")
            return

        print(f"Found {len(victims)} victims needing {en_col} → {de_col}")

        # Show cost estimate
        total_chars = sum(len(v["text_en"]) for v in victims)
        est_tokens = total_chars / 3.5  # rough estimate
        est_cost = (est_tokens * 0.15 + est_tokens * 1.2 * 0.60) / 1_000_000
        print(f"Estimated: ~{total_chars:,} chars, ~{est_tokens:,.0f} tokens, ~${est_cost:.2f}")

        if not args.dry_run:
            print("\nStarting translation in 3 seconds... (Ctrl+C to cancel)")
            await asyncio.sleep(3)

        await translate_batch(client, pool, victims, de_col, args.dry_run, args.batch_size)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
