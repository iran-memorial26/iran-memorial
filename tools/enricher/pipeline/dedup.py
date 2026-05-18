"""Database deduplication — find and merge duplicate victim records."""

from __future__ import annotations

import logging
import re
import time
from typing import Optional

from ..db.models import DedupStats
from ..db.pool import close_pool, get_pool
from ..db.queries import (
    delete_victim,
    load_all_victims_with_counts,
    merge_victim_data,
    migrate_photos,
    migrate_sources,
    record_slug_redirect,
)
from ..utils.farsi import normalize_farsi
from ..utils.latin import name_word_set

log = logging.getLogger("enricher")

# Regex to strip parenthetical content like (ژینا) or (Jina)
_PARENS = re.compile(r"\s*\([^)]*\)\s*")

# Thresholds
AUTO_THRESHOLD = 50
REVIEW_THRESHOLD = 30

# Common Iranian geographic / tribal suffixes that get inconsistently appended
# to names across data sources (e.g. "Afkari" vs "Afkari Sangari"). Stripped
# from the *secondary* token-overlap grouping pass so that records with
# differing surname-suffixes still cluster for pair-scoring. Never used for
# the strict primary Farsi-key pass — only for the relaxed fallback.
_GEO_SUFFIXES_FA = {
    "سنگری", "کرمانی", "اصفهانی", "مشهدی", "تهرانی", "تبریزی", "شیرازی",
    "یزدی", "قزوینی", "همدانی", "اهوازی", "بوشهری", "ساروی", "گیلانی",
    "مازندرانی", "کردستانی", "بلوچی", "گرگانی", "بختیاری",
}
_GEO_SUFFIXES_LATIN = {
    "sangari", "kermani", "esfahani", "isfahani", "mashhadi", "tehrani",
    "tabrizi", "shirazi", "yazdi", "qazvini", "ghazvini", "hamadani",
    "ahvazi", "bushehri", "sarvi", "gilani", "mazandarani", "kurdistani",
    "baluchi", "balochi", "gorgani", "bakhtiari",
}


def _strip_geo_suffix_fa(tokens: list[str]) -> list[str]:
    """Drop trailing geographic-suffix tokens from a Farsi name token list."""
    out = list(tokens)
    while out and out[-1] in _GEO_SUFFIXES_FA:
        out.pop()
    return out


def _strip_geo_suffix_latin(tokens: frozenset[str]) -> frozenset[str]:
    """Drop geographic-suffix tokens from a Latin name token set."""
    return frozenset(t for t in tokens if t not in _GEO_SUFFIXES_LATIN)

# Fields to count for completeness scoring
SCORED_FIELDS = [
    "name_farsi", "aliases", "date_of_birth", "place_of_birth",
    "gender", "ethnicity", "religion", "photo_url",
    "occupation_en", "occupation_fa", "education",
    "date_of_death", "age_at_death", "place_of_death", "province",
    "cause_of_death", "circumstances_en", "circumstances_fa",
    "event_context", "responsible_forces", "witnesses", "last_seen",
    "burial_location", "family_info", "dreams_en", "beliefs_en",
    "personality_en", "quotes", "tributes",
]


def _score_pair(a: dict, b: dict) -> tuple[int, list[str]]:
    """Score how likely two DB victims are the same person.

    Returns (score, reasons). High score = likely same person.
    Negative = definitely different people.
    """
    score = 0
    reasons = []

    # Latin name word-set exact match — until now this was assumed "free"
    # because clustering buckets pair candidates by name_word_set, but
    # tertiary-pass and geo-suffix relaxations let pairs through where Latin
    # only partially matched. Score it explicitly so that an exact double
    # name match (Latin + Farsi) is rewarded over a single-language match.
    a_words = name_word_set(a.get("name_latin"))
    b_words = name_word_set(b.get("name_latin"))
    if a_words and b_words:
        if a_words == b_words:
            score += 15
            reasons.append("latin name exact (+15)")

    # Farsi name match — multiple comparison strategies, from strict to lax.
    # Records often differ by parenthetical aliases (Mahsa "Jina" Amini) or
    # geographic suffixes (Sangari, Kermani) appended inconsistently across
    # sources. Compare on the normalised core to recognise them as the
    # same person without false-positives on truly different names.
    a_farsi_raw = normalize_farsi(a.get("name_farsi"))
    b_farsi_raw = normalize_farsi(b.get("name_farsi"))
    if a_farsi_raw and b_farsi_raw:
        if a_farsi_raw == b_farsi_raw:
            score += 50
            reasons.append("farsi match (+50)")
        else:
            # Strip parens, split into per-word tokens (normalize_farsi
            # would otherwise collapse whitespace), normalise each token,
            # then drop trailing geographic suffixes.
            def _farsi_tokens(raw: str) -> list[str]:
                no_parens = _PARENS.sub(" ", raw or "")
                return _strip_geo_suffix_fa(
                    [normalize_farsi(w) for w in no_parens.split() if w.strip()]
                )
            a_tokens = _farsi_tokens(a.get("name_farsi") or "")
            b_tokens = _farsi_tokens(b.get("name_farsi") or "")
            if a_tokens and b_tokens and a_tokens == b_tokens:
                score += 40
                reasons.append("farsi core match (+40, geo suffix differs)")
            elif a_tokens and b_tokens and set(a_tokens) & set(b_tokens) and len(set(a_tokens) & set(b_tokens)) >= 2:
                score += 25
                reasons.append("farsi partial token overlap (+25)")
            else:
                score -= 10
                reasons.append("farsi mismatch (-10)")

    # Death date — graduated penalty.
    # The old logic flat-penalised any non-1-day mismatch by -100, which
    # buried clear duplicates where two sources had different *estimates*
    # of the date for the same person. Sharmahd's record is the canonical
    # case: witness.report had 2024-08-28 (when the sentence was made
    # public), OHCHR had 2024-10-28 (the actual execution). 61-day diff,
    # same person, same Farsi name, same birth year — the old penalty
    # made -100 outweigh every other positive signal.
    #
    # New scale, graduated in 30/90/365-day buckets:
    #   exact          +50
    #   ±1 day         +40
    #   ≤7 days        +20  (different sources rounding differently)
    #   ≤30 days       -10  (suspicious but recoverable via name+birth)
    #   ≤90 days       -40
    #   ≤365 days      -70
    #   >365 days      -100 (genuinely different years -> different people)
    a_dod = a.get("date_of_death")
    b_dod = b.get("date_of_death")
    if a_dod and b_dod:
        diff = abs((a_dod - b_dod).days)
        if diff == 0:
            score += 50
            reasons.append("date match (+50)")
        elif diff <= 1:
            score += 40
            reasons.append("date ±1 day (+40)")
        elif diff <= 7:
            score += 20
            reasons.append(f"date ±7d (+20, diff={diff}d)")
        elif diff <= 30:
            score -= 10
            reasons.append(f"date ±30d (-10, diff={diff}d)")
        elif diff <= 90:
            score -= 40
            reasons.append(f"date ±90d (-40, diff={diff}d)")
        elif diff <= 365:
            # Year-typo lift: when Latin (guaranteed by clustering) AND Farsi
            # names match EXACTLY and the diff is ~365 days, this is the
            # classic Persian-calendar year-conversion bug or source-side
            # year typo (e.g. Rahnavard: 2022-12-12 vs 2023-12-12, same
            # person, one record carried the wrong year). Father/son with
            # the same Latin name almost always have different Farsi tokens,
            # so requiring Farsi exact match keeps the false-positive risk
            # negligible.
            a_fa_n = normalize_farsi(a.get("name_farsi"))
            b_fa_n = normalize_farsi(b.get("name_farsi"))
            if 360 <= diff <= 366 and a_fa_n and a_fa_n == b_fa_n:
                score -= 10
                reasons.append(f"date ±1y year-typo + farsi exact (-10, diff={diff}d)")
            else:
                score -= 70
                reasons.append(f"date ±1y (-70, diff={diff}d)")
        else:
            score -= 100
            reasons.append(f"DIFFERENT years (-100, diff={diff}d)")
    elif a_dod or b_dod:
        # One has date, one doesn't. Could be a genuine duplicate where one
        # record is incomplete — but also could be two distinct people, one
        # of whom is the still-imprisoned brother / cousin. The decision
        # must lean on other signals, so we hand out a modest base bonus and
        # let birth-date / province / cause / cause + name_farsi push it
        # over the threshold.
        score += 5
        reasons.append("one has date (+5)")
        # If both names match exactly (Farsi or Latin word-set) AND province
        # matches, this is overwhelmingly likely the same person — boost.
        a_fa = normalize_farsi(a.get("name_farsi"))
        b_fa = normalize_farsi(b.get("name_farsi"))
        a_prov_q = (a.get("province") or "").lower().strip()
        b_prov_q = (b.get("province") or "").lower().strip()
        if a_fa and a_fa == b_fa and a_prov_q and a_prov_q == b_prov_q:
            score += 20
            reasons.append("null-date but farsi+province match (+20)")

    # Birth date — anchor especially useful when death-date missing.
    a_dob = a.get("date_of_birth")
    b_dob = b.get("date_of_birth")
    if a_dob and b_dob:
        try:
            ddiff = abs((a_dob - b_dob).days)
            if ddiff == 0:
                score += 30
                reasons.append("birth date match (+30)")
            elif ddiff <= 180 and a_dob.year == b_dob.year:
                # Same year, different month/day — common when one record
                # has year-only (YYYY-01-01) and another has the real date.
                score += 15
                reasons.append("birth year match (+15)")
            elif ddiff > 365 * 3:
                score -= 30
                reasons.append("birth dates >3y apart (-30)")
        except (TypeError, AttributeError):
            pass

    # Province
    a_prov = (a.get("province") or "").lower().strip()
    b_prov = (b.get("province") or "").lower().strip()
    if a_prov and b_prov:
        if a_prov == b_prov:
            score += 20
            reasons.append("province match (+20)")
        else:
            score -= 20
            reasons.append("province mismatch (-20)")

    # Age
    a_age = a.get("age_at_death")
    b_age = b.get("age_at_death")
    if a_age and b_age:
        diff = abs(a_age - b_age)
        if diff == 0:
            score += 15
            reasons.append("age match (+15)")
        elif diff <= 2:
            score += 5
            reasons.append("age close (+5)")
        else:
            score -= 30
            reasons.append("age mismatch (-30)")

    # Place of death
    a_pod = (a.get("place_of_death") or "").lower().strip()
    b_pod = (b.get("place_of_death") or "").lower().strip()
    if a_pod and b_pod and a_pod == b_pod:
        score += 10
        reasons.append("place match (+10)")

    # Cause of death
    a_cod = (a.get("cause_of_death") or "").lower().strip()
    b_cod = (b.get("cause_of_death") or "").lower().strip()
    if a_cod and b_cod and a_cod == b_cod:
        score += 10
        reasons.append("cause match (+10)")

    return score, reasons


def _completeness_score(v: dict) -> int:
    """Score a victim by data completeness (higher = richer record)."""
    score = 0

    # Verified status is the strongest signal
    if v.get("verification_status") == "verified":
        score += 100

    # Non-null fields
    for f in SCORED_FIELDS:
        val = v.get(f)
        if val is not None and val != "" and val != "unknown":
            score += 1

    # Sources and photos (from LOAD_VICTIMS_WITH_COUNTS)
    score += v.get("source_count", 0) * 5
    score += v.get("photo_count", 0) * 3

    # Having a death date is critical
    if v.get("date_of_death"):
        score += 20

    # Having a photo is valuable
    if v.get("photo_url"):
        score += 10

    return score


def _dedup_farsi_key(name_farsi: str | None) -> str:
    """Normalize Farsi name for grouping: strip parens, then normalize."""
    if not name_farsi:
        return ""
    cleaned = _PARENS.sub(" ", name_farsi).strip()
    return normalize_farsi(cleaned)


def find_duplicate_groups(
    victims: list[dict],
) -> list[list[dict]]:
    """Group victims by normalized Farsi name (with parenthetical alias stripping)
    and Latin word-set fallback. Returns groups with 2+ members."""
    by_farsi: dict[str, list[dict]] = {}
    seen_ids: set[str] = set()

    for v in victims:
        # Skip "unknown" and very short names
        name = (v.get("name_latin") or "").lower()
        if name in ("unknown", "unknwon", ""):
            continue
        raw_farsi = (v.get("name_farsi") or "").strip()
        if len(raw_farsi) < 4:
            continue

        key = _dedup_farsi_key(v.get("name_farsi"))
        if not key:
            continue
        by_farsi.setdefault(key, []).append(v)

    groups = []
    for group in by_farsi.values():
        if len(group) > 1:
            groups.append(group)
            for v in group:
                seen_ids.add(str(v["id"]))

    # Secondary pass: Latin word-set grouping for victims not yet grouped
    by_latin: dict[frozenset, list[dict]] = {}
    for v in victims:
        vid = str(v["id"])
        if vid in seen_ids:
            continue
        name = (v.get("name_latin") or "").lower()
        if name in ("unknown", "unknwon", "") or len(name) < 6:
            continue
        words = name_word_set(v.get("name_latin"))
        if words and len(words) >= 2:
            by_latin.setdefault(words, []).append(v)

    for group in by_latin.values():
        if len(group) > 1:
            groups.append(group)
            for v in group:
                seen_ids.add(str(v["id"]))

    # Tertiary pass: relaxed grouping that strips geographic surname suffixes
    # ("Sangari", "Kermani" etc.) and groups by core-token overlap. Catches
    # the Navid Afkari vs Navid Afkari Sangari class of duplicates that
    # strict word-set matching missed. We require ≥2 tokens to overlap and
    # the shorter set to be a subset of the longer's core (no foreign tokens
    # outside the suffix list) to keep false-positive rate manageable.
    candidates = []
    for v in victims:
        if str(v["id"]) in seen_ids:
            continue
        name = (v.get("name_latin") or "").lower()
        if name in ("unknown", "unknwon", "") or len(name) < 6:
            continue
        words = name_word_set(v.get("name_latin"))
        core = _strip_geo_suffix_latin(words)
        if len(core) >= 2:
            candidates.append((v, words, core))

    for i in range(len(candidates)):
        a_v, a_words, a_core = candidates[i]
        if str(a_v["id"]) in seen_ids:
            continue
        bucket = [a_v]
        for j in range(i + 1, len(candidates)):
            b_v, b_words, b_core = candidates[j]
            if str(b_v["id"]) in seen_ids:
                continue
            # Same core token set → very strong signal
            if a_core == b_core:
                bucket.append(b_v)
                continue
            # OR subset relationship where the difference is only geo
            # suffixes (one record adds e.g. "Sangari", "Kermani")
            diff = a_words.symmetric_difference(b_words)
            if diff and diff <= _GEO_SUFFIXES_LATIN and (a_core & b_core) and len(a_core & b_core) >= 2:
                bucket.append(b_v)
        if len(bucket) > 1:
            groups.append(bucket)
            for v in bucket:
                seen_ids.add(str(v["id"]))

    return groups


def analyze_group(
    group: list[dict], threshold: int = AUTO_THRESHOLD
) -> Optional[tuple[dict, list[tuple[dict, int, list[str]]]]]:
    """Analyze a duplicate group. Returns (winner, [(loser, score, reasons), ...]) or None.

    Only returns groups where ALL losers score >= threshold against the winner.
    """
    if len(group) < 2:
        return None

    # Score all pairs to find mergeable ones
    # For each pair, check if they're likely the same person
    mergeable: list[tuple[int, int, int, list[str]]] = []  # (i, j, score, reasons)

    for i in range(len(group)):
        for j in range(i + 1, len(group)):
            score, reasons = _score_pair(group[i], group[j])
            if score >= threshold:
                mergeable.append((i, j, score, reasons))

    if not mergeable:
        return None

    # Find connected components (victims linked by mergeable pairs)
    connected = set()
    for i, j, _, _ in mergeable:
        connected.add(i)
        connected.add(j)

    # Pick winner: highest completeness score
    candidates = [group[i] for i in connected]
    candidates.sort(key=_completeness_score, reverse=True)
    winner = candidates[0]
    winner_id = str(winner["id"])

    # All others in the connected set are losers
    losers = []
    for v in candidates[1:]:
        score, reasons = _score_pair(winner, v)
        if score >= threshold:
            losers.append((v, score, reasons))

    if not losers:
        return None

    return winner, losers


async def run_dedup(
    database_url: str,
    dry_run: bool = True,
    include_review: bool = False,
    limit: Optional[int] = None,
    verbose: bool = False,
) -> DedupStats:
    """Run the deduplication pipeline.

    Args:
        database_url: PostgreSQL connection string
        dry_run: Preview without writing (default True for safety)
        include_review: Also merge 30-49 score pairs
        limit: Max groups to process
        verbose: Show per-group details
    """
    stats = DedupStats()
    threshold = REVIEW_THRESHOLD if include_review else AUTO_THRESHOLD

    pool = await get_pool(database_url)

    try:
        # 1. Load all victims with counts
        log.info("Loading all victims with counts...")
        t0 = time.time()
        victims = await load_all_victims_with_counts(pool)
        log.info(f"Loaded {len(victims)} victims ({time.time()-t0:.1f}s)")

        # 2. Find duplicate groups
        groups = find_duplicate_groups(victims)
        stats.groups_found = len(groups)
        log.info(f"Found {len(groups)} potential duplicate groups")

        # 3. Analyze each group
        processed = 0
        for group in groups:
            if limit and processed >= limit:
                break

            result = analyze_group(group, AUTO_THRESHOLD)
            result_review = None
            if result is None and include_review:
                result_review = analyze_group(group, REVIEW_THRESHOLD)

            if result:
                stats.auto_merge += 1
            elif result_review:
                result = result_review
                stats.review += 1
            else:
                stats.skipped += 1
                continue

            winner, losers = result
            processed += 1

            if verbose:
                log.info(
                    f"\n  GROUP: {winner.get('name_latin')} / "
                    f"{winner.get('name_farsi')}"
                )
                log.info(
                    f"  WINNER: {winner['slug']} "
                    f"(completeness={_completeness_score(winner)}, "
                    f"sources={winner.get('source_count', 0)}, "
                    f"photos={winner.get('photo_count', 0)}, "
                    f"status={winner.get('verification_status')})"
                )

            # 4. Merge each loser into winner
            for loser, score, reasons in losers:
                if verbose:
                    log.info(
                        f"  MERGE: {loser['slug']} → {winner['slug']} "
                        f"(score={score}: {', '.join(reasons)})"
                    )

                if not dry_run:
                    winner_id = str(winner["id"])
                    loser_id = str(loser["id"])

                    # Merge data (fill NULLs)
                    await merge_victim_data(pool, winner_id, loser)

                    # Migrate sources
                    src_count = await migrate_sources(pool, winner_id, loser_id)
                    stats.sources_migrated += src_count

                    # Migrate photos
                    photo_count = await migrate_photos(pool, winner_id, loser_id)
                    stats.photos_migrated += photo_count

                    # Capture loser slug as a permanent redirect to the
                    # winner BEFORE deleting the loser. The FK target is
                    # the winner so the redirect survives the delete.
                    # External links (Twitter, NGO reports, press, search
                    # engines) continue to land on the surviving record.
                    await record_slug_redirect(
                        pool,
                        from_slug=loser["slug"],
                        to_victim_id=winner_id,
                        reason="deduplicated",
                    )

                    # Delete loser
                    await delete_victim(pool, loser_id)

                stats.victims_merged += 1
                stats.victims_deleted += 1

        log.info(f"\nProcessed {processed} groups")

    finally:
        await close_pool()

    return stats
