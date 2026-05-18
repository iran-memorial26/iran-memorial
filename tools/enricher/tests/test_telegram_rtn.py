"""Tests for the Telegram @RememberTheirNames plugin."""

from datetime import date

from tools.enricher.utils.jalali import (
    persian_to_int,
    jalali_to_gregorian,
    parse_jalali_date,
)
from tools.enricher.sources.telegram_rtn import (
    parse_post_text,
    extract_posts,
    extract_prev_link,
    farsi_city_to_latin,
)


# --- persian_to_int ---


class TestPersianToInt:
    def test_basic(self):
        assert persian_to_int("۱۲۳") == 123

    def test_zero(self):
        assert persian_to_int("۰") == 0

    def test_large_number(self):
        assert persian_to_int("۲۷۰۹") == 2709

    def test_single_digit(self):
        assert persian_to_int("۵") == 5

    def test_mixed_ascii_persian(self):
        assert persian_to_int("1۲3") == 123

    def test_with_whitespace(self):
        assert persian_to_int("  ۴۲  ") == 42


# --- jalali_to_gregorian ---


class TestJalaliToGregorian:
    def test_dey_18_1404(self):
        # 18 Dey 1404 = January 8, 2026
        result = jalali_to_gregorian(1404, 10, 18)
        assert result == date(2026, 1, 8)

    def test_first_day_of_year(self):
        # 1 Farvardin 1404 = March 21, 2025
        result = jalali_to_gregorian(1404, 1, 1)
        assert result == date(2025, 3, 21)

    def test_dey_10_1404(self):
        # 10 Dey 1404 = December 31, 2025
        result = jalali_to_gregorian(1404, 10, 10)
        assert result == date(2025, 12, 31)

    def test_dey_1_1404(self):
        # 1 Dey 1404 = December 22, 2025
        result = jalali_to_gregorian(1404, 10, 1)
        assert result == date(2025, 12, 22)

    def test_esfand_29_1403(self):
        # 29 Esfand 1403 = March 19, 2025 (1403 is not a leap year)
        result = jalali_to_gregorian(1403, 12, 29)
        assert result == date(2025, 3, 19)

    def test_bahman_1_1404(self):
        # 1 Bahman 1404 = January 21, 2026
        result = jalali_to_gregorian(1404, 11, 1)
        assert result == date(2026, 1, 21)


# --- parse_jalali_date ---


class TestParseJalaliDate:
    def test_full_date(self):
        result = parse_jalali_date("۱۸ دی ۱۴۰۴")
        assert result == date(2026, 1, 8)

    def test_date_without_day(self):
        result = parse_jalali_date("دی ۱۴۰۴")
        # Should default to day 1
        assert result == date(2025, 12, 22)

    def test_full_date_with_location(self):
        result = parse_jalali_date("۱۰ دی ۱۴۰۴ فولادشهر اصفهان")
        assert result == date(2025, 12, 31)

    def test_empty_string(self):
        assert parse_jalali_date("") is None

    def test_none_input(self):
        assert parse_jalali_date(None) is None

    def test_invalid_text(self):
        assert parse_jalali_date("Channel created") is None

    def test_bahman_date(self):
        result = parse_jalali_date("۵ بهمن ۱۴۰۴")
        assert result is not None
        assert result.year == 2026
        assert result.month == 1


# --- parse_post_text ---


class TestParsePostText:
    def test_standard_format(self):
        text = "۱. داریوش انصاری\n۱۰ دی ۱۴۰۴ فولادشهر اصفهان\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["entry_number"] == 1
        assert result["name_farsi"] == "داریوش انصاری"
        assert result["date"] == date(2025, 12, 31)
        assert result["location_farsi"] == "فولادشهر اصفهان"
        assert result["province"] == "Isfahan"

    def test_standard_with_newlines(self):
        text = "۲۷۰۹. حسن صداقتکار\n\n۱۸ دی ۱۴۰۴ مشهد\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["entry_number"] == 2709
        assert result["name_farsi"] == "حسن صداقتکار"
        assert result["date"] == date(2026, 1, 8)
        assert result["province"] == "Khorasan-e Razavi"

    def test_with_age(self):
        text = "۴۵۴. سروش اسحاقی ۱۶ ساله\n\nدی ۱۴۰۴ مشهد\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["name_farsi"] == "سروش اسحاقی"
        assert result["age"] == 16

    def test_with_parenthetical(self):
        text = "۲۷۱۸. مجتبی مرادی (از اتباع افغانستان)\n\nدی ۱۴۰۴ نجف‌آباد اصفهان\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["name_farsi"] == "مجتبی مرادی"
        assert result["note"] == "از اتباع افغانستان"

    def test_no_location(self):
        text = "۵. شایان اسداللهی\n\n۱۰ دی ۱۴۰۴\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["name_farsi"] == "شایان اسداللهی"
        assert result["date"] is not None
        assert result["location_farsi"] is None

    def test_no_photo_note_filtered(self):
        text = "۵۳. بهروز صفایی\nتصویری از این عزیز یافت نشد\n\n۱۰ دی ۱۴۰۴ تهران\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["name_farsi"] == "بهروز صفایی"

    def test_service_message_returns_none(self):
        assert parse_post_text("Channel created") is None

    def test_empty_text_returns_none(self):
        assert parse_post_text("") is None

    def test_none_returns_none(self):
        assert parse_post_text(None) is None

    def test_only_channel_ref_returns_none(self):
        assert parse_post_text("@RememberTheirNames") is None

    def test_date_without_day(self):
        text = "۲۷۱۱. محمدمهدی یزدانی\n\nدی ۱۴۰۴ مشهد\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["date"] is not None  # Should default to 1st of month

    def test_name_with_paren_alias(self):
        text = "۱۳. علی  (نجات) عزیزی\n\n۱۰ دی ۱۴۰۴ تهران\n\n@RememberTheirNames"
        result = parse_post_text(text)
        assert result is not None
        assert result["name_farsi"] == "علی عزیزی"
        assert result["note"] == "نجات"


# --- extract_posts ---


class TestExtractPosts:
    SAMPLE_HTML = '''
    <div class="tgme_widget_message_wrap js-widget_message_wrap">
    <div class="tgme_widget_message text_not_supported_wrap service_message js-widget_message"
         data-post="RememberTheirNames/1">
      <div class="tgme_widget_message_bubble">
        <div class="tgme_widget_message_text js-message_text" dir="auto">Channel created</div>
      </div>
    </div></div>
    <div class="tgme_widget_message_wrap js-widget_message_wrap">
    <div class="tgme_widget_message text_not_supported_wrap js-widget_message"
         data-post="RememberTheirNames/2">
      <div class="tgme_widget_message_bubble">
        <a class="tgme_widget_message_photo_wrap"
           style="width:642px;background-image:url('https://cdn4.telesco.pe/file/test123.jpg')">
          <div class="tgme_widget_message_photo"></div>
        </a>
        <div class="tgme_widget_message_text js-message_text" dir="auto">۱. داریوش انصاری<br/>۱۰ دی ۱۴۰۴ فولادشهر اصفهان<br/><br/><a href="https://t.me/RememberTheirNames">@RememberTheirNames</a></div>
      </div>
    </div></div>
    <div class="tgme_widget_message_wrap js-widget_message_wrap">
    <div class="tgme_widget_message text_not_supported_wrap js-widget_message"
         data-post="RememberTheirNames/3">
      <div class="tgme_widget_message_bubble">
        <a class="tgme_widget_message_photo_wrap"
           style="width:642px;background-image:url('https://cdn4.telesco.pe/file/test456.jpg')">
          <div class="tgme_widget_message_photo"></div>
        </a>
        <div class="tgme_widget_message_text js-message_text" dir="auto">۲. امیرحسام خدایاری‌فرد<br/><br/>۱۰ دی ۱۴۰۴ اصفهان<br/><br/><a href="https://t.me/RememberTheirNames">@RememberTheirNames</a></div>
      </div>
    </div></div>
    '''

    def test_extracts_correct_count(self):
        posts = extract_posts(self.SAMPLE_HTML)
        assert len(posts) == 3

    def test_post_numbers(self):
        posts = extract_posts(self.SAMPLE_HTML)
        assert posts[0]["post_number"] == 1
        assert posts[1]["post_number"] == 2
        assert posts[2]["post_number"] == 3

    def test_service_message_no_photo(self):
        posts = extract_posts(self.SAMPLE_HTML)
        assert posts[0]["text"] == "Channel created"
        assert posts[0]["photo_url"] is None

    def test_photo_url_extracted(self):
        posts = extract_posts(self.SAMPLE_HTML)
        assert posts[1]["photo_url"] == "https://cdn4.telesco.pe/file/test123.jpg"
        assert posts[2]["photo_url"] == "https://cdn4.telesco.pe/file/test456.jpg"

    def test_text_cleaned(self):
        posts = extract_posts(self.SAMPLE_HTML)
        text = posts[1]["text"]
        assert "<br" not in text
        assert "<a " not in text
        assert "داریوش انصاری" in text

    def test_empty_html(self):
        assert extract_posts("") == []


# --- extract_prev_link ---


class TestExtractPrevLink:
    def test_finds_prev(self):
        html = '<link rel="prev" href="/s/RememberTheirNames?before=2856">'
        assert extract_prev_link(html) == "/s/RememberTheirNames?before=2856"

    def test_no_prev(self):
        html = '<link rel="next" href="/s/RememberTheirNames?after=16">'
        assert extract_prev_link(html) is None

    def test_first_page_no_prev(self):
        html = '<link rel="next" href="/s/RememberTheirNames?after=16">\n<link rel="canonical" href="/s/RememberTheirNames?before=17">'
        assert extract_prev_link(html) is None


# --- farsi_city_to_latin ---


class TestFarsiCityToLatin:
    def test_simple_city(self):
        latin, province = farsi_city_to_latin("مشهد")
        assert latin == "mashhad"
        assert province == "Khorasan-e Razavi"

    def test_tehran(self):
        latin, province = farsi_city_to_latin("تهران")
        assert latin == "tehran"
        assert province == "Tehran"

    def test_compound_location(self):
        latin, province = farsi_city_to_latin("فولادشهر اصفهان")
        assert province == "Isfahan"

    def test_unknown_city(self):
        latin, province = farsi_city_to_latin("ناشناخته")
        assert latin is None
        assert province is None

    def test_empty_string(self):
        latin, province = farsi_city_to_latin("")
        assert latin is None
        assert province is None

    def test_none_input(self):
        latin, province = farsi_city_to_latin(None)
        assert latin is None
        assert province is None

    def test_suburb_maps_to_parent(self):
        latin, province = farsi_city_to_latin("اسلامشهر")
        assert latin == "eslamshahr"
        assert province == "Tehran"
