"""Tests for the HRANA headline-parser + plugin scaffolding."""

from datetime import date

from tools.enricher.sources.hrana import (
    HranaPlugin,
    extract_name_candidates,
    is_execution_article,
    parse_article_body,
    slug_from_url,
)


SASAN_HTML = '''
<html><head>
<meta property="og:title" content="January Protests: 21-Year-Old Sasan Azadvar Junaqani Executed - Hrana"/>
<meta property="og:description" content="HRANA - At dawn today, Thursday, April 30, 2026..."/>
<meta property="article:published_time" content="2026-04-30T18:30:44+00:00"/>
<meta property="og:image" content="https://www.en-hrana.org/wp-content/uploads/2026/04/Janaqani_executed.jpg"/>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"Article","datePublished":"2026-04-30T18:30:44+00:00","headline":"January Protests: 21-Year-Old Sasan Azadvar Junaqani Executed","keywords":["Dastgerd Prison","HRANA","Isfahan","Sasan Azadvar Junaqani"],"thumbnailUrl":"https://www.en-hrana.org/wp-content/uploads/2026/04/Janaqani_executed.jpg","articleSection":["Executions","News"]}]}
</script>
</head><body>
<article>
<div class="entry-content">
<p>HRANA - At dawn today, Sasan Azadvar Junaqani, a 21-year-old athlete from Isfahan, was executed in Dastgerd Prison.</p>
</div>
</article>
</body></html>
'''

PRISONER_HTML = '''
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"Article","datePublished":"2026-03-15T08:00:00+00:00","keywords":["Evin Prison","Tehran","Foo Bar"],"articleSection":["Prisoners","News"]}]}
</script>
</head><body>
<article>
<div class="entry-content">
<p>Foo Bar, a 30-year-old activist, has been imprisoned in Evin since March 2026.</p>
</div>
</article>
</body></html>
'''


class TestExtractNameCandidates:
    def test_january_protests_pattern(self):
        title = "January Protests: 21-Year-Old Sasan Azadvar Junaqani Executed"
        names = extract_name_candidates(title)
        assert any("Sasan Azadvar" in n for n in names)

    def test_iran_executes_pattern(self):
        title = "Iran Executes Amer Ramesh on Security Charges"
        names = extract_name_candidates(title)
        assert "Amer Ramesh" in names

    def test_death_sentence_upheld(self):
        title = "Death Sentence of Naser Bakrzadeh Upheld by the Supreme Court"
        names = extract_name_candidates(title)
        assert "Naser Bakrzadeh" in names

    def test_january_protests_kiani(self):
        title = "January Protests: Erfan Kiani Executed"
        names = extract_name_candidates(title)
        assert "Erfan Kiani" in names

    def test_multi_name_title_only_first(self):
        # "Mohammad Abbasi" is a real person; "Daughter" should be filtered
        title = "Death Sentence of Mohammad Abbasi, 25-Year Term for Daughter Upheld by Supreme Court"
        names = extract_name_candidates(title)
        assert "Mohammad Abbasi" in names
        assert "Daughter" not in names
        assert "Year Term" not in names

    def test_empty_title(self):
        assert extract_name_candidates("") == []

    def test_generic_no_name(self):
        title = "Three Prisoners Executed in Tabriz Prison"
        # No specific names — parser should yield empty (these are placeholders)
        names = extract_name_candidates(title)
        for n in names:
            assert n != "Three Prisoners"
            assert n != "Tabriz Prison"

    def test_blacklist_filters_places(self):
        title = "Iran Hangs Mohammadamin Biglari and Shahin Vahedparast in Karaj"
        names = extract_name_candidates(title)
        # Names should be present, places filtered
        assert "Karaj" not in names

    def test_no_single_word(self):
        title = "January Protests: Mohammad Executed"
        names = extract_name_candidates(title)
        # "Mohammad" alone is too generic — must have ≥ 2 words
        for n in names:
            assert " " in n


class TestSlugFromUrl:
    def test_trailing_slash(self):
        assert slug_from_url("https://www.en-hrana.org/january-protests-erfan-kiani-executed/") == "january-protests-erfan-kiani-executed"

    def test_no_trailing_slash(self):
        assert slug_from_url("https://www.en-hrana.org/iran-executes-amer-ramesh-on-security-charges") == "iran-executes-amer-ramesh-on-security-charges"


class TestHranaPlugin:
    def test_plugin_metadata(self):
        p = HranaPlugin()
        assert p.name == "hrana"
        assert "HRANA" in p.full_name
        assert p.base_url == "https://www.en-hrana.org"


class TestParseArticleBody:
    def test_extracts_jsonld_fields(self):
        parsed = parse_article_body(SASAN_HTML)
        assert parsed["published_date"] == date(2026, 4, 30)
        assert "Sasan Azadvar Junaqani" in parsed["keywords"]
        assert parsed["main_subject"] == "Sasan Azadvar Junaqani"
        # Isfahan in source is normalized to Esfahan to match DB convention
        assert parsed["province"] == "Esfahan"
        assert parsed["prison"] == "Dastgerd Prison"
        assert parsed["age"] == 21
        assert parsed["photo_url"] == "https://www.en-hrana.org/wp-content/uploads/2026/04/Janaqani_executed.jpg"
        assert "executions" in parsed["article_section"]

    def test_prisoner_article_not_marked_execution(self):
        parsed = parse_article_body(PRISONER_HTML)
        assert is_execution_article(parsed) is False
        assert parsed["main_subject"] == "Foo Bar"
        assert parsed["province"] == "Tehran"
        assert parsed["prison"] == "Evin Prison"
        assert parsed["age"] == 30

    def test_execution_article_flag(self):
        parsed = parse_article_body(SASAN_HTML)
        assert is_execution_article(parsed) is True

    def test_empty_html(self):
        parsed = parse_article_body("<html></html>")
        assert parsed.get("main_subject") is None
        assert parsed.get("published_date") is None
        assert is_execution_article(parsed) is False

    def test_meta_fallback(self):
        # No JSON-LD, only meta tags
        html = '<meta property="article:published_time" content="2026-01-15T10:00:00Z"/><meta property="og:image" content="https://example.com/foo.jpg"/>'
        parsed = parse_article_body(html)
        assert parsed["published_date"] == date(2026, 1, 15)
        assert parsed["photo_url"] == "https://example.com/foo.jpg"
