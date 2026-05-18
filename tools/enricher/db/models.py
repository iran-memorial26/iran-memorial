"""Data models for the enrichment pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class ExternalVictim:
    """Normalized victim record from an external source."""

    source_id: str
    source_name: str
    source_url: str
    source_type: str

    # Identity
    name_latin: Optional[str] = None
    name_farsi: Optional[str] = None
    aliases: list[str] = field(default_factory=list)
    date_of_birth: Optional[date] = None
    place_of_birth: Optional[str] = None
    gender: Optional[str] = None
    religion: Optional[str] = None
    photo_url: Optional[str] = None

    # Life
    occupation: Optional[str] = None
    education: Optional[str] = None

    # Death
    date_of_death: Optional[date] = None
    age_at_death: Optional[int] = None
    place_of_death: Optional[str] = None
    province: Optional[str] = None
    cause_of_death: Optional[str] = None
    circumstances_en: Optional[str] = None
    circumstances_fa: Optional[str] = None
    event_context: Optional[str] = None
    responsible_forces: Optional[str] = None


@dataclass
class MatchResult:
    """Result of matching an ExternalVictim against the database."""

    matched: bool = False
    ambiguous: bool = False
    victim_id: Optional[str] = None
    victim_slug: Optional[str] = None
    victim: Optional[dict] = None
    score: int = 0
    reasons: list[str] = field(default_factory=list)
    candidates: list[dict] = field(default_factory=list)
    unmatched_name: Optional[str] = None


@dataclass
class ExternalPhoto:
    """Photo from an external source."""

    victim_id: str
    url: str
    source_credit: Optional[str] = None
    photo_type: str = "portrait"


@dataclass
class RunStats:
    """Statistics for an enrichment run."""

    processed: int = 0
    matched: int = 0
    enriched: int = 0
    no_new_data: int = 0
    unmatched: int = 0
    new_imported: int = 0
    ambiguous: int = 0
    sources_added: int = 0
    photos_added: int = 0
    fields_updated: int = 0
    errors: int = 0


@dataclass
class DedupStats:
    """Statistics for a deduplication run."""

    groups_found: int = 0
    auto_merge: int = 0
    review: int = 0
    skipped: int = 0
    victims_merged: int = 0
    sources_migrated: int = 0
    photos_migrated: int = 0
    victims_deleted: int = 0
