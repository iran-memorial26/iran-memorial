"""Tests for the iranrevolution.online Supabase plugin."""

import pytest
from datetime import date

from tools.enricher.sources.iranrevolution import IranrevolutionPlugin


class TestParseRecord:
    def setup_method(self):
        self.plugin = IranrevolutionPlugin()

    def test_basic_record(self):
        record = {
            "id": "ali-heydari",
            "name": "Ali Heydari",
            "name_fa": "علی حیدری",
            "city": "Mashhad",
            "date": "2026-02-09",
            "bio": "Shot during protests.",
            "bio_fa": "در اعتراضات کشته شد.",
            "media": {"photo": "https://example.com/photo.jpg"},
            "source_links": [{"url": "https://x.com/post1"}],
        }
        victim = self.plugin._parse_record(record)

        assert victim is not None
        assert victim.source_id == "iranrevolution_ali-heydari"
        assert victim.name_latin == "Ali Heydari"
        assert victim.name_farsi == "علی حیدری"
        assert victim.date_of_death == date(2026, 2, 9)
        assert victim.place_of_death == "Mashhad"
        assert victim.province == "Khorasan-e Razavi"
        assert victim.circumstances_en == "Shot during protests."
        assert victim.circumstances_fa == "در اعتراضات کشته شد."
        assert victim.photo_url == "https://example.com/photo.jpg"

    def test_missing_name_returns_none(self):
        record = {"id": "test", "name": "", "name_fa": ""}
        assert self.plugin._parse_record(record) is None

    def test_missing_id_returns_none(self):
        record = {"name": "Test"}
        assert self.plugin._parse_record(record) is None

    def test_farsi_only_name(self):
        record = {
            "id": "test-farsi",
            "name": "",
            "name_fa": "علی",
            "city": "",
            "date": "",
            "bio": "",
            "media": {},
            "source_links": [],
        }
        victim = self.plugin._parse_record(record)
        assert victim is not None
        assert victim.name_latin is None
        assert victim.name_farsi == "علی"

    def test_no_media_photo(self):
        record = {
            "id": "no-photo",
            "name": "Test Person",
            "city": "",
            "date": "",
            "bio": "",
            "media": {},
            "source_links": [],
        }
        victim = self.plugin._parse_record(record)
        assert victim is not None
        assert victim.photo_url is None

    def test_none_media(self):
        record = {
            "id": "null-media",
            "name": "Test Person",
            "city": "",
            "date": "",
            "bio": "",
            "media": None,
            "source_links": [],
        }
        victim = self.plugin._parse_record(record)
        assert victim is not None
        assert victim.photo_url is None

    def test_invalid_date(self):
        record = {
            "id": "bad-date",
            "name": "Test",
            "city": "",
            "date": "not-a-date",
            "bio": "",
            "media": {},
            "source_links": [],
        }
        victim = self.plugin._parse_record(record)
        assert victim is not None
        assert victim.date_of_death is None

    def test_empty_bio_becomes_none(self):
        record = {
            "id": "empty-bio",
            "name": "Test",
            "city": "",
            "date": "",
            "bio": "   ",
            "bio_fa": "",
            "media": {},
            "source_links": [],
        }
        victim = self.plugin._parse_record(record)
        assert victim.circumstances_en is None
        assert victim.circumstances_fa is None

    def test_province_extraction(self):
        record = {
            "id": "tehran-victim",
            "name": "Test",
            "city": "Tehran",
            "date": "",
            "bio": "",
            "media": {},
            "source_links": [],
        }
        victim = self.plugin._parse_record(record)
        assert victim.province == "Tehran"

    def test_source_type(self):
        record = {
            "id": "type-test",
            "name": "Test",
            "city": "",
            "date": "",
            "bio": "",
            "media": {},
            "source_links": [],
        }
        victim = self.plugin._parse_record(record)
        assert victim.source_type == "community_database"
        assert victim.source_name == "iranrevolution.online Memorial"
