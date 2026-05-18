"""Translate victim biographical fields via Anthropic Messages Batches API.

Most records arrive from English-language sources (Boroumand, CPJ, HRANA,
witness.report). The schema has `_en`, `_fa`, `_de` columns for the long-form
biographical fields, but only `_en` is reliably populated:

    circumstances:  ~78% en, ~8% fa, ~19% de
    occupation:     ~8%  en, near-zero fa/de
    beliefs:        ~10% en, 0 fa, 0 de
    dreams/personality/family_persecution/burial_circumstances: similar

When a user opens `/de/victims/<slug>` we currently fall back to the `_en`
text, so a German UI suddenly switches to English mid-page. That's
disrespectful to the families this memorial exists for.

This pipeline closes the gap by translating every populated `_en` field
into `_de` and `_fa` using Claude Haiku via the Anthropic **Messages
Batches API** — async submission, 50% cost reduction, results within 24h.

Cost estimate for the full sweep (de + fa, all six long-form fields):
    ~35k texts * 2 langs * ~350 tokens avg = ~$40 total

CLI:
    python3 -m tools.enricher translate --target de --field circumstances --limit 10 --apply
    python3 -m tools.enricher translate --target de --field circumstances --apply
    python3 -m tools.enricher translate --target de --apply           # all fields
    python3 -m tools.enricher translate --target de,fa --apply        # all fields, both langs
    python3 -m tools.enricher translate-poll <batch_id>               # resume / fetch results

Tone discipline (system prompt):
    - Strictly factual, neutral, respectful — this is memorial text for
      families. No editorializing, no political framing.
    - Preserve all proper nouns (names, places, organizations).
    - Preserve dates as written.
    - Don't translate quoted material — preserve original wording.
    - Output ONLY the translation, no commentary, no preamble.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Iterable

from ..db.pool import get_pool

log = logging.getLogger("enricher.translate")

# Cheap model is plenty for short biographical paragraphs. Use a pinned
# snapshot, not an alias, so production runs are reproducible.
MODEL_HAIKU = "claude-haiku-4-5-20251001"

# Hard cap on tokens. Most biographical paragraphs are 100-400 tokens;
# 1024 leaves comfortable headroom for the few long ones.
MAX_OUTPUT_TOKENS = 1024

# Anthropic limit: 100,000 requests per batch. Chunk well below that to
# keep checkpoint-and-resume cheap if a batch fails.
BATCH_CHUNK_SIZE = 5000

# Fields we translate. Tied to columns in the victims table:
#   {field}_en  →  {field}_{target}
TRANSLATABLE_FIELDS = (
    "circumstances",
    "occupation",
    "beliefs",
    "dreams",
    "personality",
    "family_persecution",
    "burial_circumstances",
)

# Languages we can fill column-side. The other 13 site locales need a
# separate translations table (Phase 2).
SUPPORTED_TARGETS = ("de", "fa")

LANG_FULL_NAME = {
    "de": "German",
    "fa": "Persian (Farsi)",
}

SYSTEM_PROMPT = """You are translating short biographical passages for a public memorial database that documents victims of state violence in Iran. The audience is bereaved families and human-rights researchers.

Translation rules:
1. Output ONLY the translation. No preamble, no commentary, no quotation marks around the result.
2. Translate into {target_full}. Maintain a respectful, factual, neutral register — never editorialize.
3. Preserve all proper nouns exactly as written: personal names, place names, organization names, court names, prison names.
4. Preserve dates exactly as written (do not reformat).
5. Preserve direct quotes verbatim. If quoted material is in another language, keep it in that language.
6. Do not add information that is not in the source. Do not omit information that is in the source.
7. If the source text is already in {target_full}, return it unchanged.
8. Do not translate terms of art that have no good {target_full} equivalent (e.g. "Pasdaran") — keep them and add a brief parenthetical gloss only if absolutely necessary for comprehension.
"""


@dataclass
class TranslateStats:
    """Counts emitted by run_translate / poll_batch."""

    queried: int = 0
    submitted: int = 0
    batch_id: str = ""
    succeeded: int = 0
    errored: int = 0
    applied: int = 0
    by_field: dict[str, int] = field(default_factory=dict)


@dataclass
class _Row:
    """One (victim, field, source_text) tuple staged for translation."""

    victim_id: str
    field_name: str
    source_text: str
    target: str

    @property
    def custom_id(self) -> str:
        """Deterministic, opaque ID we send to Anthropic + receive back.

        Anthropic restricts custom_id to ``[a-zA-Z0-9_-]{1,64}``. UUIDs are
        always 36 chars (with hyphens) and target codes are 2 chars, so we
        can recover all three components by fixed-offset slicing without a
        delimiter that collides with the underscores inside field names
        like ``burial_circumstances``.

        Layout: ``<uuid>_<field>_<target>`` — max 60 chars.
        """
        return f"{self.victim_id}_{self.field_name}_{self.target}"

    @staticmethod
    def parse_custom_id(cid: str) -> tuple[str, str, str]:
        # UUID is always 36 chars in canonical form, target is always 2 chars,
        # everything in between is the field name.
        victim_id = cid[:36]
        target = cid[-2:]
        field_name = cid[37:-3]  # skip leading '_' after uuid and trailing '_<target>'
        return victim_id, field_name, target


# --------------------------------------------------------------------------
# Stage 1: pull untranslated rows
# --------------------------------------------------------------------------

async def _fetch_pending(
    pool, *, field_name: str, target: str, limit: int | None
) -> list[_Row]:
    """Rows where ``{field_name}_en`` is populated but ``{field_name}_{target}`` is NULL."""
    src_col = f"{field_name}_en"
    dst_col = f"{field_name}_{target}"
    sql = f"""
        SELECT id::text, {src_col} AS source_text
          FROM victims
         WHERE {src_col} IS NOT NULL
           AND length(trim({src_col})) > 0
           AND ({dst_col} IS NULL OR length(trim({dst_col})) = 0)
         ORDER BY created_at DESC
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql)
    return [
        _Row(
            victim_id=r["id"],
            field_name=field_name,
            source_text=r["source_text"],
            target=target,
        )
        for r in rows
    ]


# --------------------------------------------------------------------------
# Stage 2: submit Batches API job
# --------------------------------------------------------------------------

def _build_request(row: _Row) -> dict:
    """One Anthropic batch-request entry."""
    target_full = LANG_FULL_NAME[row.target]
    return {
        "custom_id": row.custom_id,
        "params": {
            "model": MODEL_HAIKU,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "system": SYSTEM_PROMPT.format(target_full=target_full),
            "messages": [{"role": "user", "content": row.source_text}],
        },
    }


def _submit_batch(client, rows: list[_Row]) -> str:
    """Submit a single batch chunk, return its batch_id."""
    requests = [_build_request(r) for r in rows]
    batch = client.messages.batches.create(requests=requests)
    log.info(
        "Submitted batch %s (%d requests, status=%s)",
        batch.id,
        len(requests),
        batch.processing_status,
    )
    return batch.id


# --------------------------------------------------------------------------
# Stage 3: poll + collect results
# --------------------------------------------------------------------------

def _poll_until_done(client, batch_id: str, *, poll_interval: int = 30) -> None:
    """Block until the batch transitions to processing_status=ended."""
    while True:
        status = client.messages.batches.retrieve(batch_id)
        rc = status.request_counts
        log.info(
            "batch %s: %s (succeeded=%s errored=%s processing=%s)",
            batch_id,
            status.processing_status,
            rc.succeeded,
            rc.errored,
            rc.processing,
        )
        if status.processing_status == "ended":
            return
        time.sleep(poll_interval)


def _collect_results(client, batch_id: str) -> Iterable[tuple[_Row, str | None, str | None]]:
    """Yield (row, translation, error) tuples."""
    for entry in client.messages.batches.results(batch_id):
        vid, fname, tgt = _Row.parse_custom_id(entry.custom_id)
        # Reconstruct a minimal Row — only the routing keys matter here.
        row = _Row(victim_id=vid, field_name=fname, source_text="", target=tgt)
        if entry.result.type != "succeeded":
            err = getattr(entry.result, "error", None) or entry.result.type
            yield row, None, str(err)
            continue
        text = entry.result.message.content[0].text.strip()
        yield row, text or None, None


# --------------------------------------------------------------------------
# Stage 4: write translations back to DB
# --------------------------------------------------------------------------

async def _apply_translations(
    pool, rows: list[tuple[_Row, str]]
) -> int:
    """Update {field}_{target} for each (row, translation). Returns row count."""
    if not rows:
        return 0
    # Group by (field, target) so we can issue one UPDATE per column.
    by_col: dict[tuple[str, str], list[tuple[str, str]]] = {}
    for row, text in rows:
        by_col.setdefault((row.field_name, row.target), []).append(
            (row.victim_id, text)
        )

    total = 0
    async with pool.acquire() as conn:
        for (fname, target), pairs in by_col.items():
            dst_col = f"{fname}_{target}"
            await conn.executemany(
                f"UPDATE victims SET {dst_col} = $2 WHERE id = $1::uuid",
                pairs,
            )
            total += len(pairs)
    return total


# --------------------------------------------------------------------------
# Public entry points
# --------------------------------------------------------------------------

async def run_translate(
    database_url: str,
    *,
    targets: list[str],
    fields: list[str],
    limit: int | None = None,
    dry_run: bool = True,
    poll: bool = True,
    poll_interval: int = 30,
) -> TranslateStats:
    """End-to-end: fetch pending → submit batch → (optionally) poll + apply.

    Args:
        targets: lang codes to translate INTO (e.g. ["de", "fa"]).
        fields: column prefixes to translate (e.g. ["circumstances"]).
        limit: per-(field,target) cap. Useful for canary runs.
        dry_run: stage rows + count, do NOT submit a batch.
        poll: after submitting, block + apply results. Set False to fire-
            and-forget; caller resumes later via run_translate_poll.

    The submitted batch IDs are also logged so an operator can resume
    manually if the run is interrupted between submit + poll.
    """
    bad_targets = [t for t in targets if t not in SUPPORTED_TARGETS]
    if bad_targets:
        raise ValueError(
            f"unsupported targets: {bad_targets} (phase-1 supports {SUPPORTED_TARGETS}; "
            f"other locales need the translations table — phase 2)"
        )
    bad_fields = [f for f in fields if f not in TRANSLATABLE_FIELDS]
    if bad_fields:
        raise ValueError(f"unknown fields: {bad_fields} (allowed: {TRANSLATABLE_FIELDS})")

    pool = await get_pool(database_url)
    stats = TranslateStats()
    all_rows: list[_Row] = []
    for tgt in targets:
        for fname in fields:
            rows = await _fetch_pending(pool, field_name=fname, target=tgt, limit=limit)
            log.info("  pending  %s → %s : %d rows", fname, tgt, len(rows))
            stats.by_field[f"{fname}_{tgt}"] = len(rows)
            all_rows.extend(rows)
    stats.queried = len(all_rows)

    if not all_rows:
        log.info("nothing to translate.")
        return stats

    if dry_run:
        log.info("DRY RUN — %d rows would be submitted in batches of %d",
                 len(all_rows), BATCH_CHUNK_SIZE)
        return stats

    # Lazy import so callers without an API key don't pay the import cost.
    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError(
            "anthropic SDK not installed. Add to requirements + pip install."
        ) from e

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    # Chunk + submit
    batch_ids: list[str] = []
    for i in range(0, len(all_rows), BATCH_CHUNK_SIZE):
        chunk = all_rows[i : i + BATCH_CHUNK_SIZE]
        bid = _submit_batch(client, chunk)
        batch_ids.append(bid)
        stats.submitted += len(chunk)

    if not batch_ids:
        return stats

    # Caller wants fire-and-forget — log IDs and bail.
    if not poll:
        log.info("submitted %d batches: %s", len(batch_ids), batch_ids)
        log.info("resume with: enricher translate-poll <batch_id>")
        stats.batch_id = ",".join(batch_ids)
        return stats

    # Poll each chunk, collect, apply.
    for bid in batch_ids:
        _poll_until_done(client, bid, poll_interval=poll_interval)
        ok_rows: list[tuple[_Row, str]] = []
        for row, translation, err in _collect_results(client, bid):
            if err:
                stats.errored += 1
                log.warning("err %s : %s", row.custom_id, err)
                continue
            if translation:
                ok_rows.append((row, translation))
                stats.succeeded += 1
        applied = await _apply_translations(pool, ok_rows)
        stats.applied += applied
        log.info("batch %s: applied %d translations", bid, applied)

    stats.batch_id = ",".join(batch_ids)
    return stats


async def run_translate_poll(
    database_url: str, *, batch_id: str, dry_run: bool = False
) -> TranslateStats:
    """Resume a previously-submitted batch: poll → fetch → apply."""
    import anthropic

    client = anthropic.Anthropic()
    pool = await get_pool(database_url)
    stats = TranslateStats(batch_id=batch_id)

    _poll_until_done(client, batch_id)
    ok_rows: list[tuple[_Row, str]] = []
    for row, translation, err in _collect_results(client, batch_id):
        if err:
            stats.errored += 1
            continue
        if translation:
            ok_rows.append((row, translation))
            stats.succeeded += 1
    if not dry_run:
        stats.applied = await _apply_translations(pool, ok_rows)
    return stats
