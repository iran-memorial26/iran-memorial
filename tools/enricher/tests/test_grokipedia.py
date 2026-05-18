"""Tests for the Grokipedia enrichment pipeline (pure functions only).

DB-level behaviour (_persist, _fetch_targets, run_grokipedia) is exercised
end-to-end via the operator-run dry-run against the local DB; here we
unit-test the validation + extraction logic that decides whether a fetched
article actually belongs to the victim we asked about.
"""

from tools.enricher.pipeline.grokipedia import (
    _extract_og,
    _name_similarity,
    _slugify_name,
    _strip_tags,
    _validate_match,
)


# ---------------------------------------------------------------------------
# _slugify_name
# ---------------------------------------------------------------------------

class TestSlugifyName:
    def test_two_words(self):
        assert _slugify_name("Jamshid Sharmahd") == "Jamshid_Sharmahd"

    def test_three_words(self):
        assert _slugify_name("Mahsa Jina Amini") == "Mahsa_Jina_Amini"

    def test_lowercase_input_capitalizes(self):
        assert _slugify_name("zahra kazemi") == "Zahra_Kazemi"

    def test_strips_parenthetical_alias(self):
        assert _slugify_name("Mahsa (Jina) Amini") == "Mahsa_Amini"

    def test_collapses_extra_whitespace(self):
        assert _slugify_name("Jamshid   Sharmahd  ") == "Jamshid_Sharmahd"

    def test_empty_input(self):
        assert _slugify_name("") == ""

    def test_none_safe(self):
        # Caller is supposed to guard, but the function shouldn't crash on None
        assert _slugify_name(None) == ""  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# _extract_og
# ---------------------------------------------------------------------------

class TestExtractOg:
    def test_pulls_description(self):
        html = (
            '<meta property="og:title" content="Foo">'
            '<meta property="og:description" content="A short biography of X">'
        )
        assert _extract_og(html, "description") == "A short biography of X"

    def test_unescapes_html_entities(self):
        html = '<meta property="og:description" content="A &amp; B">'
        assert _extract_og(html, "description") == "A & B"

    def test_missing_returns_none(self):
        assert _extract_og("<html></html>", "description") is None


# ---------------------------------------------------------------------------
# _strip_tags
# ---------------------------------------------------------------------------

class TestStripTags:
    def test_drops_script_and_style(self):
        html = (
            "<html><script>evil()</script><style>x{}</style>"
            "<p>Real text</p></html>"
        )
        assert _strip_tags(html) == "Real text"

    def test_collapses_whitespace(self):
        assert _strip_tags("<p>a\n\n\n  b\t c</p>") == "a b c"


# ---------------------------------------------------------------------------
# _name_similarity
# ---------------------------------------------------------------------------

class TestNameSimilarity:
    def test_identical(self):
        assert _name_similarity("Foo Bar", "Foo Bar") == 1.0

    def test_case_insensitive(self):
        assert _name_similarity("FOO BAR", "foo bar") == 1.0

    def test_unrelated_low(self):
        assert _name_similarity("Foo Bar", "Zebra Cake") < 0.4


# ---------------------------------------------------------------------------
# _validate_match — the core safety net against false positives
# ---------------------------------------------------------------------------

class TestValidateMatch:
    SHARMAHD_BODY = (
        "Jamshid Sharmahd was a German-Iranian dual national kidnapped from "
        "Dubai by agents of the Islamic Republic of Iran in 2020 and "
        "executed in October 2024."
    )

    def test_accepts_clear_match(self):
        ok, reason = _validate_match(
            name_latin="Jamshid Sharmahd",
            name_farsi="جمشید شارمهد",
            year_of_death=2024,
            body_text=self.SHARMAHD_BODY,
            description="Profile of Jamshid Sharmahd",
        )
        assert ok, f"reason={reason}"

    def test_rejects_unrelated_article(self):
        ok, reason = _validate_match(
            name_latin="Jamshid Sharmahd",
            name_farsi=None,
            year_of_death=2024,
            body_text="The 2024 Olympic Games were held in Paris, France.",
            description="Olympic article",
        )
        assert not ok
        assert reason == "name-not-found"

    def test_rejects_when_iran_signal_missing(self):
        # Page mentions the name but nothing else tying them to Iran.
        ok, reason = _validate_match(
            name_latin="Jamshid Sharmahd",
            name_farsi=None,
            year_of_death=1955,
            body_text="Jamshid Sharmahd is a fictional character in a novel.",
            description=None,
        )
        assert not ok
        assert reason == "no-iran-signal"

    def test_year_of_death_satisfies_iran_signal(self):
        # No "Iran" keyword but the death year is present in the body.
        ok, _ = _validate_match(
            name_latin="Jamshid Sharmahd",
            name_farsi=None,
            year_of_death=2024,
            body_text="Jamshid Sharmahd died in 2024 after a long detention.",
            description=None,
        )
        assert ok

    def test_farsi_name_satisfies_iran_signal(self):
        # Name + Farsi alias present, no English Iran mention.
        ok, _ = _validate_match(
            name_latin="Jamshid Sharmahd",
            name_farsi="جمشید شارمهد",
            year_of_death=None,
            body_text="Jamshid Sharmahd was also known as جمشید شارمهد",
            description=None,
        )
        assert ok

    def test_fuzzy_token_match_for_partial_names(self):
        # "Mahsa (Jina) Amini" in DB vs page about "Mahsa Amini" alone.
        ok, _ = _validate_match(
            name_latin="Mahsa Jina Amini",
            name_farsi=None,
            year_of_death=2022,
            body_text="Mahsa Amini died in police custody in Iran in 2022.",
            description=None,
        )
        assert ok

    def test_single_token_match_not_enough(self):
        # Just "Mahsa" alone (one token) shouldn't validate against a
        # different "Mahsa Foo" page.
        ok, reason = _validate_match(
            name_latin="Mahsa Karimi",
            name_farsi=None,
            year_of_death=2022,
            body_text="Mahsa Foo is a chef in Iran. Published 2022.",
            description=None,
        )
        assert not ok
        assert reason == "name-not-found"

    def test_scattered_token_false_positive_rejected(self):
        # The Mojtaba-Mousavi vs Mojtaba-Khamenei case that motivated the
        # proximity check. Body mentions "Mojtaba Khamenei" in one section
        # and "Hossein Mousavi" in another, several paragraphs apart. The
        # old token-density rule wrongly accepted this. The new proximity
        # rule must reject.
        body = (
            "Mojtaba Khamenei is the second son of Iran's Supreme Leader "
            "Ali Khamenei. " + ("Lorem ipsum dolor sit amet " * 40) +
            "Earlier, Mir Hossein Mousavi led the 2009 Green Movement in Iran."
        )
        ok, reason = _validate_match(
            name_latin="Mojtaba Mousavi",
            name_farsi=None,
            year_of_death=None,
            body_text=body,
            description="Profile of Mojtaba Khamenei in Iran",
        )
        assert not ok, "scattered first-name + last-name in unrelated contexts must reject"
        assert reason == "name-not-found"

    def test_proximity_accepts_close_tokens(self):
        # First/last within ~30 chars of each other — same person reference.
        ok, _ = _validate_match(
            name_latin="Mahsa Jina Amini",  # DB has middle name
            name_farsi=None,
            year_of_death=2022,
            body_text="The death of Mahsa Amini in 2022 sparked protests in Iran.",
            description=None,
        )
        assert ok

    def test_parenthetical_alias_stripped_for_phrase_match(self):
        # DB stores "Mahsa (Jina) Amini" with parens; Grokipedia article
        # uses plain "Mahsa Amini". The phrase-match path needs to see them
        # as equal after stripping the alias.
        ok, _ = _validate_match(
            name_latin="Mahsa (Jina) Amini",
            name_farsi=None,
            year_of_death=2022,
            body_text="Mahsa Amini was a 22-year-old Kurdish-Iranian woman.",
            description=None,
        )
        assert ok
