"""Jalali (Solar Hijri) to Gregorian date conversion — pure Python."""

from __future__ import annotations

import re
from datetime import date
from typing import Optional


# Persian month names → month number (1-indexed)
JALALI_MONTHS: dict[str, int] = {
    "فروردین": 1,
    "اردیبهشت": 2,
    "خرداد": 3,
    "تیر": 4,
    "مرداد": 5,
    "شهریور": 6,
    "مهر": 7,
    "آبان": 8,
    "آذر": 9,
    "دی": 10,
    "بهمن": 11,
    "اسفند": 12,
}

# Persian numeral mapping
_PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
_DIGIT_MAP = {p: str(i) for i, p in enumerate(_PERSIAN_DIGITS)}


def persian_to_int(text: str) -> int:
    """Convert Persian numeral string to integer. '۱۲۳' → 123."""
    ascii_str = "".join(_DIGIT_MAP.get(ch, ch) for ch in text.strip())
    return int(ascii_str)


def jalali_to_gregorian(jy: int, jm: int, jd: int) -> date:
    """Convert Jalali date to Gregorian date.

    Uses the standard algorithm based on Julian Day Number.
    """
    jy1 = jy - 979
    jm1 = jm - 1
    jd1 = jd - 1

    # Total days from Jalali epoch
    j_day_no = 365 * jy1 + (jy1 // 33) * 8 + (jy1 % 33 + 3) // 4

    for i in range(jm1):
        j_day_no += 31 if i < 6 else 30

    j_day_no += jd1

    # Convert to Gregorian
    g_day_no = j_day_no + 79

    gy = 1600 + 400 * (g_day_no // 146097)
    g_day_no %= 146097

    if g_day_no >= 36525:
        g_day_no -= 1
        gy += 100 * (g_day_no // 36524)
        g_day_no %= 36524
        if g_day_no >= 365:
            g_day_no += 1

    gy += 4 * (g_day_no // 1461)
    g_day_no %= 1461

    if g_day_no >= 366:
        gy += (g_day_no - 1) // 365
        g_day_no = (g_day_no - 1) % 365

    g_days_in_month = [31, 28 + (1 if (gy % 4 == 0 and gy % 100 != 0) or gy % 400 == 0 else 0),
                       31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

    gm = 0
    for i, dim in enumerate(g_days_in_month):
        if g_day_no < dim:
            gm = i + 1
            break
        g_day_no -= dim

    gd = g_day_no + 1
    return date(gy, gm, gd)


# Regex: optional day + month name + year (all in Persian numerals)
_DATE_RE = re.compile(
    r"([۰-۹]+)\s+"                                         # day
    r"(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور"
    r"|مهر|آبان|آذر|دی|بهمن|اسفند)\s+"                      # month
    r"([۰-۹]{4})"                                           # year
)

_DATE_NO_DAY_RE = re.compile(
    r"(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور"
    r"|مهر|آبان|آذر|دی|بهمن|اسفند)\s+"
    r"([۰-۹]{4})"
)


def parse_jalali_date(text: str) -> Optional[date]:
    """Parse a Jalali date string like '۱۸ دی ۱۴۰۴' → date(2026, 1, 8).

    Also handles dates without day: 'دی ۱۴۰۴' → first of month.
    Returns None if unparseable.
    """
    if not text:
        return None

    # Try full date first (day + month + year)
    m = _DATE_RE.search(text)
    if m:
        day = persian_to_int(m.group(1))
        month = JALALI_MONTHS[m.group(2)]
        year = persian_to_int(m.group(3))
        try:
            return jalali_to_gregorian(year, month, day)
        except (ValueError, KeyError):
            return None

    # Try without day (month + year only)
    m = _DATE_NO_DAY_RE.search(text)
    if m:
        month = JALALI_MONTHS[m.group(1)]
        year = persian_to_int(m.group(2))
        try:
            return jalali_to_gregorian(year, month, 1)
        except (ValueError, KeyError):
            return None

    return None
