"""Tests for Hengaw plugin headline parser + body parser."""

from datetime import date

from tools.enricher.sources.hengaw import (
    HengawPlugin,
    extract_name_from_title,
    is_target_title,
    parse_article_body,
)


class TestExtractName:
    def test_prisoner_executed(self):
        assert extract_name_from_title(
            "Prisoner Jafar Fakhrabadi executed at Yazd Central Prison"
        ) == "Jafar Fakhrabadi"

    def test_citizen_killed(self):
        assert extract_name_from_title(
            "Citizen Ali Ahmadi killed by direct gunfire"
        ) == "Ali Ahmadi"

    def test_execution_of(self):
        assert extract_name_from_title("Execution of Reza Hosseini") == "Reza Hosseini"

    def test_political_prisoner(self):
        assert extract_name_from_title(
            "Political Prisoner Mohammad Saedi hanged in Evin Prison"
        ) == "Mohammad Saedi"

    def test_no_name(self):
        # Generic articles without specific names → None
        assert extract_name_from_title("Three prisoners executed in Karaj") is None

    def test_empty(self):
        assert extract_name_from_title("") is None


class TestTargetTitle:
    def test_executed_yes(self):
        assert is_target_title("Prisoner X executed at Y")

    def test_killed_yes(self):
        assert is_target_title("Citizen X killed by gunfire")

    def test_arrested_no(self):
        assert is_target_title("Activist X arrested in Tehran") is False

    def test_trial_no(self):
        assert is_target_title("Trial of X begins in Branch 15") is False

    def test_hunger_strike_no(self):
        assert is_target_title("Prisoner X on hunger strike") is False


class TestParseBody:
    def test_extracts_age_and_prison(self):
        html = "<p>Hengaw – Monday, April 27, 2026. Jafar Fakhrabadi, a 52-year-old resident of Yazd, was executed at Yazd Central Prison.</p>"
        parsed = parse_article_body(html)
        assert parsed["age"] == 52
        assert parsed["prison"] == "Yazd Central Prison"
        assert parsed.get("year") == 2026

    def test_iso_date(self):
        html = "<p>On 2026-04-27 the execution took place.</p>"
        parsed = parse_article_body(html)
        assert parsed["date"] == date(2026, 4, 27)

    def test_no_data(self):
        parsed = parse_article_body("<p>Nothing useful here.</p>")
        assert "age" not in parsed
        assert "prison" not in parsed


class TestPlugin:
    def test_metadata(self):
        p = HengawPlugin()
        assert p.name == "hengaw"
        assert "Hengaw" in p.full_name
        assert p.base_url == "https://hengaw.net"
