"""Latin name normalization — ported from dedup_victims.py."""

from __future__ import annotations

import re

TRANSLITERATION_MAP = [
    ("mohammed", "muhammad"),
    ("mohammad", "muhammad"),
    ("hossein", "husayn"),
    ("hussein", "husayn"),
    ("hosein", "husayn"),
    ("husein", "husayn"),
    ("hosseini", "husayni"),
    ("husseini", "husayni"),
    ("abdol", "abd"),
    ("abdul", "abd"),
    ("abdal", "abd"),
    ("rasoul", "rasul"),
    ("kazem", "qasem"),
    ("ghasem", "qasem"),
    ("ghassem", "qasem"),
    ("qasem", "qasem"),
    ("fazi", "fazl"),
    ("fazl", "fazl"),
    ("seyyed", "seyed"),
    ("sayyid", "seyed"),
    ("sayyed", "seyed"),
    ("seied", "seyed"),
]

VOWEL_NORMALIZATIONS = [
    ("ou", "u"),
    ("oo", "u"),
    ("ee", "i"),
    ("ei", "ey"),
]


def normalize_latin(name: str | None) -> str:
    """Normalize a Latin name for matching.

    Steps: lowercase → remove parenthetical → remove punctuation →
    transliterate → normalize vowels → remove double letters.
    """
    if not name:
        return ""

    s = name.lower().strip()
    s = re.sub(r"\([^)]*\)", "", s).strip()
    s = re.sub(r"['\"`\-.]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    for pattern, replacement in TRANSLITERATION_MAP:
        s = s.replace(pattern, replacement)

    for pattern, replacement in VOWEL_NORMALIZATIONS:
        s = s.replace(pattern, replacement)

    s = re.sub(r"(.)\1", r"\1", s)
    return s.strip()


def name_word_set(name: str | None) -> frozenset[str]:
    """Get sorted word set from a normalized name for order-independent comparison."""
    normalized = normalize_latin(name)
    if not normalized:
        return frozenset()
    return frozenset(normalized.split())
