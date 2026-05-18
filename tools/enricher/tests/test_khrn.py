"""Tests for the KHRN (Kurdistan Human Rights Network) plugin."""

from tools.enricher.sources.khrn import (
    KhrnPlugin,
    _extract_field,
    _extract_max_page,
    build_circumstances,
    is_deceased,
    parse_listing_page,
)


SAMPLE_CARD_LIVING = """<div class="news-post-item row db-person-item-list">
    <div class="news-item-thumb col-md-6">
      <a href="https://kurdistanhumanrights.org/en/prisoners-database/abdolaziz-gol-mohammadi" title="Abdolaziz Gol-Mohammadi">
                  <img decoding="async" src="https://kurdistanhumanrights.org/wp-content/uploads/2024/08/ABDOLAZIZ-GOL-MOHAMMADI-1024x532.jpg" alt="Abdolaziz Gol-Mohammadi">
              </a>
    </div>
    <div class="news-item-desc col-md-6">
              <div class="db-person-info-list">
                  <a href="https://kurdistanhumanrights.org/en/prisoners-database/abdolaziz-gol-mohammadi" title="Abdolaziz Gol-Mohammadi">
                      <h2>
                          <span>Abdolaziz Gol-Mohammadi</span>
                      </h2>
                  </a>
                  <div><strong>Born:</strong> Orumiyeh, West Azerbaijan Province<br></div><div><strong>Field of activity:</strong> Political Activist<br></div><div><strong>Charged With:</strong> Acting against national security<br></div><div><strong>Sentence:</strong> 10 years and one day imprisonment<br></div><div><strong>Current Status:</strong> Imprisoned in Orumiyeh Central Prison<br></div>
            </div>
          </div>
  </div>"""


SAMPLE_CARD_EXECUTED = """<div class="news-post-item row db-person-item-list">
    <div class="news-item-thumb col-md-6">
      <a href="https://kurdistanhumanrights.org/en/prisoners-database/fictional-martyr" title="Fictional Martyr">
                  <img decoding="async" src="https://kurdistanhumanrights.org/wp-content/uploads/2025/06/Fictional-Martyr.jpg" alt="Fictional Martyr">
              </a>
    </div>
    <div class="news-item-desc col-md-6">
              <div class="db-person-info-list">
                  <h2><span>Fictional Martyr</span></h2>
                  <div><strong>Born:</strong> Sanandaj, Kurdistan Province<br></div><div><strong>Field of activity:</strong> Civil Rights Activist<br></div><div><strong>Charged With:</strong> Moharebeh<br></div><div><strong>Sentence:</strong> Death<br></div><div><strong>Current Status:</strong> Executed at Rajai Shahr Prison<br></div>
            </div>
          </div>
  </div>"""


SAMPLE_CARD_NO_PHOTO = """<div class="news-post-item row db-person-item-list">
    <div class="news-item-thumb col-md-6">
      <a href="https://kurdistanhumanrights.org/en/prisoners-database/no-photo-guy" title="No Photo Guy">
              </a>
    </div>
    <div class="news-item-desc col-md-6">
              <div class="db-person-info-list">
                  <h2><span>No Photo Guy</span></h2>
                  <div><strong>Current Status:</strong> Released on bail<br></div>
            </div>
          </div>
  </div>"""


SAMPLE_PAGINATION = (
    '<div class="pagination nav-links navigation" data-pagination="true">'
    '<a class="page-numbers current" href="https://kurdistanhumanrights.org/en/hiwa/list-of-political-prisoners" data-page="1">1</a>'
    '<a class="page-numbers" href="https://kurdistanhumanrights.org/en/hiwa/list-of-political-prisoners/page/2" data-page="2">2</a>'
    '<a class="page-numbers" href="https://kurdistanhumanrights.org/en/hiwa/list-of-political-prisoners/page/13" data-page="13">13</a>'
    "</div>"
)


SAMPLE_PAGE = (
    SAMPLE_CARD_LIVING + SAMPLE_CARD_EXECUTED + SAMPLE_CARD_NO_PHOTO + SAMPLE_PAGINATION
)


class TestIsDeceased:
    def test_executed(self):
        assert is_deceased("Executed at Rajai Shahr Prison") is True

    def test_killed(self):
        assert is_deceased("Killed during interrogation") is True

    def test_martyr(self):
        assert is_deceased("Martyr — border shooting") is True

    def test_died(self):
        assert is_deceased("Died in custody") is True

    def test_imprisoned(self):
        assert is_deceased("Imprisoned in Orumiyeh Central Prison") is False

    def test_released(self):
        assert is_deceased("Released on bail") is False

    def test_none(self):
        assert is_deceased(None) is False

    def test_empty(self):
        assert is_deceased("") is False

    def test_case_insensitive(self):
        assert is_deceased("EXECUTED") is True

    def test_no_false_positive_martyrdom_prison(self):
        # "martyr" must not match "Martyrdom" (word-boundary check)
        assert is_deceased("Imprisoned at Martyrdom Prison") is False

    def test_no_false_positive_studied(self):
        # "died" must not substring-match "studied"
        assert is_deceased("Studied law before arrest") is False

    def test_martyred(self):
        assert is_deceased("Martyred at border") is True


class TestExtractField:
    def test_born(self):
        block = "<div><strong>Born:</strong> Orumiyeh, West Azerbaijan Province<br></div>"
        assert (
            _extract_field(block, "Born")
            == "Orumiyeh, West Azerbaijan Province"
        )

    def test_charged_with_multiline(self):
        block = "<div><strong>Charged With:</strong> Acting against national security &#8211; Membership<br></div>"
        assert "national security" in _extract_field(block, "Charged With")

    def test_html_entities_unescaped(self):
        # html.unescape handles all named + numeric entities, not just &#8211; and &amp;
        block = "<div><strong>Born:</strong> O&#8217;Hara &amp; Sons&nbsp;Village<br></div>"
        result = _extract_field(block, "Born")
        assert "\u2019" in result  # right single quote
        assert "&" in result and "amp" not in result
        assert "nbsp" not in result

    def test_missing_returns_none(self):
        assert _extract_field("<div>nothing here</div>", "Born") is None


class TestExtractMaxPage:
    def test_finds_max(self):
        assert _extract_max_page(SAMPLE_PAGINATION) == 13

    def test_no_pagination_returns_1(self):
        assert _extract_max_page("<div>no pages</div>") == 1


class TestParseListingPage:
    def test_extracts_all_cards(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert len(entries) == 3

    def test_extracts_name(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert entries[0]["name"] == "Abdolaziz Gol-Mohammadi"
        assert entries[1]["name"] == "Fictional Martyr"

    def test_extracts_slug(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert entries[0]["slug"] == "abdolaziz-gol-mohammadi"

    def test_extracts_detail_url(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert (
            entries[1]["detail_url"]
            == "https://kurdistanhumanrights.org/en/prisoners-database/fictional-martyr"
        )

    def test_extracts_photo(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert (
            entries[0]["photo_url"]
            == "https://kurdistanhumanrights.org/wp-content/uploads/2024/08/ABDOLAZIZ-GOL-MOHAMMADI-1024x532.jpg"
        )

    def test_handles_missing_photo(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert entries[2]["photo_url"] is None

    def test_no_photo_card_status(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert entries[2]["status"] == "Released on bail"

    def test_extracts_status(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert entries[0]["status"] == "Imprisoned in Orumiyeh Central Prison"
        assert entries[1]["status"] == "Executed at Rajai Shahr Prison"

    def test_extracts_charges(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert entries[0]["charged_with"] == "Acting against national security"

    def test_extracts_sentence(self):
        entries = parse_listing_page(SAMPLE_PAGE)
        assert entries[1]["sentence"] == "Death"

    def test_skips_unrelated_html(self):
        entries = parse_listing_page("<html><body>no cards</body></html>")
        assert entries == []


class TestBuildCircumstances:
    def test_full_entry(self):
        result = build_circumstances({
            "charged_with": "Moharebeh",
            "sentence": "Death",
            "status": "Executed",
        })
        assert "Charged With: Moharebeh" in result
        assert "Sentence: Death" in result
        assert "Status: Executed" in result

    def test_partial_entry(self):
        result = build_circumstances({"status": "Executed"})
        assert result == "Status: Executed"

    def test_empty_entry(self):
        assert build_circumstances({}) is None


class TestPluginMetadata:
    def test_metadata(self):
        plugin = KhrnPlugin()
        assert plugin.name == "khrn"
        assert "Kurdistan Human Rights Network" in plugin.full_name
        assert plugin.base_url == "https://kurdistanhumanrights.org"
