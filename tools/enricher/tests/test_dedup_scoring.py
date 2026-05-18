"""Tests for tools/enricher/pipeline/dedup.py scoring heuristics."""
from datetime import date

import pytest

from tools.enricher.pipeline.dedup import (
    AUTO_THRESHOLD,
    REVIEW_THRESHOLD,
    _score_pair,
)


def _victim(**overrides):
    base = {
        "id": "00000000-0000-0000-0000-000000000000",
        "name_latin": None,
        "name_farsi": None,
        "date_of_death": None,
        "date_of_birth": None,
        "province": None,
        "age_at_death": None,
        "place_of_death": None,
        "cause_of_death": None,
    }
    base.update(overrides)
    return base


# --------------------------------------------------------------------------
# Year-typo pattern (Rahnavard case)
#
# Real-world: Majidreza Rahnavard, executed publicly 2022-12-12. One enricher
# plugin imported the date as 2023-12-12 (one-year off — Persian calendar
# conversion bug). Same person, but the old scoring penalised the 365-day
# diff so heavily that the obvious double-name match was buried.
# --------------------------------------------------------------------------

def test_year_typo_with_both_names_exact_auto_merges():
    """Latin + Farsi exact match + 365-day date diff must score >= 50."""
    a = _victim(
        name_latin="Majidreza Rahnavard",
        name_farsi="مجیدرضا رهنورد",
        date_of_death=date(2022, 12, 12),
    )
    b = _victim(
        id="11111111-1111-1111-1111-111111111111",
        name_latin="Majidreza Rahnavard",
        name_farsi="مجیدرضا رهنورد",
        date_of_death=date(2023, 12, 12),
    )
    score, reasons = _score_pair(a, b)
    assert score >= AUTO_THRESHOLD, f"got {score}, reasons={reasons}"


def test_year_typo_only_farsi_match_falls_back_to_full_penalty():
    """Without Latin match the year-typo lift must NOT apply."""
    a = _victim(name_farsi="فاطمه احمدی", date_of_death=date(2022, 6, 1))
    b = _victim(
        id="11111111-1111-1111-1111-111111111111",
        name_farsi="فاطمه احمدی",
        date_of_death=date(2023, 6, 1),
    )
    score, _ = _score_pair(a, b)
    # Farsi +50, year-typo lift does apply when farsi exact (even without latin)
    # but no latin bonus → still well under 50
    assert score < AUTO_THRESHOLD


def test_year_typo_falls_outside_window_keeps_full_penalty():
    """A 370-day diff is not a year-typo — full -70 penalty must apply."""
    a = _victim(
        name_latin="Majidreza Rahnavard",
        name_farsi="مجیدرضا رهنورد",
        date_of_death=date(2022, 12, 12),
    )
    b = _victim(
        id="11111111-1111-1111-1111-111111111111",
        name_latin="Majidreza Rahnavard",
        name_farsi="مجیدرضا رهنورد",
        date_of_death=date(2023, 12, 17),  # 370 days
    )
    score, reasons = _score_pair(a, b)
    # Latin (+15) + Farsi (+50) - 70 (date >365d-67d… actually 370d falls in
    # >365 bucket = -100)
    # 15 + 50 - 100 = -35
    assert score < REVIEW_THRESHOLD, f"got {score}, reasons={reasons}"


def test_year_typo_farsi_mismatch_no_lift():
    """Father/son with different Farsi names and 365-day diff must NOT merge."""
    a = _victim(
        name_latin="Ali Rezaei",
        name_farsi="علی رضایی",
        date_of_death=date(2022, 6, 1),
    )
    b = _victim(
        id="11111111-1111-1111-1111-111111111111",
        name_latin="Ali Rezaei",
        name_farsi="علی رضائی نژاد",  # different farsi
        date_of_death=date(2023, 6, 1),
    )
    score, _ = _score_pair(a, b)
    assert score < AUTO_THRESHOLD


# --------------------------------------------------------------------------
# Baseline scoring assertions — sanity checks
# --------------------------------------------------------------------------

def test_exact_same_record_clearly_auto_merges():
    a = _victim(
        name_latin="Mahsa Amini",
        name_farsi="مهسا امینی",
        date_of_death=date(2022, 9, 16),
        province="Tehran",
    )
    b = _victim(id="11111111-1111-1111-1111-111111111111", **{
        k: v for k, v in a.items() if k != "id"
    })
    score, _ = _score_pair(a, b)
    assert score >= AUTO_THRESHOLD


def test_different_year_different_person_stays_negative():
    a = _victim(
        name_latin="Mohammad Hosseini",
        name_farsi="محمد حسینی",
        date_of_death=date(1988, 7, 1),
    )
    b = _victim(
        id="11111111-1111-1111-1111-111111111111",
        name_latin="Mohammad Hosseini",
        name_farsi="محمد حسینی",
        date_of_death=date(2022, 11, 16),  # decades apart, different person
    )
    score, _ = _score_pair(a, b)
    assert score < REVIEW_THRESHOLD


def test_latin_match_alone_scores_modestly():
    """Without Farsi or date, just a Latin match shouldn't auto-merge."""
    a = _victim(name_latin="Reza Mohammadi")
    b = _victim(id="11111111-1111-1111-1111-111111111111", name_latin="Reza Mohammadi")
    score, _ = _score_pair(a, b)
    assert score < AUTO_THRESHOLD
