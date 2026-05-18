#!/usr/bin/env python3
"""
Find and merge internal duplicates within data/victims/2026/.

Groups YAML files by normalized Farsi name (name_farsi). For each group
with 2+ files, scores records by completeness and source count, keeps
the richest file as the "winner," merges any unique data from the
losers into the winner, then deletes the losers.

Usage:
    python3 tools/dedup_2026_internal.py              # Dry-run report
    python3 tools/dedup_2026_internal.py --dry-run    # Same as above
    python3 tools/dedup_2026_internal.py --apply       # Actually merge + delete
"""

import argparse
import os
import re
import sys
import unicodedata
from collections import defaultdict

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
VICTIMS_2026 = os.path.join(PROJECT_ROOT, "data", "victims", "2026")

# ── Farsi name normalization ─────────────────────────────────────────────

# Unicode categories for Arabic/Farsi diacritics (tashkeel, etc.)
ARABIC_DIACRITICS = re.compile(
    "[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4"
    "\u06E7-\u06E8\u06EA-\u06ED\uFE70-\uFE7F]"
)

# Zero-width characters commonly found in Farsi text
ZERO_WIDTH = re.compile("[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]")

# ZWNJ (Zero-Width Non-Joiner) — common in Farsi compound words
ZWNJ = "\u200c"


def normalize_farsi_name(name):
    """Normalize a Farsi name for grouping.

    Steps:
    1. Strip leading/trailing whitespace
    2. Remove Arabic diacritics (tashkeel)
    3. Remove ZWNJ, zero-width chars
    4. Remove all whitespace
    5. Normalize Unicode (NFC)
    6. Map common letter variants (ي→ی, ك→ک, ة→ه, أ/إ/آ→ا)

    Returns a canonical string suitable as a grouping key.
    """
    if not name:
        return ""

    s = name.strip()

    # Unicode NFC normalization first
    s = unicodedata.normalize("NFC", s)

    # Remove Arabic diacritics
    s = ARABIC_DIACRITICS.sub("", s)

    # Remove ZWNJ and other zero-width chars
    s = s.replace(ZWNJ, "")
    s = ZERO_WIDTH.sub("", s)

    # Map common letter variants
    # Arabic Yeh ي (U+064A) → Farsi Yeh ی (U+06CC)
    s = s.replace("\u064a", "\u06cc")
    # Arabic Kaf ك (U+0643) → Farsi Kaf ک (U+06A9)
    s = s.replace("\u0643", "\u06a9")
    # Arabic Teh Marbuta ة (U+0629) → Heh ه (U+0647)
    s = s.replace("\u0629", "\u0647")
    # Alef variants: أ إ آ → ا
    s = s.replace("\u0623", "\u0627")  # أ → ا
    s = s.replace("\u0625", "\u0627")  # إ → ا
    s = s.replace("\u0622", "\u0627")  # آ → ا

    # Remove all whitespace
    s = re.sub(r"\s+", "", s)

    return s


# ── YAML loading ─────────────────────────────────────────────────────────

def load_yaml_file(filepath):
    """Load a YAML file and return (data_dict, raw_text)."""
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as e:
        print(f"  WARNING: YAML parse error in {filepath}: {e}", file=sys.stderr)
        return None, raw
    if not isinstance(data, dict):
        return None, raw
    return data, raw


def load_all_2026():
    """Load all YAML files from data/victims/2026/. Returns list of dicts."""
    records = []
    if not os.path.isdir(VICTIMS_2026):
        print(f"ERROR: Directory not found: {VICTIMS_2026}", file=sys.stderr)
        sys.exit(1)

    for fname in sorted(os.listdir(VICTIMS_2026)):
        if not fname.endswith(".yaml") or fname.startswith("_"):
            continue
        filepath = os.path.join(VICTIMS_2026, fname)
        data, raw = load_yaml_file(filepath)
        if data is None:
            continue
        records.append({
            "filepath": filepath,
            "filename": fname,
            "data": data,
        })
    return records


# ── Scoring ──────────────────────────────────────────────────────────────

# Fields that contribute +1 each when non-null
SCORED_FIELDS = [
    "date_of_death",
    "age_at_death",
    "place_of_death",
    "province",
    "cause_of_death",
    "circumstances",
    "photo",
    "occupation",
    "education",
    "family",
]


def is_non_null(value):
    """Check if a YAML value counts as non-null / non-empty."""
    if value is None:
        return False
    if isinstance(value, str) and value.strip() == "":
        return False
    if isinstance(value, dict):
        # A dict like family: {marital_status: "", children: null, notes: ""}
        # counts as non-null only if at least one sub-value is non-null
        return any(is_non_null(v) for v in value.values())
    if isinstance(value, list) and len(value) == 0:
        return False
    return True


def count_sources(data):
    """Count the number of source entries."""
    sources = data.get("sources")
    if not sources or not isinstance(sources, list):
        return 0
    return len(sources)


def score_record(data):
    """Score a record by completeness. Higher = richer data."""
    score = 0
    for field in SCORED_FIELDS:
        if is_non_null(data.get(field)):
            score += 1
    score += count_sources(data)
    return score


# ── Merging ──────────────────────────────────────────────────────────────

def get_source_urls(data):
    """Extract set of source URLs from a record."""
    sources = data.get("sources")
    if not sources or not isinstance(sources, list):
        return set()
    urls = set()
    for s in sources:
        if isinstance(s, dict) and s.get("url"):
            urls.add(s["url"].strip())
    return urls


def is_text_subset(shorter, longer):
    """Check if shorter text is essentially contained within longer text.

    Uses sentence-level comparison: if every sentence from the shorter
    text appears (as a substring) in the longer text, it's a subset.
    """
    if not shorter or not longer:
        return True

    # Normalize whitespace
    shorter_norm = re.sub(r"\s+", " ", shorter.strip())
    longer_norm = re.sub(r"\s+", " ", longer.strip())

    # If shorter is literally a substring
    if shorter_norm in longer_norm:
        return True

    # Sentence-level check: split by period/newline, check each sentence
    sentences = re.split(r"[.\n]+", shorter_norm)
    sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 10]

    if not sentences:
        return True

    for sentence in sentences:
        if sentence not in longer_norm:
            return False
    return True


def merge_into_winner(winner_data, loser_data):
    """Merge non-null fields and unique sources from loser into winner.

    Modifies winner_data in place. Returns list of merge actions taken.
    """
    actions = []

    # Merge simple fields: fill null in winner from non-null in loser
    mergeable_fields = [
        "date_of_birth", "place_of_birth", "gender", "ethnicity", "religion",
        "photo", "date_of_death", "age_at_death", "place_of_death", "province",
        "cause_of_death", "event_context", "responsible_forces",
        "occupation", "education", "aliases",
        "status",
    ]

    for field in mergeable_fields:
        winner_val = winner_data.get(field)
        loser_val = loser_data.get(field)
        if not is_non_null(winner_val) and is_non_null(loser_val):
            winner_data[field] = loser_val
            actions.append(f"  filled {field} from loser")

    # Merge family (dict): fill individual sub-fields
    winner_family = winner_data.get("family")
    loser_family = loser_data.get("family")
    if isinstance(loser_family, dict):
        if not isinstance(winner_family, dict):
            winner_family = {}
            winner_data["family"] = winner_family
        for k, v in loser_family.items():
            if is_non_null(v) and not is_non_null(winner_family.get(k)):
                winner_family[k] = v
                actions.append(f"  filled family.{k} from loser")

    # Merge circumstances: append if genuinely new info
    winner_circ = winner_data.get("circumstances") or ""
    loser_circ = loser_data.get("circumstances") or ""
    if (
        isinstance(winner_circ, str)
        and isinstance(loser_circ, str)
        and winner_circ.strip()
        and loser_circ.strip()
        and winner_circ.strip() != loser_circ.strip()
    ):
        # Only append if loser text is NOT a subset of winner text
        if not is_text_subset(loser_circ, winner_circ):
            combined = winner_circ.strip() + "\n" + loser_circ.strip()
            winner_data["circumstances"] = combined
            actions.append("  appended circumstances from loser (new info)")
    elif not winner_circ.strip() and loser_circ.strip():
        winner_data["circumstances"] = loser_circ
        actions.append("  filled circumstances from loser")

    # Merge sources: add any source URLs not already in winner
    winner_urls = get_source_urls(winner_data)
    loser_sources = loser_data.get("sources") or []
    if isinstance(loser_sources, list):
        winner_sources = winner_data.get("sources")
        if not isinstance(winner_sources, list):
            winner_sources = []
            winner_data["sources"] = winner_sources

        added = 0
        for src in loser_sources:
            if isinstance(src, dict) and src.get("url"):
                url = src["url"].strip()
                if url not in winner_urls:
                    winner_sources.append(src)
                    winner_urls.add(url)
                    added += 1
        if added:
            actions.append(f"  added {added} source(s) from loser")

    # Update last_updated to today
    from datetime import date
    winner_data["last_updated"] = date.today().isoformat()

    return actions


def write_yaml(filepath, data):
    """Write data dict back to YAML file, preserving field order."""
    # Define the canonical field order matching the template
    field_order = [
        "id", "name_latin", "name_farsi", "aliases",
        "date_of_birth", "place_of_birth", "gender", "ethnicity", "religion", "photo",
        "occupation", "education", "family",
        "dreams", "beliefs", "personality", "quotes",
        "date_of_death", "age_at_death", "place_of_death", "province",
        "cause_of_death", "circumstances", "event_context", "responsible_forces",
        "witnesses", "last_seen",
        "burial", "family_persecution", "legal_proceedings", "tributes",
        "status", "sources", "last_updated", "updated_by",
    ]

    # Build ordered list of (key, value) pairs
    ordered = []
    seen = set()
    for key in field_order:
        if key in data:
            ordered.append((key, data[key]))
            seen.add(key)
    # Append any extra keys not in the canonical order
    for key in data:
        if key not in seen:
            ordered.append((key, data[key]))

    # Custom YAML dumping to match project style
    lines = []
    for key, value in ordered:
        lines.extend(_format_yaml_field(key, value, indent=0))

    content = "\n".join(lines) + "\n"
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)


def _format_yaml_field(key, value, indent=0):
    """Format a single YAML key-value pair into lines."""
    prefix = "  " * indent

    if value is None:
        return [f"{prefix}{key}: null"]

    if isinstance(value, bool):
        return [f"{prefix}{key}: {'true' if value else 'false'}"]

    if isinstance(value, int):
        return [f"{prefix}{key}: {value}"]

    if isinstance(value, float):
        return [f"{prefix}{key}: {value}"]

    if isinstance(value, str):
        # Multi-line strings: use > (folded block scalar)
        if "\n" in value:
            result = [f"{prefix}{key}: >"]
            for line in value.split("\n"):
                if line.strip():
                    result.append(f"{prefix}    {line.strip()}")
                else:
                    result.append("")
            return result
        # Strings that need quoting
        if _needs_quoting(value):
            escaped = value.replace('"', '\\"')
            return [f'{prefix}{key}: "{escaped}"']
        return [f'{prefix}{key}: "{value}"']

    if isinstance(value, list):
        if len(value) == 0:
            return [f"{prefix}{key}: []"]
        # Check if list of dicts (like sources)
        if isinstance(value[0], dict):
            result = [f"{prefix}{key}:"]
            for item in value:
                first = True
                for k, v in item.items():
                    if first:
                        if v is None:
                            result.append(f"{prefix}  - {k}: null")
                        elif isinstance(v, str):
                            if _needs_quoting(v):
                                escaped = v.replace('"', '\\"')
                                result.append(f'{prefix}  - {k}: "{escaped}"')
                            else:
                                result.append(f'{prefix}  - {k}: "{v}"')
                        else:
                            result.append(f"{prefix}  - {k}: {v}")
                        first = False
                    else:
                        if v is None:
                            result.append(f"{prefix}    {k}: null")
                        elif isinstance(v, str):
                            if _needs_quoting(v):
                                escaped = v.replace('"', '\\"')
                                result.append(f'{prefix}    {k}: "{escaped}"')
                            else:
                                result.append(f'{prefix}    {k}: "{v}"')
                        else:
                            result.append(f"{prefix}    {k}: {v}")
            return result
        # List of scalars
        if all(isinstance(v, str) for v in value):
            if len(value) <= 3 and all(len(v) < 40 for v in value):
                # Inline short lists
                items = ", ".join(f'"{v}"' for v in value)
                return [f"{prefix}{key}: [{items}]"]
            result = [f"{prefix}{key}:"]
            for v in value:
                result.append(f'{prefix}  - "{v}"')
            return result
        result = [f"{prefix}{key}:"]
        for v in value:
            result.append(f"{prefix}  - {v}")
        return result

    if isinstance(value, dict):
        result = [f"{prefix}{key}:"]
        for k, v in value.items():
            result.extend(_format_yaml_field(k, v, indent=indent + 1))
        return result

    # Date objects from YAML parsing
    if hasattr(value, "isoformat"):
        return [f"{prefix}{key}: {value.isoformat()}"]

    return [f"{prefix}{key}: {value}"]


def _needs_quoting(s):
    """Check if a YAML string value needs quoting."""
    if not s:
        return True
    # Strings starting with special YAML chars
    if s[0] in ("{", "[", "*", "&", "!", "|", ">", "'", '"', "%", "@", "`"):
        return True
    # Strings that look like non-string types
    if s.lower() in ("true", "false", "yes", "no", "null", "~"):
        return True
    # Strings containing : followed by space, or # preceded by space
    if ": " in s or " #" in s:
        return True
    # Strings with commas or special chars
    if any(c in s for c in (",", "{", "}", "[", "]")):
        return True
    return False


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Find and merge internal duplicates within data/victims/2026/"
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Report only, don't modify files (default)",
    )
    group.add_argument(
        "--apply",
        action="store_true",
        help="Actually merge winners and delete losers",
    )
    args = parser.parse_args()

    dry_run = not args.apply

    print("=" * 70)
    print("2026 INTERNAL DEDUPLICATION" + (" (DRY RUN)" if dry_run else " (APPLYING)"))
    print("=" * 70)

    # Load all 2026 YAML files
    records = load_all_2026()
    print(f"\nLoaded {len(records)} YAML files from {VICTIMS_2026}")

    # Group by normalized Farsi name
    farsi_groups = defaultdict(list)
    no_farsi = 0
    for rec in records:
        name_farsi = rec["data"].get("name_farsi")
        if not name_farsi or not isinstance(name_farsi, str) or not name_farsi.strip():
            no_farsi += 1
            continue
        key = normalize_farsi_name(name_farsi)
        if not key:
            no_farsi += 1
            continue
        farsi_groups[key].append(rec)

    print(f"Records with Farsi name: {len(records) - no_farsi}")
    print(f"Records without Farsi name (skipped): {no_farsi}")
    print(f"Unique normalized Farsi names: {len(farsi_groups)}")

    # Find groups with 2+ files
    dup_groups = {k: v for k, v in farsi_groups.items() if len(v) >= 2}
    print(f"Duplicate groups (2+ files with same Farsi name): {len(dup_groups)}")

    if not dup_groups:
        print("\nNo duplicates found. Nothing to do.")
        return

    # Process each duplicate group
    total_files_merged = 0
    total_files_deleted = 0
    merge_details = []

    print(f"\n{'─' * 70}")
    print("DUPLICATE GROUPS")
    print(f"{'─' * 70}")

    for i, (norm_key, group) in enumerate(sorted(dup_groups.items()), 1):
        # Score each file
        scored = []
        for rec in group:
            s = score_record(rec["data"])
            scored.append((s, rec))

        # Sort by score descending (highest = winner)
        scored.sort(key=lambda x: -x[0])

        winner_score, winner = scored[0]
        losers = [(s, r) for s, r in scored[1:]]

        winner_farsi = winner["data"].get("name_farsi", "")
        winner_latin = winner["data"].get("name_latin", "")

        print(f"\n  Group {i}: {winner_farsi}  ({winner_latin})")
        print(f"    Files: {len(group)}")
        print(f"    Winner: {winner['filename']} (score={winner_score})")
        for ls, loser in losers:
            print(f"    Loser:  {loser['filename']} (score={ls})")

        # Show what would be merged
        actions_preview = []
        for _, loser in losers:
            # Preview merge actions without modifying data
            preview_data = dict(winner["data"])  # shallow copy for preview
            preview_data["sources"] = list(winner["data"].get("sources") or [])
            acts = merge_into_winner(preview_data, loser["data"])
            if acts:
                actions_preview.extend(acts)

        if actions_preview:
            print("    Merge actions:")
            for act in actions_preview:
                print(f"      {act}")
        else:
            print("    Merge actions: (loser has no unique data)")

        merge_details.append({
            "group_num": i,
            "norm_key": norm_key,
            "winner": winner,
            "losers": losers,
        })

    # Apply or report
    print(f"\n{'=' * 70}")
    if dry_run:
        total_to_delete = sum(len(d["losers"]) for d in merge_details)
        print(f"DRY RUN SUMMARY")
        print(f"{'=' * 70}")
        print(f"  Duplicate groups found:  {len(dup_groups)}")
        print(f"  Files that would be merged into winners: {total_to_delete}")
        print(f"  Files that would be deleted: {total_to_delete}")
        print(f"\n  Run with --apply to perform the merge.")
    else:
        print(f"APPLYING MERGES")
        print(f"{'=' * 70}")

        errors = 0
        for detail in merge_details:
            winner = detail["winner"]

            # Re-read winner data fresh (in case previous iteration modified it)
            winner_data, _ = load_yaml_file(winner["filepath"])
            if winner_data is None:
                print(f"  ERROR: Could not re-read {winner['filename']}")
                errors += 1
                continue

            all_actions = []
            for _, loser in detail["losers"]:
                loser_data, _ = load_yaml_file(loser["filepath"])
                if loser_data is None:
                    print(f"  ERROR: Could not re-read {loser['filename']}")
                    errors += 1
                    continue

                actions = merge_into_winner(winner_data, loser_data)
                all_actions.extend(actions)

                # Delete loser file
                os.remove(loser["filepath"])
                total_files_deleted += 1
                print(f"  DELETED: {loser['filename']}")

            # Write updated winner
            write_yaml(winner["filepath"], winner_data)
            total_files_merged += 1
            if all_actions:
                print(f"  UPDATED: {winner['filename']} ({len(all_actions)} merge actions)")
            else:
                print(f"  UPDATED: {winner['filename']} (no new data from losers)")

        print(f"\n{'─' * 70}")
        print(f"MERGE SUMMARY")
        print(f"{'─' * 70}")
        print(f"  Groups processed:   {len(merge_details)}")
        print(f"  Winners updated:    {total_files_merged}")
        print(f"  Losers deleted:     {total_files_deleted}")
        print(f"  Errors:             {errors}")

        # Count remaining files
        remaining = sum(
            1 for f in os.listdir(VICTIMS_2026)
            if f.endswith(".yaml") and not f.startswith("_")
        )
        print(f"  Remaining 2026 files: {remaining}")


if __name__ == "__main__":
    main()
