#!/usr/bin/env python3
"""
Duplicate check tool for new victim entries.

Usage:
  python3 tools/check-duplicates.py tools/data/new-victims.csv

Input CSV columns (required: name_latin):
  card_id, name_latin, name_farsi, age, location, date_of_death, source_urls, notes

Output:
  new-victims-checked.csv  with extra columns:
    decision:        IMPORT | POSSIBLE_DUPLICATE | PROBABLE_DUPLICATE | DEFINITE_DUPLICATE
    match_score:     0.000 – 1.000
    matched_db_name, matched_db_farsi, matched_db_slug
"""

import sys
import csv
import re
import os
import difflib
from pathlib import Path

try:
    import psycopg2
except ImportError:
    sys.exit("Error: psycopg2 not installed. Run: pip install psycopg2-binary")

# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

# Transliteration groups: [canonical, variant1, variant2, ...]
_TRANSLIT_GROUPS = [
    ["mohammad", "muhammad", "mohammed", "mohamad", "mohammadi"],
    ["hossein", "hosein", "hussain", "husain", "husayn", "hüseyin"],
    ["ali", "aly"],
    ["reza", "rida", "ridha"],
    ["hassan", "hasan"],
    ["ebrahim", "ibrahim", "ebraheem"],
    ["mehdi", "mahdi"],
    ["morteza", "mortaza", "murtaza"],
    ["fatemeh", "fateme", "fatima", "fatime"],
    ["zeynab", "zainab", "zaynab"],
    ["ahmad", "ahmed"],
    ["yahya", "yahia"],
    ["yousef", "yousuf", "yusef", "yusuf"],
    ["amin", "ameen"],
    ["amir", "ameer"],
    ["sajad", "sajjad"],
    ["masoud", "masud", "masood"],
    ["hamid", "hamed"],
]

TRANSLIT_MAP: dict[str, str] = {}
for group in _TRANSLIT_GROUPS:
    canonical = group[0]
    for variant in group:
        TRANSLIT_MAP[variant] = canonical

_DIACRITICS = [
    ("àáâãäå", "a"), ("èéêë", "e"), ("ìíîï", "i"),
    ("òóôõö", "o"), ("ùúûü", "u"), ("ñ", "n"), ("ç", "c"),
    ("ā", "a"), ("ē", "e"), ("ī", "i"), ("ō", "o"), ("ū", "u"),
]


def normalize(name: str) -> str:
    """Normalize a Latin name for fuzzy comparison."""
    if not name:
        return ""
    s = name.lower().strip()
    for chars, replacement in _DIACRITICS:
        for c in chars:
            s = s.replace(c, replacement)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    words = [TRANSLIT_MAP.get(w, w) for w in s.split() if w]
    return " ".join(words)


def score_pair(n1_latin: str, n1_farsi: str, n2_latin: str, n2_farsi: str) -> float:
    """Score how well two victim entries match. Returns 0.0 – 1.0."""
    scores: list[float] = []

    a, b = normalize(n1_latin), normalize(n2_latin)
    if a and b:
        scores.append(difflib.SequenceMatcher(None, a, b).ratio())

    # Farsi is highly reliable — boost slightly
    if n1_farsi and n2_farsi:
        fa = difflib.SequenceMatcher(None, n1_farsi.strip(), n2_farsi.strip()).ratio()
        scores.append(min(1.0, fa * 1.1))

    return max(scores) if scores else 0.0


def classify(score: float) -> str:
    if score >= 0.97:
        return "DEFINITE_DUPLICATE"
    if score >= 0.90:
        return "PROBABLE_DUPLICATE"
    if score >= 0.82:
        return "POSSIBLE_DUPLICATE"
    return "IMPORT"


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------


def connect():
    url = os.environ.get("DATABASE_URL")
    if url:
        return psycopg2.connect(url)
    return psycopg2.connect(
        host="localhost",
        port=5432,
        database="iran_memorial",
        user=os.environ.get("USER", "Pedi"),
    )


def load_db_victims(conn) -> list[dict]:
    cur = conn.cursor()
    cur.execute("SELECT slug, name_latin, name_farsi FROM victims ORDER BY name_latin")
    victims = [
        {"slug": r[0], "name_latin": r[1] or "", "name_farsi": r[2] or ""}
        for r in cur.fetchall()
    ]
    cur.close()
    return victims


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    inp = sys.argv[1]
    if not os.path.exists(inp):
        sys.exit(f"File not found: {inp}")

    p = Path(inp)
    out = str(p.parent / (p.stem + "-checked.csv"))

    print("Connecting to DB...")
    conn = connect()
    db = load_db_victims(conn)
    conn.close()
    print(f"Loaded {len(db):,} victims from DB")

    with open(inp, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"Processing {len(rows)} input entries...")

    results = []
    for i, row in enumerate(rows, 1):
        nl = row.get("name_latin", "")
        nf = row.get("name_farsi", "")

        best_score, best = 0.0, None
        for v in db:
            s = score_pair(nl, nf, v["name_latin"], v["name_farsi"])
            if s > best_score:
                best_score, best = s, v

        decision = classify(best_score)
        result = {"decision": decision, "match_score": f"{best_score:.3f}"}
        result.update(row)
        result["matched_db_name"] = best["name_latin"] if best else ""
        result["matched_db_farsi"] = best["name_farsi"] if best else ""
        result["matched_db_slug"] = best["slug"] if best else ""
        results.append(result)

        if i % 10 == 0 or i == len(rows):
            print(f"  {i}/{len(rows)}...")

    # Write output
    fieldnames = list(results[0].keys()) if results else []
    with open(out, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"\nOutput written to: {out}")

    counts: dict[str, int] = {}
    for r in results:
        counts[r["decision"]] = counts.get(r["decision"], 0) + 1

    print("\n=== Duplicate Check Summary ===")
    print(f"Total:               {len(results):>4}")
    print(f"IMPORT:              {counts.get('IMPORT', 0):>4}  (kein Duplikat)")
    print(f"POSSIBLE_DUPLICATE:  {counts.get('POSSIBLE_DUPLICATE', 0):>4}  (Score 0.82–0.89, manuell prüfen)")
    print(f"PROBABLE_DUPLICATE:  {counts.get('PROBABLE_DUPLICATE', 0):>4}  (Score 0.90–0.96, wahrsch. Duplikat)")
    print(f"DEFINITE_DUPLICATE:  {counts.get('DEFINITE_DUPLICATE', 0):>4}  (Score ≥0.97, sicher Duplikat)")

    n_import = counts.get("IMPORT", 0)
    if n_import:
        print(f"\nBereit zum Import: {n_import} Einträge")
        print(f"Nächster Schritt:  python3 tools/import-victims.py {out}")
    else:
        print("\nKeine neuen Einträge — alle sind Duplikate oder müssen manuell geprüft werden.")


if __name__ == "__main__":
    main()
