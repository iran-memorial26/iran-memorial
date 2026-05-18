#!/usr/bin/env python3
"""
Deduplicate victim YAML files in the iran-memorial project.

Finds duplicate victims across year directories using:
  A) Same family name + similar first name (Levenshtein ≤ 2)
  B) Normalized full name match (transliteration variants)
  C) Cross-year slug match (same filename in different year dirs)

Scores candidates using death date, province, age, Farsi name.
Different death dates (both non-null) = NEVER merge.

Usage:
    python3 tools/dedup_victims.py              # Dry-run report
    python3 tools/dedup_victims.py --apply       # Merge duplicates
"""

import os
import re
import sys
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
VICTIMS_DIR = os.path.join(PROJECT_ROOT, "data", "victims")

APPLY = "--apply" in sys.argv

# Year directories to scan
YEAR_DIRS = []
for entry in sorted(os.listdir(VICTIMS_DIR)):
    path = os.path.join(VICTIMS_DIR, entry)
    if os.path.isdir(path):
        YEAR_DIRS.append(entry)


# ── Step 1: Load all YAML files via regex ──────────────────────────────────

def extract_field(content, field):
    """Extract a YAML field value via regex. Returns None for null/missing."""
    pattern = rf'^{field}:\s*(.+)$'
    m = re.search(pattern, content, re.MULTILINE)
    if not m:
        return None
    val = m.group(1).strip().strip('"').strip("'")
    if val == "null" or val == "~" or val == "":
        return None
    return val


def extract_sources(content):
    """Extract the full sources block as raw text."""
    m = re.search(r'^sources:\s*\n((?:\s+- .*\n(?:\s+\w.*\n)*)*)', content, re.MULTILINE)
    if m:
        return m.group(0).rstrip('\n')
    # fallback: grab from 'sources:' to next top-level key or EOF
    m = re.search(r'^(sources:.*?)(?=^\w|\Z)', content, re.MULTILINE | re.DOTALL)
    if m:
        return m.group(1).rstrip('\n')
    return None


def load_victim(filepath):
    """Load a single victim YAML file into a dict."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    return {
        'filepath': filepath,
        'filename': os.path.basename(filepath),
        'year_dir': os.path.basename(os.path.dirname(filepath)),
        'content': content,
        'id': extract_field(content, 'id'),
        'name_latin': extract_field(content, 'name_latin'),
        'name_farsi': extract_field(content, 'name_farsi'),
        'date_of_death': extract_field(content, 'date_of_death'),
        'place_of_death': extract_field(content, 'place_of_death'),
        'province': extract_field(content, 'province'),
        'age_at_death': extract_field(content, 'age_at_death'),
        'cause_of_death': extract_field(content, 'cause_of_death'),
        'circumstances': extract_field(content, 'circumstances'),
        'gender': extract_field(content, 'gender'),
        'status': extract_field(content, 'status'),
        'updated_by': extract_field(content, 'updated_by'),
        'sources_raw': extract_sources(content),
    }


def load_all_victims():
    """Load all YAML files from all year directories."""
    victims = []
    for year_dir in YEAR_DIRS:
        dir_path = os.path.join(VICTIMS_DIR, year_dir)
        for fname in os.listdir(dir_path):
            if fname.endswith('.yaml') and fname != '_template.yaml':
                filepath = os.path.join(dir_path, fname)
                v = load_victim(filepath)
                if v['name_latin']:
                    victims.append(v)
    return victims


# ── Step 2: Name normalization ─────────────────────────────────────────────

TRANSLITERATION_MAP = [
    # Order matters: longer patterns first
    ("mohammed", "muhammad"),
    ("mohammad", "muhammad"),
    ("hossein", "husayn"),
    ("hussein", "husayn"),
    ("hosein", "husayn"),
    ("husein", "husayn"),
    ("hosseini", "husayni"),
    ("husseini", "husayni"),
    ("abdol", "abd"),
    ("abdul", "abd"),
    ("abdal", "abd"),
    ("rasoul", "rasul"),
    ("kazem", "qasem"),  # not the same, but close transliteration issue
    ("ghasem", "qasem"),
    ("ghassem", "qasem"),
    ("qasem", "qasem"),
    ("fazi", "fazl"),
    ("fazl", "fazl"),
    ("seyyed", "seyed"),
    ("sayyid", "seyed"),
    ("sayyed", "seyed"),
    ("seied", "seyed"),
]

VOWEL_NORMALIZATIONS = [
    ("ou", "u"),
    ("oo", "u"),
    ("ee", "i"),
    ("ei", "ey"),
]


def normalize_name(name):
    """Normalize a Latin name for comparison."""
    if not name:
        return ""
    name = name.lower().strip()
    # Remove parenthetical content (aliases like "(Kian)")
    name = re.sub(r'\([^)]*\)', '', name).strip()
    # Remove diacritics-ish chars and punctuation
    name = re.sub(r'[\'"`\-.]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()

    # Apply transliteration normalization
    for pattern, replacement in TRANSLITERATION_MAP:
        name = name.replace(pattern, replacement)

    # Vowel normalizations
    for pattern, replacement in VOWEL_NORMALIZATIONS:
        name = name.replace(pattern, replacement)

    # Remove double letters
    name = re.sub(r'(.)\1', r'\1', name)

    return name.strip()


def name_parts(name):
    """Split a name into sorted parts for comparison."""
    return sorted(normalize_name(name).split())


def slug_family_name(filename):
    """Extract family name from slug (first part before hyphen)."""
    base = filename.replace('.yaml', '')
    parts = base.split('-')
    return parts[0] if parts else ""


def slug_without_birthyear(filename):
    """Remove trailing birth year from slug if present."""
    base = filename.replace('.yaml', '')
    # Pattern: name-parts-YYYY where YYYY is 4 digits at end
    m = re.match(r'^(.+)-(\d{4})$', base)
    if m:
        return m.group(1)
    return base


# ── Step 3: Levenshtein distance ───────────────────────────────────────────

def levenshtein(s1, s2):
    """Compute Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)

    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


# ── Step 4: Find candidate pairs ──────────────────────────────────────────

def find_candidates(victims):
    """Find duplicate candidate pairs using 3 strategies."""
    candidates = {}  # (filepath_a, filepath_b) -> reason

    # Index by family name (from slug)
    family_index = defaultdict(list)
    for v in victims:
        fam = slug_family_name(v['filename'])
        if fam:
            family_index[fam].append(v)

    # Index by normalized full name
    norm_index = defaultdict(list)
    for v in victims:
        norm = normalize_name(v['name_latin'])
        if norm:
            norm_index[norm].append(v)

    # Index by slug-without-birthyear
    slug_index = defaultdict(list)
    for v in victims:
        slug = slug_without_birthyear(v['filename'])
        if slug:
            slug_index[slug].append(v)

    # Strategy A: Same family name + similar given name(s)
    # Compare individual name parts (given names) for similarity
    def get_given_parts(v):
        """Get normalized given name parts (all except family name)."""
        name = v.get('name_latin', '')
        if not name:
            return []
        # Remove parenthetical aliases
        name = re.sub(r'\([^)]*\)', '', name).strip()
        parts = name.strip().split()
        if len(parts) >= 2:
            # Given names = all parts except last (family name)
            return [normalize_name(p) for p in parts[:-1] if p]
        return [normalize_name(parts[0])] if parts else []

    def given_names_similar(parts_a, parts_b):
        """Check if given name parts are similar enough to be the same person.
        Each part must match a part in the other list within Levenshtein ≤ 1.
        """
        if not parts_a or not parts_b:
            return False
        # Must have same number of parts (or off by one for optional middle names)
        if abs(len(parts_a) - len(parts_b)) > 1:
            return False
        # Match each part in the shorter list to closest in longer list
        shorter, longer = (parts_a, parts_b) if len(parts_a) <= len(parts_b) else (parts_b, parts_a)
        used = set()
        for sp in shorter:
            best_dist = 999
            best_j = -1
            for j, lp in enumerate(longer):
                if j in used:
                    continue
                d = levenshtein(sp, lp)
                if d < best_dist:
                    best_dist = d
                    best_j = j
            if best_dist > 1:
                return False
            # Also reject if the first char differs (prevents amir/omid type matches)
            if best_j >= 0 and sp and longer[best_j] and sp[0] != longer[best_j][0]:
                return False
            used.add(best_j)
        return True

    for fam, group in family_index.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                parts_a = get_given_parts(a)
                parts_b = get_given_parts(b)
                if given_names_similar(parts_a, parts_b):
                    key = tuple(sorted([a['filepath'], b['filepath']]))
                    candidates[key] = f"Strategy A: same family '{fam}', given names {parts_a} ~ {parts_b}"

    # Strategy B: Exact normalized name match
    for norm, group in norm_index.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                key = tuple(sorted([a['filepath'], b['filepath']]))
                if key not in candidates:
                    candidates[key] = f"Strategy B: normalized name match '{norm}'"

    # Strategy C: Cross-year slug match
    for slug, group in slug_index.items():
        if len(group) < 2:
            continue
        # Only if they're in different year directories
        years = set(v['year_dir'] for v in group)
        if len(years) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                if a['year_dir'] != b['year_dir']:
                    key = tuple(sorted([a['filepath'], b['filepath']]))
                    if key not in candidates:
                        candidates[key] = f"Strategy C: cross-year slug '{slug}'"

    return candidates


# ── Step 5: Score candidates ───────────────────────────────────────────────

def score_pair(a, b):
    """Score a candidate pair. Higher = more likely duplicate."""
    score = 0
    reasons = []

    # Farsi name match
    if a['name_farsi'] and b['name_farsi']:
        # Normalize Farsi: remove spaces and ZWNJ
        fa_a = re.sub(r'[\s\u200c]', '', a['name_farsi'])
        fa_b = re.sub(r'[\s\u200c]', '', b['name_farsi'])
        if fa_a == fa_b:
            score += 50
            reasons.append("same name_farsi (+50)")
        else:
            score -= 10
            reasons.append(f"different name_farsi (-10)")

    # Death date
    if a['date_of_death'] and b['date_of_death']:
        if a['date_of_death'] == b['date_of_death']:
            score += 50
            reasons.append("same death date (+50)")
        else:
            score -= 100
            reasons.append(f"DIFFERENT death dates: {a['date_of_death']} vs {b['date_of_death']} (-100)")
    elif a['date_of_death'] or b['date_of_death']:
        # One has date, one doesn't — slight positive (could be same person, incomplete data)
        score += 5
        reasons.append("one has death date, one doesn't (+5)")

    # Province
    if a['province'] and b['province']:
        if a['province'].lower() == b['province'].lower():
            score += 20
            reasons.append("same province (+20)")
        else:
            score -= 20
            reasons.append(f"different provinces: {a['province']} vs {b['province']} (-20)")

    # Age
    if a['age_at_death'] and b['age_at_death']:
        try:
            age_diff = abs(int(a['age_at_death']) - int(b['age_at_death']))
            if age_diff == 0:
                score += 15
                reasons.append("same age (+15)")
            elif age_diff <= 2:
                score += 5
                reasons.append(f"similar age (diff={age_diff}) (+5)")
            else:
                score -= 30
                reasons.append(f"different ages: {a['age_at_death']} vs {b['age_at_death']} (-30)")
        except ValueError:
            pass

    # Place of death (more specific than province)
    if a['place_of_death'] and b['place_of_death']:
        pod_a = a['place_of_death'].lower().strip()
        pod_b = b['place_of_death'].lower().strip()
        if pod_a == pod_b:
            score += 10
            reasons.append("same place_of_death (+10)")

    # Cause of death
    if a['cause_of_death'] and b['cause_of_death']:
        cod_a = a['cause_of_death'].lower().strip()
        cod_b = b['cause_of_death'].lower().strip()
        if cod_a == cod_b:
            score += 10
            reasons.append("same cause_of_death (+10)")

    return score, reasons


# ── Step 6: Merge logic ───────────────────────────────────────────────────

def count_fields(v):
    """Count non-null fields to determine which record is richer."""
    fields = ['name_farsi', 'date_of_death', 'place_of_death', 'province',
              'age_at_death', 'cause_of_death', 'circumstances', 'gender']
    return sum(1 for f in fields if v.get(f))


def source_priority(v):
    """Higher priority for manually curated or verified records."""
    if v.get('status') == 'verified':
        return 100
    updater = v.get('updated_by', '') or ''
    if 'iran-memorial' in updater or 'manual' in updater:
        return 50
    if 'hrana' in updater:
        return 30
    if 'wikipedia' in updater:
        return 20
    if 'iranvictims' in updater:
        return 10
    return 0


def pick_keeper(a, b):
    """Decide which file to keep. Returns (keeper, discard)."""
    # Prefer verified status
    prio_a = source_priority(a)
    prio_b = source_priority(b)
    if prio_a != prio_b:
        return (a, b) if prio_a > prio_b else (b, a)

    # Prefer more data
    count_a = count_fields(a)
    count_b = count_fields(b)
    if count_a != count_b:
        return (a, b) if count_a > count_b else (b, a)

    # Prefer earlier year directory (original import)
    if a['year_dir'] != b['year_dir']:
        return (a, b) if a['year_dir'] < b['year_dir'] else (b, a)

    # Default: keep first alphabetically
    return (a, b) if a['filepath'] <= b['filepath'] else (b, a)


def merge_field(keeper_content, keeper_val, discard_val, field_name):
    """Fill a null field in keeper from discard if available."""
    if keeper_val or not discard_val:
        return keeper_content  # keeper already has it, or discard doesn't

    # Find the null field line and replace with value from discard
    pattern = rf'^({field_name}:\s*)null\s*$'
    replacement = rf'\g<1>"{discard_val}"' if isinstance(discard_val, str) else rf'\g<1>{discard_val}'

    # Special handling for fields that shouldn't be quoted (age, date)
    if field_name in ('age_at_death', 'date_of_death'):
        replacement = rf'\g<1>{discard_val}'

    new_content = re.sub(pattern, replacement, keeper_content, count=1, flags=re.MULTILINE)
    return new_content


def merge_sources(keeper_content, discard):
    """Add sources from discard to keeper if not already present."""
    if not discard.get('sources_raw'):
        return keeper_content

    # Extract existing source URLs from keeper
    existing_urls = set(re.findall(r'url:\s*"([^"]+)"', keeper_content))

    # Extract source entries from discard
    discard_sources = discard['sources_raw']
    # Parse individual source blocks (each starts with "  - url:")
    source_blocks = re.findall(r'(  - url:.*?(?=  - url:|\Z))', discard_sources, re.DOTALL)

    new_blocks = []
    for block in source_blocks:
        url_m = re.search(r'url:\s*"([^"]+)"', block)
        if url_m and url_m.group(1) not in existing_urls:
            new_blocks.append(block.rstrip())

    if not new_blocks:
        return keeper_content

    # Insert before last_updated
    insertion = '\n'.join(new_blocks) + '\n'
    keeper_content = re.sub(
        r'^(last_updated:)',
        insertion + r'\1',
        keeper_content,
        count=1,
        flags=re.MULTILINE
    )
    return keeper_content


def do_merge(keeper, discard):
    """Merge data from discard into keeper, then delete discard file."""
    content = keeper['content']

    # Fill missing fields from discard
    for field in ['name_farsi', 'date_of_death', 'age_at_death', 'province',
                  'place_of_death', 'cause_of_death', 'gender']:
        content = merge_field(content, keeper.get(field), discard.get(field), field)

    # Merge sources
    content = merge_sources(content, discard)

    # Write updated keeper
    with open(keeper['filepath'], 'w', encoding='utf-8') as f:
        f.write(content)

    # Delete discard
    os.remove(discard['filepath'])

    return True


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("VICTIM DEDUPLICATION REPORT")
    print("=" * 70)

    # Load all victims
    print(f"\nLoading victims from: {VICTIMS_DIR}")
    victims = load_all_victims()
    print(f"Loaded {len(victims)} victims from {len(YEAR_DIRS)} year directories")

    # Build lookup by filepath
    by_path = {v['filepath']: v for v in victims}

    # Find candidates
    print("\nFinding duplicate candidates...")
    candidates = find_candidates(victims)
    print(f"Found {len(candidates)} candidate pairs")

    # Score candidates
    scored = []
    for (path_a, path_b), reason in candidates.items():
        a = by_path[path_a]
        b = by_path[path_b]
        score, score_reasons = score_pair(a, b)
        scored.append({
            'a': a,
            'b': b,
            'match_reason': reason,
            'score': score,
            'score_reasons': score_reasons,
        })

    # Sort by score descending
    scored.sort(key=lambda x: -x['score'])

    # Categorize
    high = [s for s in scored if s['score'] >= 50]
    medium = [s for s in scored if 30 <= s['score'] < 50]
    low = [s for s in scored if 0 <= s['score'] < 30]
    negative = [s for s in scored if s['score'] < 0]

    # Report
    print(f"\n{'─' * 70}")
    print(f"HIGH CONFIDENCE (score ≥ 50): {len(high)} pairs — auto-merge candidates")
    print(f"{'─' * 70}")
    for s in high:
        a, b = s['a'], s['b']
        keeper, discard = pick_keeper(a, b)
        print(f"\n  Score: {s['score']}")
        print(f"  Match: {s['match_reason']}")
        print(f"  KEEP:    {keeper['year_dir']}/{keeper['filename']}")
        print(f"           {keeper['name_latin']} | d:{keeper['date_of_death']} | {keeper['province']} | age:{keeper['age_at_death']}")
        print(f"  DELETE:  {discard['year_dir']}/{discard['filename']}")
        print(f"           {discard['name_latin']} | d:{discard['date_of_death']} | {discard['province']} | age:{discard['age_at_death']}")
        for r in s['score_reasons']:
            print(f"    → {r}")

    print(f"\n{'─' * 70}")
    print(f"MEDIUM CONFIDENCE (30-49): {len(medium)} pairs — manual review recommended")
    print(f"{'─' * 70}")
    for s in medium:
        a, b = s['a'], s['b']
        print(f"\n  Score: {s['score']}")
        print(f"  Match: {s['match_reason']}")
        print(f"  A: {a['year_dir']}/{a['filename']} — {a['name_latin']} | d:{a['date_of_death']} | {a['province']} | farsi:{a['name_farsi']}")
        print(f"  B: {b['year_dir']}/{b['filename']} — {b['name_latin']} | d:{b['date_of_death']} | {b['province']} | farsi:{b['name_farsi']}")
        for r in s['score_reasons']:
            print(f"    → {r}")

    print(f"\n{'─' * 70}")
    print(f"LOW / NEGATIVE (< 30): {len(low) + len(negative)} pairs — likely different people")
    print(f"{'─' * 70}")
    # Show a few examples
    for s in (low + negative)[:10]:
        a, b = s['a'], s['b']
        print(f"  Score {s['score']:>4}: {a['name_latin']:<35} vs {b['name_latin']:<35} | {s['match_reason'][:50]}")
    if len(low) + len(negative) > 10:
        print(f"  ... and {len(low) + len(negative) - 10} more")

    # Summary
    print(f"\n{'=' * 70}")
    print(f"SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Total victims:           {len(victims)}")
    print(f"  Candidate pairs found:   {len(candidates)}")
    print(f"  HIGH confidence (≥50):   {len(high)}")
    print(f"  MEDIUM confidence:       {len(medium)}")
    print(f"  LOW/NEGATIVE:            {len(low) + len(negative)}")

    # Build clusters using Union-Find for HIGH confidence pairs
    parent = {}

    def find(x):
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent[x], parent[x])
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[rx] = ry

    for s in high:
        union(s['a']['filepath'], s['b']['filepath'])

    # Group into clusters
    clusters = defaultdict(set)
    all_paths_in_high = set()
    for s in high:
        all_paths_in_high.add(s['a']['filepath'])
        all_paths_in_high.add(s['b']['filepath'])
    for p in all_paths_in_high:
        clusters[find(p)].add(p)

    # Pick keeper per cluster
    cluster_plans = []
    for root, members in clusters.items():
        member_victims = [by_path[p] for p in members]
        # Sort by priority: verified > more fields > earlier year
        member_victims.sort(key=lambda v: (-source_priority(v), -count_fields(v), v['year_dir']))
        keeper = member_victims[0]
        discards = member_victims[1:]
        cluster_plans.append((keeper, discards))

    total_discards = sum(len(ds) for _, ds in cluster_plans)

    print(f"\n  Clusters: {len(cluster_plans)} (from {len(high)} pairs)")
    print(f"  Files to remove: {total_discards}")

    # Apply merges
    if APPLY and cluster_plans:
        print(f"\n{'=' * 70}")
        print(f"APPLYING MERGES ({len(cluster_plans)} clusters)")
        print(f"{'=' * 70}")

        merged = 0
        errors = 0
        for keeper, discards in cluster_plans:
            for discard in discards:
                try:
                    # Re-read keeper content since it may have been updated by previous merge
                    with open(keeper['filepath'], 'r', encoding='utf-8') as f:
                        keeper['content'] = f.read()
                    do_merge(keeper, discard)
                    merged += 1
                    rel_keeper = os.path.relpath(keeper['filepath'], VICTIMS_DIR)
                    rel_discard = os.path.relpath(discard['filepath'], VICTIMS_DIR)
                    print(f"  MERGED: {rel_discard} → {rel_keeper}")
                except Exception as e:
                    errors += 1
                    print(f"  ERROR merging {discard['filename']}: {e}")

        print(f"\n  Clusters processed: {len(cluster_plans)}")
        print(f"  Files merged+deleted: {merged}")
        print(f"  Errors: {errors}")

        # Verify count
        remaining = sum(1 for yd in YEAR_DIRS
                        for f in os.listdir(os.path.join(VICTIMS_DIR, yd))
                        if f.endswith('.yaml') and f != '_template.yaml')
        print(f"  Remaining victims: {remaining}")
    elif APPLY:
        print("\n  No HIGH confidence pairs to merge.")
    else:
        if cluster_plans:
            print(f"\n  Run with --apply to merge {total_discards} duplicate files into {len(cluster_plans)} clusters.")
        print(f"  MEDIUM confidence pairs should be reviewed manually.")


if __name__ == "__main__":
    main()
