# Workflow: Deduplizierung nach Batch-Import

## Ziel
Duplikate nach einem Datenimport erkennen und mergen, ohne echte verschiedene Personen zu verlieren.

## Voraussetzungen
- Datenimport abgeschlossen (YAML + DB)
- Lokale PostgreSQL läuft

## Aktives Tool: Enricher Dedup

```bash
python3 -m tools.enricher dedup --dry-run -v     # Vorschau mit Details
python3 -m tools.enricher dedup --apply           # Ausführen (nur Score ≥50)
python3 -m tools.enricher dedup --apply --include-review  # Auch 30-49 Score
```

### Wie es funktioniert
1. Gruppierung nach normalisiertem Farsi-Namen (strips Parenthesen wie "(ژینا)")
2. Sekundäre Gruppierung nach Latin-Name-Word-Set für Einträge ohne Farsi
3. Scoring: Farsi +50, Todesdatum +50, Provinz +20, Alter +15, Ort +10, Todesursache +10
4. Todesdatum-Mismatch = -100 (verschiedene Personen)
5. Winner = höchster Completeness-Score (verified +100, Felder +1, Sources +5, Photos +3)
6. Merge: COALESCE-Felder, Sources/Photos migrieren (URL-Dedup), Loser löschen

### Historische Skripte (in `tools/legacy/`, nur als Referenz)
- `dedup_victims.py` — YAML-Level Dedup (3 Strategien)
- `dedup_2026_internal.py` — Farsi-Normalisierung
- `dedup-db.ts` — DB-Level Smart-Dedup mit Scoring
- `dedup-round5.ts` — Unicode-Normalisierung

## Wichtige Regeln
- **Merge statt Delete:** Immer Felder + Sources aus dem Duplikat ins Original kopieren
- **Verschiedenes Todesdatum = verschiedene Person** (Score -100)
- **Unknown/ناشناس:** Nur dedupen wenn `circumstances_en` Text identisch ist
- **Score 30-49:** IMMER manuell prüfen (~50% False Positive Rate)
- **Verschiedener normalisierter Farsi-Name:** Verschiedene Person, auch bei gleichem Latin-Namen

## Nach der Deduplizierung
- CLAUDE.md "Data Collection Status" Tabelle aktualisieren
- Eintrag in `docs/LEARNINGS.md`
