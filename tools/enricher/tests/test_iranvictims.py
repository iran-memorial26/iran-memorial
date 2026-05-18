"""Tests for the iranvictims.com CSV-based plugin."""

import pytest
from datetime import date

from tools.enricher.sources.iranvictims import (
    parse_csv_rows,
    parse_age,
    parse_date,
    parse_source_urls,
)


SAMPLE_CSV = """Card ID,English Name,Persian Name,Age,Location of Death,Date of Death,Status,Source URLs,Notes
5443,Mohammadreza Kordgari,محمدرضا کردگاری,,Isfahan,2026-02-10,killed,"https://x.com/post1, https://t.me/channel/123",Environmental activist shot during protests.
3825,Ali Heydari,علی حیدری,20,Mashhad,2026-02-09,killed,https://x.com/post2,Arrested on January 8 and shot.
5359,Aref Afrasab,,30,Farsan,2026-02-09,arrested,https://x.com/post3,Arrested by plainclothes forces.
1001,,,,,,,,"
"""


class TestParseCsvRows:
    def test_parses_all_rows(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert len(rows) == 4  # includes arrested + empty

    def test_extracts_card_id(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[0]["card_id"] == "5443"
        assert rows[1]["card_id"] == "3825"

    def test_extracts_names(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[0]["name_en"] == "Mohammadreza Kordgari"
        assert rows[0]["name_fa"] == "محمدرضا کردگاری"

    def test_extracts_farsi_name_none_if_empty(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[2]["name_fa"] is None  # Aref Afrasab has no Farsi name

    def test_extracts_age(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[0]["age"] is None  # empty
        assert rows[1]["age"] == "20"

    def test_extracts_location(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[0]["location"] == "Isfahan"
        assert rows[1]["location"] == "Mashhad"

    def test_extracts_date(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[0]["date"] == "2026-02-10"

    def test_extracts_status(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[0]["status"] == "killed"
        assert rows[2]["status"] == "arrested"

    def test_extracts_source_urls(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert "https://x.com/post1" in rows[0]["source_urls"]
        assert "https://t.me/channel/123" in rows[0]["source_urls"]

    def test_extracts_notes(self):
        rows = parse_csv_rows(SAMPLE_CSV)
        assert rows[0]["notes"] == "Environmental activist shot during protests."

    def test_skips_rows_without_card_id(self):
        csv = "Card ID,English Name\n,NoID\n123,HasID\n"
        rows = parse_csv_rows(csv)
        assert len(rows) == 1
        assert rows[0]["card_id"] == "123"


class TestParseAge:
    def test_integer(self):
        assert parse_age("20") == 20

    def test_age_with_text(self):
        assert parse_age("about 25 years") == 25

    def test_none(self):
        assert parse_age(None) is None

    def test_empty(self):
        assert parse_age("") is None

    def test_no_digits(self):
        assert parse_age("unknown") is None


class TestParseDate:
    def test_iso_date(self):
        assert parse_date("2026-02-10") == date(2026, 2, 10)

    def test_iso_with_time(self):
        assert parse_date("2026-02-10T12:00:00") == date(2026, 2, 10)

    def test_none(self):
        assert parse_date(None) is None

    def test_empty(self):
        assert parse_date("") is None

    def test_invalid(self):
        assert parse_date("not-a-date") is None


class TestParseSourceUrls:
    def test_comma_separated(self):
        urls = parse_source_urls(
            "https://x.com/post1, https://t.me/channel/123"
        )
        assert len(urls) == 2
        assert urls[0] == "https://x.com/post1"
        assert urls[1] == "https://t.me/channel/123"

    def test_single_url(self):
        urls = parse_source_urls("https://x.com/post1")
        assert len(urls) == 1

    def test_none(self):
        assert parse_source_urls(None) == []

    def test_empty(self):
        assert parse_source_urls("") == []

    def test_filters_non_http(self):
        urls = parse_source_urls("not-a-url, https://x.com/post1")
        assert len(urls) == 1
