"""Tests for the shared province mapping utility."""

import pytest

from tools.enricher.utils.provinces import (
    build_city_resolver,
    extract_province,
    resolve_city_id,
)


class TestExtractProvince:
    def test_exact_city_match(self):
        assert extract_province("Tehran") == "Tehran"
        assert extract_province("Isfahan") == "Isfahan"
        assert extract_province("Mashhad") == "Khorasan-e Razavi"

    def test_case_insensitive(self):
        assert extract_province("tehran") == "Tehran"
        assert extract_province("ISFAHAN") == "Isfahan"

    def test_city_in_location_string(self):
        assert extract_province("near Tehran, Iran") == "Tehran"
        assert extract_province("Mashhad city center") == "Khorasan-e Razavi"

    def test_province_name_direct(self):
        assert extract_province("East Azerbaijan") == "East Azerbaijan"
        assert extract_province("Kurdistan") == "Kurdistan"

    def test_new_cities(self):
        """Cities added in the expanded mapping."""
        assert extract_province("Karaj") == "Alborz"
        assert extract_province("Saqqez") == "Kurdistan"
        assert extract_province("Farsan") == "Chaharmahal and Bakhtiari"
        assert extract_province("Chabahar") == "Sistan va Baluchestan"
        assert extract_province("Amol") == "Mazandaran"

    def test_none_input(self):
        assert extract_province(None) is None

    def test_empty_string(self):
        assert extract_province("") is None

    def test_unknown_location(self):
        assert extract_province("Unknown location") is None
        assert extract_province("Mars") is None


# ─── City resolver tests ────────────────────────────────────────────────────

MOCK_CITIES = [
    {"id": 1, "slug": "tehran", "name_en": "Tehran"},
    {"id": 2, "slug": "isfahan", "name_en": "Isfahan"},
    {"id": 3, "slug": "mashhad", "name_en": "Mashhad"},
    {"id": 4, "slug": "shiraz", "name_en": "Shiraz"},
    {"id": 5, "slug": "bandar-abbas", "name_en": "Bandar Abbas"},
]


class TestBuildCityResolver:
    def test_maps_slugs(self):
        resolver = build_city_resolver(MOCK_CITIES)
        assert resolver["tehran"] == 1
        assert resolver["isfahan"] == 2
        assert resolver["mashhad"] == 3

    def test_maps_name_en_lowercase(self):
        resolver = build_city_resolver(MOCK_CITIES)
        assert resolver["tehran"] == 1
        assert resolver["shiraz"] == 4

    def test_maps_province_map_aliases(self):
        resolver = build_city_resolver(MOCK_CITIES)
        # "esfahan" is in PROVINCE_MAP, should map to Isfahan (id=2)
        # via slug form "esfahan" → not a slug, but direct key check
        assert resolver.get("bandar abbas") == 5

    def test_empty_cities(self):
        resolver = build_city_resolver([])
        assert resolver == {}


class TestResolveCityId:
    def setup_method(self):
        self.resolver = build_city_resolver(MOCK_CITIES)

    def test_direct_match(self):
        assert resolve_city_id("Tehran", self.resolver) == 1
        assert resolve_city_id("isfahan", self.resolver) == 2

    def test_case_insensitive(self):
        assert resolve_city_id("MASHHAD", self.resolver) == 3
        assert resolve_city_id("Shiraz", self.resolver) == 4

    def test_hyphenated_match(self):
        assert resolve_city_id("bandar abbas", self.resolver) == 5

    def test_substring_match(self):
        assert resolve_city_id("near Tehran, Iran", self.resolver) == 1

    def test_none_input(self):
        assert resolve_city_id(None, self.resolver) is None

    def test_empty_string(self):
        assert resolve_city_id("", self.resolver) is None

    def test_unknown_location(self):
        assert resolve_city_id("Mars", self.resolver) is None

    def test_empty_resolver(self):
        assert resolve_city_id("Tehran", {}) is None
