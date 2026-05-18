"""Tests for the CPJ (Committee to Protect Journalists) plugin."""

from datetime import date

from tools.enricher.sources.cpj import (
    CpjPlugin,
    build_circumstances,
    build_occupation,
    is_target,
    parse_start_display,
    record_to_external_victim,
    slug_from_mtpage,
)


SAMPLE_IRAN_KILLED = {
    "fullName": "Javad Heydari",
    "organizations": "Freelance,Independent",
    "location": "Iran",
    "status": "Killed",
    "typeOfDeath": "Murder",
    "startDisplay": "November 16, 2019",
    "mtpage": "https://cpj.org/data/people/javad-heydari/",
    "type": "Journalist",
    "motiveConfirmed": "Confirmed",
    "charges": None,
}


SAMPLE_IRAN_IMPRISONED = {
    "fullName": "Narges Mohammadi",
    "organizations": "Freelance",
    "location": "Iran",
    "status": "Imprisoned",
    "typeOfDeath": "",
    "startDisplay": "November 16, 2021",
    "mtpage": "https://cpj.org/data/people/narges-mohammadi/",
    "type": "Journalist",
    "motiveConfirmed": "",
    "charges": "Anti-state",
}


SAMPLE_SYRIA_KILLED = {
    "fullName": "Some Journalist",
    "organizations": "Al-Watan",
    "location": "Syria",
    "status": "Killed",
    "typeOfDeath": "Crossfire",
    "startDisplay": "2015",
    "mtpage": "https://cpj.org/data/people/some-journalist/",
    "type": "Journalist",
    "motiveConfirmed": "Unconfirmed",
    "charges": None,
}


class TestParseStartDisplay:
    def test_full_date(self):
        assert parse_start_display("November 16, 2019") == date(2019, 11, 16)

    def test_month_year(self):
        assert parse_start_display("December 2020") == date(2020, 12, 1)

    def test_year_only(self):
        assert parse_start_display("2015") == date(2015, 1, 1)

    def test_empty(self):
        assert parse_start_display("") is None

    def test_none(self):
        assert parse_start_display(None) is None

    def test_malformed(self):
        assert parse_start_display("sometime in 2020") is None


class TestSlugFromMtpage:
    def test_trailing_slash(self):
        assert slug_from_mtpage("https://cpj.org/data/people/javad-heydari/") == "javad-heydari"

    def test_no_trailing_slash(self):
        assert slug_from_mtpage("https://cpj.org/data/people/javad-heydari") == "javad-heydari"

    def test_none(self):
        assert slug_from_mtpage(None) is None

    def test_empty(self):
        assert slug_from_mtpage("") is None


class TestIsTarget:
    def test_iran_killed(self):
        assert is_target(SAMPLE_IRAN_KILLED) is True

    def test_iran_imprisoned_skipped(self):
        assert is_target(SAMPLE_IRAN_IMPRISONED) is False

    def test_syria_killed_skipped(self):
        assert is_target(SAMPLE_SYRIA_KILLED) is False

    def test_empty_record(self):
        assert is_target({}) is False


class TestBuildOccupation:
    def test_type_and_orgs(self):
        assert build_occupation(SAMPLE_IRAN_KILLED) == "Journalist — Freelance,Independent"

    def test_type_only(self):
        assert build_occupation({"type": "Journalist", "organizations": ""}) == "Journalist"

    def test_orgs_only(self):
        assert build_occupation({"type": "", "organizations": "BBC"}) == "BBC"

    def test_empty(self):
        assert build_occupation({}) is None


class TestBuildCircumstances:
    def test_full(self):
        result = build_circumstances(SAMPLE_IRAN_KILLED)
        assert "Type of death: Murder" in result
        assert "Motive: Confirmed" in result
        assert "Charges" not in result  # charges is None

    def test_with_charges(self):
        record = {**SAMPLE_IRAN_KILLED, "charges": "Anti-state"}
        result = build_circumstances(record)
        assert "Charges: Anti-state" in result

    def test_empty(self):
        assert build_circumstances({}) is None

    def test_only_type(self):
        assert build_circumstances({"typeOfDeath": "Murder"}) == "Type of death: Murder"


class TestRecordToExternalVictim:
    def test_iran_killed_maps(self):
        v = record_to_external_victim(SAMPLE_IRAN_KILLED)
        assert v is not None
        assert v.source_id == "cpj_javad-heydari"
        assert v.source_name == "Committee to Protect Journalists"
        assert v.source_url == "https://cpj.org/data/people/javad-heydari/"
        assert v.source_type == "human_rights_org"
        assert v.name_latin == "Javad Heydari"
        assert v.occupation == "Journalist — Freelance,Independent"
        assert v.date_of_death == date(2019, 11, 16)
        assert v.cause_of_death == "Murder"
        assert "Type of death: Murder" in v.circumstances_en

    def test_missing_name_returns_none(self):
        record = {**SAMPLE_IRAN_KILLED, "fullName": ""}
        assert record_to_external_victim(record) is None

    def test_missing_mtpage_returns_none(self):
        record = {**SAMPLE_IRAN_KILLED, "mtpage": None}
        assert record_to_external_victim(record) is None

    def test_no_typeofdeath_has_none_cause(self):
        record = {**SAMPLE_IRAN_KILLED, "typeOfDeath": ""}
        v = record_to_external_victim(record)
        assert v.cause_of_death is None


class TestPluginMetadata:
    def test_metadata(self):
        plugin = CpjPlugin()
        assert plugin.name == "cpj"
        assert "Committee to Protect Journalists" in plugin.full_name
        assert plugin.base_url == "https://cpj.org"
