"""Tests for the witness.report plugin."""

from datetime import date

from tools.enricher.sources.witness_report import (
    extract_health_date,
    extract_uuid_and_slug,
    is_iranian,
    parse_age_field,
    parse_country_field,
    parse_iso_date,
    record_to_external_victim,
    split_full_name,
)


SAMPLE_EXECUTED = {
    "photo": '<a href="/people/5fd353d8-40df-11f1-b57a-560003f1f421/amer-ramesh" title="More info"><img src="https://witness.report/images/5fd353d8-40df-11f1-b57a-560003f1f421.jpg"/></a>',
    "fullNameEn": 'Amer Ramesh<br>عامر رامش<br><small><a href="/people/5fd353d8-40df-11f1-b57a-560003f1f421/amer-ramesh">More Info</a></small>',
    "fullName": "",
    "nationality": "Iranian",
    "country": "Iran<br>Sistan va Baluchestan<br>Chabahar",
    "updateTime": "2026-04-26",
    "detentionStatus": "Executed",
    "healthStatus": '<span class="badge bg-dark">Deceased</span><br>2026-04-26',
    "age": "<br>19<br>2007<br>",
}

SAMPLE_IMPRISONED = {
    "photo": '<a href="/people/aaddd431-4077-11f1-b57a-560003f1f421/foo-bar"><img/></a>',
    "fullNameEn": 'Foo Bar<br>فو بار',
    "nationality": "Iranian",
    "country": "Iran<br>Tehran<br>Tehran",
    "updateTime": "2026-04-25",
    "detentionStatus": "Imprisoned",
    "healthStatus": '<span class="badge bg-success">Alive</span>',
    "age": "<br>35<br>1991<br>",
}

SAMPLE_NON_IRANIAN = {
    "photo": '<a href="/people/12345678-1234-1234-1234-123456789012/some-name"><img/></a>',
    "fullNameEn": "Some Name",
    "nationality": "Afghan",
    "country": "Afghanistan",
    "detentionStatus": "Murdered",
    "healthStatus": "Deceased<br>2024-01-01",
    "age": "<br>30<br>1994<br>",
    "updateTime": "2024-01-01",
}

SAMPLE_OUT_OF_SCOPE_STATUS = {
    "photo": '<a href="/people/22222222-2222-2222-2222-222222222222/x"><img/></a>',
    "fullNameEn": "X Y",
    "nationality": "Iranian",
    "country": "Iran",
    "detentionStatus": "Released on bail",
    "healthStatus": "Alive",
    "age": "<br><br><br>",
    "updateTime": "2026-01-01",
}


class TestParseIsoDate:
    def test_valid(self):
        assert parse_iso_date("2026-04-26") == date(2026, 4, 26)

    def test_empty(self):
        assert parse_iso_date("") is None

    def test_none(self):
        assert parse_iso_date(None) is None

    def test_invalid(self):
        assert parse_iso_date("April 26, 2026") is None


class TestExtractUuidAndSlug:
    def test_from_anchor(self):
        uuid, slug = extract_uuid_and_slug(
            '<a href="/people/5fd353d8-40df-11f1-b57a-560003f1f421/amer-ramesh">x</a>'
        )
        assert uuid == "5fd353d8-40df-11f1-b57a-560003f1f421"
        assert slug == "amer-ramesh"

    def test_no_match(self):
        assert extract_uuid_and_slug("<div>no link</div>") == (None, None)

    def test_empty(self):
        assert extract_uuid_and_slug("") == (None, None)


class TestSplitFullName:
    def test_latin_and_farsi(self):
        assert split_full_name("Amer Ramesh<br>عامر رامش") == ("Amer Ramesh", "عامر رامش")

    def test_strips_trailing_html(self):
        latin, farsi = split_full_name(
            'Amer Ramesh<br>عامر رامش<br><small><a>More Info</a></small>'
        )
        assert latin == "Amer Ramesh"
        assert farsi == "عامر رامش"

    def test_only_latin(self):
        assert split_full_name("John Doe") == ("John Doe", None)

    def test_empty(self):
        assert split_full_name("") == (None, None)


class TestParseCountryField:
    def test_full(self):
        assert parse_country_field("Iran<br>Tehran<br>Tehran") == ("Iran", "Tehran", "Tehran")

    def test_country_only(self):
        assert parse_country_field("Iran") == ("Iran", None, None)

    def test_empty(self):
        assert parse_country_field("") == (None, None, None)


class TestParseAgeField:
    def test_age_and_yob(self):
        assert parse_age_field("<br>19<br>2007<br>") == (19, 2007)

    def test_age_only(self):
        assert parse_age_field("<br>35<br><br>") == (35, None)

    def test_empty(self):
        assert parse_age_field("<br><br><br>") == (None, None)


class TestExtractHealthDate:
    def test_deceased_with_date(self):
        assert extract_health_date(
            '<span class="badge bg-dark">Deceased</span><br>2026-04-26'
        ) == date(2026, 4, 26)

    def test_no_date(self):
        assert extract_health_date('<span>Alive</span>') is None

    def test_empty(self):
        assert extract_health_date("") is None


class TestIsIranian:
    def test_iranian_nationality(self):
        assert is_iranian(SAMPLE_EXECUTED) is True

    def test_country_starts_with_iran(self):
        assert is_iranian({"nationality": "", "country": "Iran<br>Tehran"}) is True

    def test_afghan(self):
        assert is_iranian(SAMPLE_NON_IRANIAN) is False


class TestRecordToExternalVictim:
    def test_executed(self):
        v = record_to_external_victim(SAMPLE_EXECUTED)
        assert v is not None
        assert v.source_id == "witness_5fd353d8-40df-11f1-b57a-560003f1f421"
        assert v.source_name == "witness.report"
        assert v.source_url == "https://witness.report/people/5fd353d8-40df-11f1-b57a-560003f1f421/amer-ramesh"
        assert v.name_latin == "Amer Ramesh"
        assert v.name_farsi == "عامر رامش"
        assert v.cause_of_death == "Execution"
        assert v.date_of_death == date(2026, 4, 26)
        assert v.age_at_death == 19
        assert v.date_of_birth == date(2007, 1, 1)
        assert v.province == "Sistan va Baluchestan"
        assert v.place_of_death == "Chabahar"
        assert v.photo_url == "https://witness.report/images/5fd353d8-40df-11f1-b57a-560003f1f421.jpg"

    def test_imprisoned_no_death_date(self):
        v = record_to_external_victim(SAMPLE_IMPRISONED)
        assert v is not None
        assert v.cause_of_death == "Imprisoned"
        assert v.date_of_death is None
        assert v.age_at_death is None  # alive — age_at_death not meaningful
        assert v.date_of_birth == date(1991, 1, 1)

    def test_non_iranian_skipped(self):
        assert record_to_external_victim(SAMPLE_NON_IRANIAN) is None

    def test_out_of_scope_status_skipped(self):
        assert record_to_external_victim(SAMPLE_OUT_OF_SCOPE_STATUS) is None

    def test_missing_uuid_skipped(self):
        bad = {**SAMPLE_EXECUTED, "photo": "<img/>", "fullNameEn": "X Y"}
        assert record_to_external_victim(bad) is None

    def test_missing_name_skipped(self):
        bad = {**SAMPLE_EXECUTED, "fullNameEn": "<br><br>"}
        assert record_to_external_victim(bad) is None
