"""Telegram @RememberTheirNames — public channel scraper."""

from __future__ import annotations

import logging
import re
from typing import AsyncIterator, Optional

from ..db.models import ExternalVictim
from ..utils.http import fetch_with_retry
from ..utils.jalali import parse_jalali_date, persian_to_int
from ..utils.provinces import extract_province
from . import register
from .base import SourcePlugin

log = logging.getLogger("enricher.telegram_rtn")

CHANNEL_URL = "https://t.me/s/RememberTheirNames"
BASE_URL = "https://t.me"

# Farsi city name → Latin city name (for province lookup)
FARSI_CITY_MAP: dict[str, str] = {
    "تهران": "tehran",
    "اصفهان": "isfahan",
    "مشهد": "mashhad",
    "شیراز": "shiraz",
    "تبریز": "tabriz",
    "اهواز": "ahvaz",
    "کرمانشاه": "kermanshah",
    "رشت": "rasht",
    "کرج": "karaj",
    "قم": "qom",
    "اراک": "arak",
    "همدان": "hamadan",
    "یزد": "yazd",
    "کرمان": "kerman",
    "ارومیه": "urmia",
    "بندرعباس": "bandar abbas",
    "گرگان": "gorgan",
    "ساری": "sari",
    "سنندج": "sanandaj",
    "زاهدان": "zahedan",
    "بجنورد": "bojnurd",
    "ایلام": "ilam",
    "خرم‌آباد": "khorramabad",
    "خرمآباد": "khorramabad",
    "بوشهر": "bushehr",
    "سمنان": "semnan",
    "یاسوج": "yasuj",
    "زنجان": "zanjan",
    "اردبیل": "ardabil",
    "سقز": "saqqez",
    "مهاباد": "mahabad",
    "نیشابور": "neyshabur",
    "بابل": "babol",
    "اسلامشهر": "eslamshahr",
    "فولادشهر": "isfahan",
    "نجف‌آباد": "isfahan",
    "نجفآباد": "isfahan",
    "قرچک": "tehran",
    "قیامدشت": "tehran",
    "گوهردشت": "karaj",
    "فردیس": "karaj",
    "شهرضا": "isfahan",
    "سبزوار": "sabzevar",
    "آمل": "amol",
    "بوکان": "bukan",
    "پیرانشهر": "piranshahr",
    "مریوان": "marivan",
    "جوانرود": "javanrud",
    "دزفول": "dezful",
    "آبادان": "abadan",
    "بهبهان": "behbahan",
    "ایذه": "izeh",
    "اندیمشک": "andimeshk",
    "بم": "bam",
    "سیرجان": "sirjan",
    "رفسنجان": "rafsanjan",
    "قزوین": "qazvin",
    "ساوه": "saveh",
    "ورامین": "varamin",
    "شهریار": "shahriar",
    "پاکدشت": "pakdasht",
    "لاهیجان": "lahijan",
    "بندر انزلی": "bandar anzali",
    "نوشهر": "nowshahr",
    "شاهرود": "semnan",
    "قائمشهر": "sari",
    "خمینی‌شهر": "isfahan",
    "خمینیشهر": "isfahan",
    "دورود": "khorramabad",
    "بروجرد": "khorramabad",
    "ملایر": "hamadan",
    "اندیشه": "tehran",
    "شهرکرد": "shahrekord",
    "چابهار": "chabahar",
    "ایرانشهر": "iranshahr",
    "خاش": "khash",
    "سراوان": "saravan",
    "طرق": "mashhad",
    "وکیل‌آباد": "mashhad",
    "وکیلآباد": "mashhad",
    "نظرآباد": "karaj",
    "کوه‌چنار": "shiraz",
    "قائمیه": "shiraz",
    "کازرون": "shiraz",
    "نورآباد": "khorramabad",
    "ممسنی": "shiraz",
    "بانه": "sanandaj",
    "دیوان‌دره": "sanandaj",
    "کامیاران": "sanandaj",
    "پاوه": "kermanshah",
    "سرپل‌ذهاب": "kermanshah",
    "هرسین": "kermanshah",
    "شوش": "ahvaz",
    "ماهشهر": "ahvaz",
    "رامهرمز": "ahvaz",
    "شادگان": "ahvaz",
    "خرمشهر": "ahvaz",
    "میاندوآب": "urmia",
    "نقده": "urmia",
    "سردشت": "urmia",
    "تکاب": "zanjan",
    "آبدانان": "ilam",
    "دهلران": "ilam",
    "داراب": "shiraz",
    "مرودشت": "shiraz",
    "لار": "shiraz",
    "بندر ماهشهر": "ahvaz",
    "شاهین‌شهر": "isfahan",
    "شاهینشهر": "isfahan",
    "دماوند": "tehran",
    "ری": "tehran",
    "رباط‌کریم": "tehran",
    "ملارد": "tehran",
}

_WARNED_CITIES: set[str] = set()


def farsi_city_to_latin(farsi: str) -> tuple[Optional[str], Optional[str]]:
    """Map Farsi city name to (latin_city, province).

    Tries each word and the full string against FARSI_CITY_MAP.
    Returns (None, None) for unknown cities.
    """
    if not farsi:
        return None, None

    farsi = farsi.strip()

    # Try full string first
    if farsi in FARSI_CITY_MAP:
        latin = FARSI_CITY_MAP[farsi]
        return latin, extract_province(latin)

    # Try individual words (right-to-left: last word is usually the province/city)
    words = farsi.split()
    for word in reversed(words):
        if word in FARSI_CITY_MAP:
            latin = FARSI_CITY_MAP[word]
            return latin, extract_province(latin)

    if farsi not in _WARNED_CITIES:
        _WARNED_CITIES.add(farsi)
        log.warning(f"Unknown Farsi city: {farsi}")
    return None, None


# --- HTML parsing (regex-based, consistent with boroumand.py) ---

# Extract individual message blocks
_POST_RE = re.compile(
    r'data-post="RememberTheirNames/(\d+)".*?'
    r'tgme_widget_message_bubble.*?</div>\s*</div>\s*</div>',
    re.DOTALL,
)

# Simpler approach: extract each message wrap block
_MESSAGE_BLOCK_RE = re.compile(
    r'<div class="tgme_widget_message_wrap[^"]*">'
    r'<div class="tgme_widget_message[^"]*"'
    r'\s+data-post="RememberTheirNames/(\d+)"'
    r'(.*?)</div>\s*</div>\s*</div>',
    re.DOTALL,
)

# Extract text content from message
_TEXT_RE = re.compile(
    r'tgme_widget_message_text[^>]*>(.*?)</div>',
    re.DOTALL,
)

# Extract photo URL from background-image
_PHOTO_RE = re.compile(
    r"background-image:url\('([^']+)'\)"
)

# Pagination link
_PREV_LINK_RE = re.compile(
    r'<link\s+rel="prev"\s+href="([^"]+)"'
)

# Jalali month names for date line matching
_MONTHS = "فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند"

# Entry line: number. name [age ساله] [(note)]
_ENTRY_RE = re.compile(
    r'^([۰-۹]+)\.\s*'           # entry number
    r'(.+?)'                     # name (lazy)
    r'(?:\s+([۰-۹]+)\s*ساله)?'  # optional age
    r'\s*$'
)

# Date+location line: [day] month year location
_DATE_LOC_RE = re.compile(
    r'^(?:([۰-۹]+)\s+)?'                    # optional day
    r'(' + _MONTHS + r')\s+'                 # month name
    r'([۰-۹]{4})'                           # year
    r'(?:\s+(.+?))?'                         # optional location
    r'\s*$'
)


def _strip_html(text: str) -> str:
    """Strip HTML tags and decode entities, keeping line breaks."""
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&quot;', '"').replace('&#39;', "'")
    return text.strip()


def extract_posts(html: str) -> list[dict]:
    """Parse Telegram channel HTML page into post dicts.

    Returns list of: {post_number: int, text: str, photo_url: str|None}
    """
    posts = []

    # Split by message wrap divs
    parts = html.split('data-post="RememberTheirNames/')
    for part in parts[1:]:  # skip first (before first post)
        # Extract post number
        num_match = re.match(r'(\d+)"', part)
        if not num_match:
            continue
        post_number = int(num_match.group(1))

        # Extract text
        text_match = _TEXT_RE.search(part)
        text = _strip_html(text_match.group(1)) if text_match else ""

        # Extract photo URL
        photo_match = _PHOTO_RE.search(part)
        photo_url = photo_match.group(1) if photo_match else None

        posts.append({
            "post_number": post_number,
            "text": text,
            "photo_url": photo_url,
        })

    return posts


def extract_prev_link(html: str) -> Optional[str]:
    """Extract rel="prev" link for older posts pagination."""
    m = _PREV_LINK_RE.search(html)
    return m.group(1) if m else None


def parse_post_text(text: str) -> Optional[dict]:
    """Parse a single post's text into structured data.

    Returns dict with: name_farsi, entry_number, age, date, location_farsi,
                       location_latin, province, note
    Returns None if text is not a victim entry (e.g. service messages).
    """
    if not text:
        return None

    lines = [l.strip() for l in text.split('\n') if l.strip()]

    # Filter out channel reference line
    lines = [
        l for l in lines
        if '@RememberTheirNames' not in l
        and 'تصویری از این عزیز' not in l  # "no photo found" note
    ]

    if not lines:
        return None

    # First line must have entry number + name
    entry_match = _ENTRY_RE.match(lines[0])
    if not entry_match:
        return None

    entry_number = persian_to_int(entry_match.group(1))
    name_raw = entry_match.group(2).strip()
    age = persian_to_int(entry_match.group(3)) if entry_match.group(3) else None

    # Strip parenthetical notes from name
    note = None
    paren_match = re.search(r'\(([^)]+)\)', name_raw)
    if paren_match:
        note = paren_match.group(1)
        name_raw = re.sub(r'\s*\([^)]+\)\s*', ' ', name_raw).strip()
        name_raw = re.sub(r'\s{2,}', ' ', name_raw)

    name_farsi = name_raw

    # Look for date+location line (2nd meaningful line)
    death_date = None
    location_farsi = None
    location_latin = None
    province = None

    for line in lines[1:]:
        date_match = _DATE_LOC_RE.match(line)
        if date_match:
            death_date = parse_jalali_date(line)
            location_farsi = (date_match.group(4) or "").strip() or None
            if location_farsi:
                location_latin, province = farsi_city_to_latin(location_farsi)
            break

    return {
        "entry_number": entry_number,
        "name_farsi": name_farsi,
        "age": age,
        "date": death_date,
        "location_farsi": location_farsi,
        "location_latin": location_latin,
        "province": province,
        "note": note,
    }


@register
class TelegramRTNPlugin(SourcePlugin):
    """Telegram @RememberTheirNames — public channel scraper."""

    @property
    def name(self) -> str:
        return "telegram_rtn"

    @property
    def full_name(self) -> str:
        return "Telegram @RememberTheirNames Memorial Channel"

    @property
    def base_url(self) -> str:
        return "https://t.me/RememberTheirNames"

    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Paginate through the public Telegram channel and yield victims."""
        url = CHANNEL_URL
        page_count = 0

        while url:
            html = await fetch_with_retry(
                self.session, url,
                rate_limit=(2.0, 4.0),
                cache_dir=self.cache_dir,
            )
            if not html:
                log.error(f"Failed to fetch {url}")
                break

            posts = extract_posts(html)
            page_count += 1

            for post in posts:
                source_id = f"telegram_rtn_{post['post_number']}"

                if self.progress.is_processed(source_id):
                    continue

                parsed = parse_post_text(post["text"])
                if not parsed:
                    self.progress.mark_processed(source_id)
                    continue

                yield ExternalVictim(
                    source_id=source_id,
                    source_name=self.full_name,
                    source_url=f"https://t.me/RememberTheirNames/{post['post_number']}",
                    source_type="telegram_channel",
                    name_farsi=parsed["name_farsi"],
                    date_of_death=parsed.get("date"),
                    age_at_death=parsed.get("age"),
                    place_of_death=parsed.get("location_latin") or parsed.get("location_farsi"),
                    province=parsed.get("province"),
                    photo_url=post.get("photo_url"),
                )

                self.progress.mark_processed(source_id)

            # Navigate to older posts
            prev = extract_prev_link(html)
            if prev:
                url = f"{BASE_URL}{prev}"
                self.progress.set_checkpoint("last_url", url)
                log.info(f"Page {page_count}: {len(posts)} posts processed")
            else:
                log.info(f"Reached oldest page after {page_count} pages")
                break
