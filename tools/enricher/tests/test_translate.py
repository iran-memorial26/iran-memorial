"""Tests for tools/enricher/pipeline/translate.py.

The Anthropic SDK is not available in the test environment, so we test
the pure functions (custom_id round-trip, request building, target/field
validation) without touching the network. The DB-shaped functions are
tested through the public run_translate dispatcher with monkeypatched
stubs.
"""
from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

import pytest

from tools.enricher.pipeline.translate import (
    BATCH_CHUNK_SIZE,
    MAX_OUTPUT_TOKENS,
    MODEL_HAIKU,
    SUPPORTED_TARGETS,
    SYSTEM_PROMPT,
    TRANSLATABLE_FIELDS,
    _Row,
    _build_request,
    run_translate,
)


# --------------------------------------------------------------------------
# custom_id encoding survives a round-trip — this is load-bearing because
# we use it to route results back to the right (victim, field, target).
# --------------------------------------------------------------------------

def test_custom_id_roundtrip():
    r = _Row(
        victim_id="6fa620c1-d29b-44f1-a2ba-51dd1805c062",
        field_name="circumstances",
        source_text="ignored",
        target="de",
    )
    vid, fname, tgt = _Row.parse_custom_id(r.custom_id)
    assert (vid, fname, tgt) == (
        "6fa620c1-d29b-44f1-a2ba-51dd1805c062",
        "circumstances",
        "de",
    )


def test_custom_id_handles_field_with_underscore():
    r = _Row(
        victim_id="00000000-0000-0000-0000-000000000000",
        field_name="burial_circumstances",
        source_text="x",
        target="fa",
    )
    vid, fname, tgt = _Row.parse_custom_id(r.custom_id)
    assert vid == "00000000-0000-0000-0000-000000000000"
    assert fname == "burial_circumstances"
    assert tgt == "fa"


def test_custom_id_pattern_matches_anthropic_constraint():
    """custom_id must be ^[a-zA-Z0-9_-]{1,64}$ per Anthropic API."""
    import re
    r = _Row(
        victim_id="6fa620c1-d29b-44f1-a2ba-51dd1805c062",
        field_name="burial_circumstances",  # longest field name
        source_text="x",
        target="de",
    )
    assert re.match(r"^[a-zA-Z0-9_-]{1,64}$", r.custom_id), r.custom_id


# --------------------------------------------------------------------------
# _build_request — the shape we send to Anthropic
# --------------------------------------------------------------------------

def test_build_request_de():
    row = _Row(
        victim_id="v1",
        field_name="circumstances",
        source_text="Mr. Sadaqiani was a surgeon at Tabriz University.",
        target="de",
    )
    req = _build_request(row)
    assert req["custom_id"] == row.custom_id
    p = req["params"]
    assert p["model"] == MODEL_HAIKU
    assert p["max_tokens"] == MAX_OUTPUT_TOKENS
    assert "German" in p["system"]
    assert p["messages"] == [
        {"role": "user", "content": row.source_text}
    ]


def test_build_request_fa_uses_persian_in_system_prompt():
    row = _Row(
        victim_id="v1", field_name="occupation", source_text="surgeon", target="fa"
    )
    req = _build_request(row)
    assert "Persian" in req["params"]["system"]


def test_system_prompt_forbids_preamble_and_quotes():
    """Tone discipline guards against the most common LLM translation failures."""
    assert "ONLY the translation" in SYSTEM_PROMPT
    assert "respectful" in SYSTEM_PROMPT or "neutral" in SYSTEM_PROMPT


# --------------------------------------------------------------------------
# Validation: catch typos / unsupported targets/fields BEFORE we burn API $
# --------------------------------------------------------------------------

def test_unsupported_target_raises():
    with pytest.raises(ValueError, match="unsupported targets"):
        asyncio.run(
            run_translate(
                database_url="postgres://nope",
                targets=["ar"],  # not supported in phase 1
                fields=["circumstances"],
                dry_run=True,
            )
        )


def test_unknown_field_raises():
    with pytest.raises(ValueError, match="unknown fields"):
        asyncio.run(
            run_translate(
                database_url="postgres://nope",
                targets=["de"],
                fields=["bogus"],
                dry_run=True,
            )
        )


# --------------------------------------------------------------------------
# Constants we rely on for cost reasoning — guard against silent edits.
# --------------------------------------------------------------------------

def test_supported_targets_phase1():
    assert set(SUPPORTED_TARGETS) == {"de", "fa"}


def test_translatable_fields_match_schema():
    """If a field is removed from the schema, remove it here too."""
    assert "circumstances" in TRANSLATABLE_FIELDS
    assert "occupation" in TRANSLATABLE_FIELDS
    assert "beliefs" in TRANSLATABLE_FIELDS


def test_batch_chunk_size_under_anthropic_limit():
    # Anthropic's hard limit is 100_000 requests per batch.
    assert BATCH_CHUNK_SIZE <= 100_000


# --------------------------------------------------------------------------
# End-to-end dry-run with a stubbed DB layer — proves we count + categorize
# without touching the network.
# --------------------------------------------------------------------------

def test_dry_run_counts_per_field_target(monkeypatch):
    """run_translate(dry_run=True) must categorize rows by field+target."""
    from tools.enricher.pipeline import translate as mod

    # Stub the pool + fetch
    fake_pool = MagicMock()

    async def fake_get_pool(_url):
        return fake_pool

    counter = {"calls": 0}

    async def fake_fetch_pending(pool, *, field_name, target, limit):
        # Return varying counts so we can verify per-key bookkeeping
        counter["calls"] += 1
        n = {
            ("circumstances", "de"): 3,
            ("circumstances", "fa"): 2,
            ("occupation", "de"): 1,
            ("occupation", "fa"): 0,
        }[(field_name, target)]
        return [
            _Row(
                victim_id=f"id-{field_name}-{target}-{i}",
                field_name=field_name,
                source_text="src",
                target=target,
            )
            for i in range(n)
        ]

    monkeypatch.setattr(mod, "get_pool", fake_get_pool)
    monkeypatch.setattr(mod, "_fetch_pending", fake_fetch_pending)

    stats = asyncio.run(
        run_translate(
            database_url="postgres://stub",
            targets=["de", "fa"],
            fields=["circumstances", "occupation"],
            dry_run=True,
        )
    )

    assert counter["calls"] == 4  # 2 targets × 2 fields
    assert stats.queried == 6  # 3 + 2 + 1 + 0
    assert stats.submitted == 0  # dry-run
    assert stats.by_field == {
        "circumstances_de": 3,
        "circumstances_fa": 2,
        "occupation_de": 1,
        "occupation_fa": 0,
    }
