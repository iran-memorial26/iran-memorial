"""Victim matching — multi-stage matching with in-memory indexes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from ..db.models import ExternalVictim, MatchResult
from ..utils.farsi import normalize_farsi
from ..utils.latin import name_word_set, normalize_latin

# Thresholds
AUTO_THRESHOLD = 50
REVIEW_THRESHOLD = 30


@dataclass
class VictimIndex:
    """Pre-built indexes for fast victim matching."""

    by_id: dict[str, dict] = field(default_factory=dict)
    by_slug: dict[str, dict] = field(default_factory=dict)
    by_farsi_norm: dict[str, list[dict]] = field(default_factory=dict)
    by_latin_words: dict[frozenset, list[dict]] = field(default_factory=dict)
    by_date_province: dict[tuple, list[dict]] = field(default_factory=dict)
    source_urls: dict[str, set[str]] = field(default_factory=dict)
    # Reverse: url → victim_id
    url_to_victim: dict[str, str] = field(default_factory=dict)


def build_index(
    victims: list[dict], source_urls: dict[str, set[str]]
) -> VictimIndex:
    """Build in-memory indexes from DB victims (~1-2s for 31K)."""
    idx = VictimIndex()
    idx.source_urls = source_urls

    # Build reverse URL→victim map
    for vid, urls in source_urls.items():
        for url in urls:
            idx.url_to_victim[url] = vid

    for v in victims:
        vid = str(v["id"])
        idx.by_id[vid] = v
        idx.by_slug[v["slug"]] = v

        # Farsi normalized index
        farsi_norm = normalize_farsi(v.get("name_farsi"))
        if farsi_norm:
            idx.by_farsi_norm.setdefault(farsi_norm, []).append(v)

        # Latin word-set index
        words = name_word_set(v.get("name_latin"))
        if words:
            idx.by_latin_words.setdefault(words, []).append(v)

        # Date + province index (prefer canonical province from city relation)
        dod = v.get("date_of_death")
        prov_raw = v.get("effective_province") or v.get("province") or ""
        prov = prov_raw.lower().strip()
        if dod and prov:
            idx.by_date_province.setdefault((dod, prov), []).append(v)

    return idx


def match(ext: ExternalVictim, index: VictimIndex) -> MatchResult:
    """Match an ExternalVictim against the index using multi-stage strategy."""

    # Stage 1: Source URL match (100% confidence)
    # Only use URL match if victim name has overlap with external name
    # (prevents collection-page URLs like Wikipedia from false-matching)
    if ext.source_url and ext.source_url in index.url_to_victim:
        vid = index.url_to_victim[ext.source_url]
        victim = index.by_id.get(vid)
        if victim:
            ext_words = name_word_set(ext.name_latin)
            v_words = name_word_set(victim.get("name_latin"))
            if ext_words and v_words and (ext_words & v_words):
                return MatchResult(
                    matched=True,
                    victim_id=vid,
                    victim_slug=victim["slug"],
                    victim=victim,
                    score=100,
                    reasons=["source URL already linked + name overlap"],
                )

    # Stage 2: Exact normalized Farsi name + death date
    farsi_norm = normalize_farsi(ext.name_farsi)
    if farsi_norm and farsi_norm in index.by_farsi_norm:
        candidates = index.by_farsi_norm[farsi_norm]
        best = _score_candidates(ext, candidates)
        if best:
            return best

    # Stage 3: Normalized Latin name word-set + death date
    words = name_word_set(ext.name_latin)
    if words and words in index.by_latin_words:
        candidates = index.by_latin_words[words]
        best = _score_candidates(ext, candidates)
        if best:
            return best

    # Stage 4: Latin word-set partial match (subset/superset)
    if words:
        partial_candidates = []
        for key, vlist in index.by_latin_words.items():
            # At least 2 words overlap, and overlap is ≥ 70% of smaller set
            overlap = words & key
            min_len = min(len(words), len(key))
            if len(overlap) >= 2 and len(overlap) / min_len >= 0.7:
                partial_candidates.extend(vlist)
        if partial_candidates:
            best = _score_candidates(ext, partial_candidates)
            if best:
                return best

    # Stage 5: Date + province match (for name variations)
    if ext.date_of_death and ext.province:
        key = (ext.date_of_death, ext.province.lower().strip())
        if key in index.by_date_province:
            candidates = index.by_date_province[key]
            best = _score_candidates(ext, candidates, require_name_overlap=True)
            if best:
                return best

    # No match
    return MatchResult(matched=False, unmatched_name=ext.name_latin)


def _score_candidates(
    ext: ExternalVictim,
    candidates: list[dict],
    require_name_overlap: bool = False,
) -> Optional[MatchResult]:
    """Score candidates and return best match or None."""
    scored = []
    for v in candidates:
        score, reasons = _score_pair(ext, v)
        if require_name_overlap:
            # At least partial name match required
            ext_words = name_word_set(ext.name_latin)
            v_words = name_word_set(v.get("name_latin"))
            if not (ext_words & v_words):
                continue
        scored.append((score, reasons, v))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_reasons, best_victim = scored[0]

    if best_score >= AUTO_THRESHOLD:
        return MatchResult(
            matched=True,
            victim_id=str(best_victim["id"]),
            victim_slug=best_victim["slug"],
            victim=best_victim,
            score=best_score,
            reasons=best_reasons,
        )

    if best_score >= REVIEW_THRESHOLD:
        return MatchResult(
            ambiguous=True,
            score=best_score,
            reasons=best_reasons,
            candidates=[
                {"slug": v["slug"], "score": s, "reasons": r}
                for s, r, v in scored[:3]
            ],
        )

    return None


def _score_pair(ext: ExternalVictim, existing: dict) -> tuple[int, list[str]]:
    """Score how likely ext and existing are the same person."""
    score = 0
    reasons = []

    # Farsi name match
    ext_farsi = normalize_farsi(ext.name_farsi)
    db_farsi = normalize_farsi(existing.get("name_farsi"))
    if ext_farsi and db_farsi:
        if ext_farsi == db_farsi:
            score += 50
            reasons.append("farsi name match (+50)")
        else:
            score -= 10
            reasons.append("farsi name mismatch (-10)")

    # Death date — CRITICAL: different dates = different people
    ext_dod = ext.date_of_death
    db_dod = existing.get("date_of_death")
    if ext_dod and db_dod:
        diff = abs((ext_dod - db_dod).days)
        if diff == 0:
            score += 50
            reasons.append("death date match (+50)")
        elif diff <= 1:
            score += 40
            reasons.append("death date ±1 day (+40)")
        else:
            score -= 100
            reasons.append(f"DIFFERENT death dates (-100)")
    elif ext_dod or db_dod:
        score += 5
        reasons.append("one has date (+5)")

    # Province (prefer canonical province from city relation)
    ext_prov = (ext.province or "").lower().strip()
    db_prov = (existing.get("effective_province") or existing.get("province") or "").lower().strip()
    if ext_prov and db_prov:
        if ext_prov == db_prov:
            score += 20
            reasons.append("province match (+20)")
        else:
            score -= 20
            reasons.append("province mismatch (-20)")

    # Age
    if ext.age_at_death and existing.get("age_at_death"):
        diff = abs(ext.age_at_death - existing["age_at_death"])
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
    ext_pod = (ext.place_of_death or "").lower().strip()
    db_pod = (existing.get("place_of_death") or "").lower().strip()
    if ext_pod and db_pod and ext_pod == db_pod:
        score += 10
        reasons.append("place match (+10)")

    # Cause of death
    ext_cod = (ext.cause_of_death or "").lower().strip()
    db_cod = (existing.get("cause_of_death") or "").lower().strip()
    if ext_cod and db_cod and ext_cod == db_cod:
        score += 10
        reasons.append("cause match (+10)")

    return score, reasons
