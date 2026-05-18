"""Field-level enrichment logic — only fill NULL fields, never overwrite."""

from __future__ import annotations

from typing import Any, Optional

from ..db.models import ExternalVictim


def compute_enrichment(
    victim: dict, ext: ExternalVictim
) -> Optional[tuple[Any, ...]]:
    """Compute the DB update tuple if there's anything to enrich.

    Returns a tuple matching the ENRICH_VICTIM query parameters, or None.
    The COALESCE in the SQL ensures we never overwrite existing data.
    """
    # Check if there's ANY new data to contribute
    new_data = False

    fields = [
        ("name_farsi", ext.name_farsi),
        ("date_of_birth", ext.date_of_birth),
        ("place_of_birth", ext.place_of_birth),
        ("gender", ext.gender),
        ("religion", ext.religion),
        ("photo_url", ext.photo_url),
        ("occupation_en", ext.occupation),
        ("education", ext.education),
        ("age_at_death", ext.age_at_death),
        ("place_of_death", ext.place_of_death),
        ("province", ext.province),
        ("cause_of_death", ext.cause_of_death),
        ("circumstances_en", ext.circumstances_en),
        ("circumstances_fa", ext.circumstances_fa),
        ("event_context", ext.event_context),
        ("responsible_forces", ext.responsible_forces),
    ]

    for db_col, ext_val in fields:
        if ext_val is None:
            continue
        db_val = victim.get(db_col)

        # Field is empty in DB → we have new data
        if db_val is None or (isinstance(db_val, str) and not db_val.strip()):
            new_data = True
            break

        # Special: gender "unknown" can be replaced
        if db_col == "gender" and db_val == "unknown" and ext_val:
            new_data = True
            break

        # Special: circumstances — replace if ext is significantly longer
        if db_col == "circumstances_en" and ext_val and db_val:
            if len(ext_val) > len(db_val) * 1.5:
                new_data = True
                break

    if not new_data:
        return None

    # Build update tuple: (victim_id, field1, field2, ...)
    # The COALESCE in SQL handles the "only fill NULL" logic
    return (
        victim["id"],
        ext.name_farsi,
        ext.date_of_birth,
        ext.place_of_birth,
        ext.gender,
        ext.religion,
        ext.photo_url,
        ext.occupation,
        ext.education,
        ext.age_at_death,
        ext.place_of_death,
        ext.province,
        ext.cause_of_death,
        ext.circumstances_en,
        ext.circumstances_fa,
        ext.event_context,
        ext.responsible_forces,
    )


def count_new_fields(victim: dict, ext: ExternalVictim) -> int:
    """Count how many NULL fields would be filled."""
    count = 0
    fields = [
        ("name_farsi", ext.name_farsi),
        ("date_of_birth", ext.date_of_birth),
        ("place_of_birth", ext.place_of_birth),
        ("gender", ext.gender),
        ("religion", ext.religion),
        ("photo_url", ext.photo_url),
        ("occupation_en", ext.occupation),
        ("education", ext.education),
        ("age_at_death", ext.age_at_death),
        ("place_of_death", ext.place_of_death),
        ("province", ext.province),
        ("cause_of_death", ext.cause_of_death),
        ("circumstances_en", ext.circumstances_en),
        ("circumstances_fa", ext.circumstances_fa),
        ("event_context", ext.event_context),
        ("responsible_forces", ext.responsible_forces),
    ]

    for db_col, ext_val in fields:
        if ext_val is None:
            continue
        db_val = victim.get(db_col)
        if db_val is None or (isinstance(db_val, str) and not db_val.strip()):
            count += 1
        elif db_col == "gender" and db_val == "unknown":
            count += 1
    return count
