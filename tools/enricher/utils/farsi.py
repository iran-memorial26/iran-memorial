"""Farsi name normalization — ported from dedup_2026_internal.py."""

from __future__ import annotations

import re
import unicodedata

# Arabic/Farsi diacritics (tashkeel)
ARABIC_DIACRITICS = re.compile(
    "[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4"
    "\u06E7-\u06E8\u06EA-\u06ED\uFE70-\uFE7F]"
)

# Zero-width characters
ZERO_WIDTH = re.compile("[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]")

ZWNJ = "\u200c"


def normalize_farsi(name: str | None) -> str:
    """Normalize a Farsi name for matching.

    Steps: strip → NFC → remove diacritics → remove ZWNJ/zero-width →
    map letter variants (ي→ی, ك→ک, ة→ه, أ/إ/آ→ا) → remove whitespace.
    """
    if not name:
        return ""

    s = name.strip()
    s = unicodedata.normalize("NFC", s)
    s = ARABIC_DIACRITICS.sub("", s)
    s = s.replace(ZWNJ, "")
    s = ZERO_WIDTH.sub("", s)

    # Letter variant mappings
    s = s.replace("\u064a", "\u06cc")  # Arabic Yeh ي → Farsi Yeh ی
    s = s.replace("\u0643", "\u06a9")  # Arabic Kaf ك → Farsi Kaf ک
    s = s.replace("\u0629", "\u0647")  # Teh Marbuta ة → Heh ه
    s = s.replace("\u0623", "\u0627")  # Alef Hamza Above أ → Alef ا
    s = s.replace("\u0625", "\u0627")  # Alef Hamza Below إ → Alef ا
    s = s.replace("\u0622", "\u0627")  # Alef Madda آ → Alef ا

    s = re.sub(r"\s+", "", s)
    return s
