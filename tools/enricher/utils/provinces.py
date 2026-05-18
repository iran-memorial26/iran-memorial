"""Province mapping — shared across all source plugins."""

from __future__ import annotations


# City/location → Province mapping for Iran
PROVINCE_MAP: dict[str, str] = {
    "tehran": "Tehran",
    "isfahan": "Isfahan",
    "esfahan": "Isfahan",
    "mashhad": "Khorasan-e Razavi",
    "shiraz": "Fars",
    "tabriz": "East Azerbaijan",
    "ahvaz": "Khuzestan",
    "ahwaz": "Khuzestan",
    "kermanshah": "Kermanshah",
    "zahedan": "Sistan va Baluchestan",
    "sanandaj": "Kurdistan",
    "rasht": "Gilan",
    "karaj": "Alborz",
    "qom": "Qom",
    "arak": "Markazi",
    "hamadan": "Hamadan",
    "hamedan": "Hamadan",
    "yazd": "Yazd",
    "kerman": "Kerman",
    "urmia": "West Azerbaijan",
    "orumiyeh": "West Azerbaijan",
    "bandar abbas": "Hormozgan",
    "gorgan": "Golestan",
    "sari": "Mazandaran",
    "birjand": "South Khorasan",
    "bojnurd": "North Khorasan",
    "ilam": "Ilam",
    "khorramabad": "Lorestan",
    "bushehr": "Bushehr",
    "semnan": "Semnan",
    "shahr-e kord": "Chaharmahal and Bakhtiari",
    "shahrekord": "Chaharmahal and Bakhtiari",
    "farsan": "Chaharmahal and Bakhtiari",
    "yasuj": "Kohgiluyeh and Boyer-Ahmad",
    "zanjan": "Zanjan",
    "ardabil": "Ardabil",
    "saqqez": "Kurdistan",
    "mahabad": "West Azerbaijan",
    "bukan": "West Azerbaijan",
    "izeh": "Khuzestan",
    "dezful": "Khuzestan",
    "abadan": "Khuzestan",
    "behbahan": "Khuzestan",
    "andimeshk": "Khuzestan",
    "javanrud": "Kermanshah",
    "marivan": "Kurdistan",
    "piranshahr": "West Azerbaijan",
    "oshnavieh": "West Azerbaijan",
    "bam": "Kerman",
    "jiroft": "Kerman",
    "rafsanjan": "Kerman",
    "sirjan": "Kerman",
    "chabahar": "Sistan va Baluchestan",
    "iranshahr": "Sistan va Baluchestan",
    "khash": "Sistan va Baluchestan",
    "saravan": "Sistan va Baluchestan",
    "amol": "Mazandaran",
    "babol": "Mazandaran",
    "nowshahr": "Mazandaran",
    "lahijan": "Gilan",
    "bandar anzali": "Gilan",
    "qazvin": "Qazvin",
    "saveh": "Markazi",
    "khomein": "Markazi",
    "neyshabur": "Khorasan-e Razavi",
    "nishapur": "Khorasan-e Razavi",
    "sabzevar": "Khorasan-e Razavi",
    "torbat-e heydarieh": "Khorasan-e Razavi",
    "varamin": "Tehran",
    "eslamshahr": "Tehran",
    "shahriar": "Tehran",
    "pakdasht": "Tehran",
}


def build_city_resolver(cities: list[dict]) -> dict[str, int]:
    """Build a text → city_id lookup from DB cities and PROVINCE_MAP aliases.

    Args:
        cities: List of dicts with 'id', 'slug', 'name_en' from the cities table.

    Returns:
        Dict mapping normalized text variants to city IDs.
    """
    resolver: dict[str, int] = {}
    slug_to_id: dict[str, int] = {}

    for c in cities:
        cid = c["id"]
        slug = c["slug"]
        slug_to_id[slug] = cid
        resolver[slug] = cid
        # Also map name_en lowercase
        if c.get("name_en"):
            resolver[c["name_en"].lower()] = cid

    # Map PROVINCE_MAP keys to city IDs (aliases like "esfahan", "ahwaz")
    for key in PROVINCE_MAP:
        if key in resolver:
            continue
        # Try slug form (spaces → hyphens)
        slug_form = key.replace(" ", "-")
        if slug_form in slug_to_id:
            resolver[key] = slug_to_id[slug_form]

    return resolver


def resolve_city_id(
    location: str | None, resolver: dict[str, int]
) -> int | None:
    """Resolve a location text to a city_id using the pre-built resolver."""
    if not location or not resolver:
        return None

    loc = location.lower().strip()

    # Direct match
    if loc in resolver:
        return resolver[loc]

    # Try with spaces replaced by hyphens
    loc_hyphen = loc.replace(" ", "-")
    if loc_hyphen in resolver:
        return resolver[loc_hyphen]

    # Substring match (find longest matching key to avoid partial false matches)
    best_key: str | None = None
    for key in resolver:
        if key in loc and (best_key is None or len(key) > len(best_key)):
            best_key = key
    if best_key:
        return resolver[best_key]

    return None


def extract_province(location: str | None) -> str | None:
    """Extract province from a location string using city mapping.

    If the location string directly matches a known province name,
    return it as-is. Otherwise, try to find a city match.
    """
    if not location:
        return None

    loc_lower = location.lower().strip()

    # Direct province match
    known_provinces = {v.lower(): v for v in PROVINCE_MAP.values()}
    if loc_lower in known_provinces:
        return known_provinces[loc_lower]

    # City match
    for city, prov in PROVINCE_MAP.items():
        if city in loc_lower:
            return prov

    return None
