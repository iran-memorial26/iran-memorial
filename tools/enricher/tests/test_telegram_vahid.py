"""Tests for Telegram @VahidOnline plugin."""

import pytest
from datetime import date
from tools.enricher.sources.telegram_vahid import VahidOnlinePlugin


class TestIsVictimPost:
    """Test filtering logic for victim posts vs. news posts."""

    @pytest.fixture
    def plugin(self):
        return VahidOnlinePlugin()

    def test_victim_post_with_killed_keyword(self, plugin):
        text = "امیرحسین کارگران کشته‌شده با شلیک سه تیر"
        assert plugin._is_victim_post(text) is True

    def test_victim_post_with_body_keyword(self, plugin):
        text = "پیکر بی‌جان امیرمحمد باباخانلو"
        assert plugin._is_victim_post(text) is True

    def test_victim_post_with_wounded_keyword(self, plugin):
        text = "مصیب نظامی زخمی شده در اعتراضات"
        assert plugin._is_victim_post(text) is True

    def test_political_news_excluded(self, plugin):
        text = "نتانیاهو اعلام کرد که شرایط برنامه هسته‌ای ایران"
        assert plugin._is_victim_post(text) is False

    def test_rally_numbers_excluded(self, plugin):
        text = "پلیس تورنتو: بیش از ۳۵۰ هزار نفر در تظاهرات"
        assert plugin._is_victim_post(text) is False

    def test_natural_death_excluded(self, plugin):
        text = "عنایت بخشی بازیگر ۸۰ ساله درگذشت"
        # Has "درگذشت" but no protest/killing keywords
        assert plugin._is_victim_post(text) is False

    def test_shooting_keyword(self, plugin):
        text = "تیراندازی کور به سمت معترضان"
        assert plugin._is_victim_post(text) is True

    def test_martyr_keyword(self, plugin):
        text = "شهید یوسف محمدعلیزاده"
        assert plugin._is_victim_post(text) is True

    def test_empty_text_returns_false(self, plugin):
        assert plugin._is_victim_post("") is False
        assert plugin._is_victim_post(None) is False


class TestParsePostText:
    """Test parsing victim information from post text."""

    @pytest.fixture
    def plugin(self):
        return VahidOnlinePlugin()

    def test_parse_basic_victim(self, plugin):
        text = "امیرحسین_کارگران\nکشته‌شده ۱۷ ساله با شلیک سه تیر ۱۸ دی ۱۴۰۴ تهران"
        result = plugin._parse_post_text(text)
        assert result is not None
        name, death_date, age, location, note = result
        assert name == "امیرحسین کارگران"
        assert age == 17
        assert death_date == date(2026, 1, 8)  # ۱۸ دی ۱۴۰۴ = Jan 8, 2026
        # location extraction is complex and optional
        assert isinstance(location, (str, type(None)))

    def test_parse_name_with_underscores(self, plugin):
        text = "مصیب_نظامی کشته شد"
        result = plugin._parse_post_text(text)
        assert result is not None
        name, _, _, _, _ = result
        assert name == "مصیب نظامی"
        assert "_" not in name

    def test_parse_name_with_parenthetical(self, plugin):
        text = "امیرمحمد_باباخانلو (از زخمی‌های ۱۸ دی) کشته شد"
        result = plugin._parse_post_text(text)
        assert result is not None
        name, _, _, _, note = result
        assert "(" not in name
        assert note == "از زخمی‌های ۱۸ دی" or "Shot" in note

    def test_parse_age_extraction(self, plugin):
        text = "یوسف محمدعلیزاده ۲۴ ساله کشته شد"
        result = plugin._parse_post_text(text)
        assert result is not None
        _, _, age, _, _ = result
        assert age == 24

    def test_parse_jalali_date(self, plugin):
        text = "کشته شده پنجشنبه ۱۸ دی ۱۴۰۴"
        result = plugin._parse_post_text(text)
        assert result is not None
        _, death_date, _, _, _ = result
        assert death_date == date(2026, 1, 8)  # ۱۸ دی ۱۴۰۴ = Jan 8, 2026

    def test_parse_location_borujerd(self, plugin):
        text = "مصیب نظامی در بروجرد کشته شد"
        result = plugin._parse_post_text(text)
        assert result is not None
        _, _, _, location, _ = result
        assert location == "بروجرد"

    def test_parse_shooting_note(self, plugin):
        text = "امیرحسین کارگران با شلیک مستقیم"
        result = plugin._parse_post_text(text)
        assert result is not None
        _, _, _, _, note = result
        assert note is not None
        assert "Shot" in note or "شلیک" in note

    def test_parse_injury_death_note(self, plugin):
        text = "زخمی شده بود و جانش رو از دست داد"
        result = plugin._parse_post_text(text)
        assert result is not None
        _, _, _, _, note = result
        assert note is not None
        assert "injur" in note.lower() or "زخمی" in note

    def test_service_message_returns_none(self, plugin):
        text = "این پیام حذف شده است"
        result = plugin._parse_post_text(text)
        assert result is None

    def test_empty_text_returns_none(self, plugin):
        assert plugin._parse_post_text("") is None
        assert plugin._parse_post_text(None) is None


class TestExtractPosts:
    """Test HTML post extraction."""

    @pytest.fixture
    def plugin(self):
        return VahidOnlinePlugin()

    def test_extract_post_with_number(self, plugin):
        html = '''
        <div data-post="VahidOnline/70645">
            <div class="tgme_widget_message_text">امیرحسین کارگران کشته شد</div>
        </div>
        '''
        posts = plugin._extract_posts(html)
        assert len(posts) == 1
        post_num, text, photo = posts[0]
        assert post_num == 70645
        assert "امیرحسین" in text

    def test_extract_photo_url(self, plugin):
        html = '''
        <div data-post="VahidOnline/70645">
            <div class="tgme_widget_message_text">Test</div>
            <div style="background-image:url('https://cdn4.telesco.pe/file/123.jpg')"></div>
        </div>
        '''
        posts = plugin._extract_posts(html)
        assert len(posts) == 1
        _, _, photo_url = posts[0]
        assert photo_url == "https://cdn4.telesco.pe/file/123.jpg"

    def test_extract_multiple_posts(self, plugin):
        html = '''
        <div data-post="VahidOnline/101">Text 1</div>
        <div data-post="VahidOnline/102">Text 2</div>
        <div data-post="VahidOnline/103">Text 3</div>
        '''
        posts = plugin._extract_posts(html)
        assert len(posts) == 3
        assert posts[0][0] == 101
        assert posts[1][0] == 102
        assert posts[2][0] == 103


class TestExtractPrevLink:
    """Test pagination link extraction."""

    @pytest.fixture
    def plugin(self):
        return VahidOnlinePlugin()

    def test_finds_prev_link(self, plugin):
        html = '<link rel="prev" href="?before=12345">'
        link = plugin._extract_prev_link(html)
        assert link == "?before=12345"

    def test_no_prev_link(self, plugin):
        html = "<html>No pagination here</html>"
        link = plugin._extract_prev_link(html)
        assert link is None
