"""Tests for the enricher pipeline — especially circumstances_fa support."""

from tools.enricher.db.models import ExternalVictim
from tools.enricher.pipeline.enricher import compute_enrichment, count_new_fields


def make_victim(**overrides):
    """Create a minimal DB victim dict."""
    base = {
        "id": "test-uuid",
        "slug": "test",
        "name_latin": "Test Person",
        "name_farsi": None,
        "date_of_birth": None,
        "place_of_birth": None,
        "gender": None,
        "religion": None,
        "photo_url": None,
        "occupation_en": None,
        "education": None,
        "age_at_death": None,
        "place_of_death": None,
        "province": None,
        "cause_of_death": None,
        "circumstances_en": None,
        "circumstances_fa": None,
        "event_context": None,
        "responsible_forces": None,
    }
    base.update(overrides)
    return base


def make_ext(**overrides):
    """Create a minimal ExternalVictim."""
    base = {
        "source_id": "test_1",
        "source_name": "test",
        "source_url": "https://test.com",
        "source_type": "test",
    }
    base.update(overrides)
    return ExternalVictim(**base)


class TestComputeEnrichment:
    def test_fills_circumstances_fa(self):
        victim = make_victim()
        ext = make_ext(circumstances_fa="شرح فارسی")
        result = compute_enrichment(victim, ext)
        assert result is not None
        # tuple: id(0), name_farsi(1), ..., circumstances_en(13), circumstances_fa(14), ...
        assert result[14] == "شرح فارسی"

    def test_no_overwrite_circumstances_fa(self):
        victim = make_victim(circumstances_fa="existing farsi text")
        ext = make_ext(circumstances_fa="short")
        result = compute_enrichment(victim, ext)
        # No new data to contribute since existing is not NULL
        assert result is None

    def test_replaces_longer_circumstances_fa(self):
        victim = make_victim(circumstances_fa="short")
        ext = make_ext(circumstances_fa="a" * 100)  # >1.5x longer
        result = compute_enrichment(victim, ext)
        # The replacement check is in SQL, but compute_enrichment should detect new_data=False
        # because db_val is not None. Only NULL triggers new_data.
        assert result is None

    def test_fills_both_circumstances(self):
        victim = make_victim()
        ext = make_ext(
            circumstances_en="English description",
            circumstances_fa="توضیح فارسی",
        )
        result = compute_enrichment(victim, ext)
        assert result is not None
        assert result[13] == "English description"
        assert result[14] == "توضیح فارسی"

    def test_tuple_length_with_all_fields(self):
        victim = make_victim()
        ext = make_ext(name_farsi="تست")
        result = compute_enrichment(victim, ext)
        assert result is not None
        # id + 16 fields = 17 elements total ($1...$17)
        assert len(result) == 17

    def test_no_new_data_returns_none(self):
        victim = make_victim(
            name_farsi="existing",
            gender="male",
            circumstances_fa="existing",
        )
        ext = make_ext()  # all None
        result = compute_enrichment(victim, ext)
        assert result is None


class TestCountNewFields:
    def test_counts_circumstances_fa(self):
        victim = make_victim()
        ext = make_ext(circumstances_fa="some text")
        count = count_new_fields(victim, ext)
        assert count >= 1

    def test_counts_all_null_fields(self):
        victim = make_victim()
        ext = make_ext(
            name_farsi="تست",
            circumstances_en="en",
            circumstances_fa="fa",
            province="Tehran",
        )
        count = count_new_fields(victim, ext)
        assert count == 4

    def test_doesnt_count_existing_fields(self):
        victim = make_victim(province="Tehran", circumstances_fa="existing")
        ext = make_ext(province="Tehran", circumstances_fa="new")
        count = count_new_fields(victim, ext)
        assert count == 0
