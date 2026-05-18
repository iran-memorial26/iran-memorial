# Workflow: Neue Opfer hinzufügen

## Übersicht

Dieser Workflow beschreibt den sicheren, automatisierten Prozess zum Hinzufügen neuer Opfer zur Datenbank — mit obligatorischer Duplikatsprüfung vor dem Import.

**Warum:** Dopplungen in der DB schädigen die Glaubwürdigkeit des Projekts. Jede neue Quelle kann Opfer unter leicht abweichenden Schreibweisen enthalten (z.B. "Mohammad" vs. "Mohammed", "Hossein" vs. "Hussein").

**Tools:**

| Tool | Zweck |
|------|-------|
| `tools/check-duplicates.py` | Vergleicht neue Einträge gegen alle ~30.000 vorhandenen Opfer |
| `tools/import-victims.py` | Importiert geprüfte Einträge (nur `decision=IMPORT`) |

---

## Schritt 1: Eingabe-CSV vorbereiten

Das CSV muss mindestens die Spalte `name_latin` enthalten. Alle weiteren Spalten sind optional, verbessern aber die Erkennungsrate und Datenqualität.

### Pflicht- und optionale Spalten

| Spalte | Pflicht | Beschreibung |
|--------|---------|--------------|
| `name_latin` | **Ja** | Vor- und Nachname in lateinischer Schrift |
| `name_farsi` | Nein | Name in persischer Schrift — stark empfohlen, verbessert Duplikat-Erkennung erheblich |
| `date_of_death` | Nein | ISO-Format: `YYYY-MM-DD` — wird auch für Slug-Generierung verwendet |
| `location` | Nein | Ort des Todes — wird gegen `cities`-Tabelle gematcht |
| `age` | Nein | Alter zum Todeszeitpunkt (Ganzzahl) |
| `cause_of_death` | Nein | Wenn leer: wird aus `notes` abgeleitet (Shot, Execution, Death in custody, Torture) |
| `source_urls` | Nein | Quell-URLs, semikolon-getrennt |
| `notes` | Nein | Umstände auf Englisch — geht in `circumstances_en` |
| `card_id` | Nein | Externe Referenz-ID (z.B. iranvictims.com card #) |

### Beispiel-CSV

```csv
card_id,name_latin,name_farsi,age,location,date_of_death,source_urls,notes
6951,Ali Tabasi Feyzabadi,علی طبسی فیض‌آبادی,,Mashhad,2026-01-08,https://t.me/RememberTheirNames/2854,Died in Mashhad
5542,Arsalan Eslamian,ارسلان اسلامیان,28,Tehran,2026-01-08,https://x.com/mashreghidokht/status/...,Shot with two war bullets during protest in Piroozi area of Tehran
```

### Bereits vorbereitete Daten

| Datei | Inhalt | Status |
|-------|--------|--------|
| `tools/data/iranvictims-2026-truly-missing.csv` | 44 Opfer aus 2026, noch nicht in DB | ⏳ Ausstehend |
| `tools/data/iranvictims-2026-probable-duplicates.csv` | 93 mögliche Duplikate (manuell prüfen) | ⏳ Review |
| `tools/data/iranvictims-missing-2026-02-17.csv` | 206 Einträge (alle nicht-gematchten) | 📁 Referenz |

---

## Schritt 2: Duplikatsprüfung ausführen

```bash
python3 tools/check-duplicates.py tools/data/mein-import.csv
```

Erzeugt automatisch: `tools/data/mein-import-checked.csv`

### Wie der Algorithmus funktioniert

1. Alle ~30.000 Opfer aus DB laden (Name lateinisch + persisch)
2. Für jeden Input-Eintrag: Ähnlichkeit zu allen DB-Einträgen berechnen
3. Transliterations-Normalisierung: "Mohammed" = "Mohammad" = "Muhammad"
4. Farsi-Vergleich hat Vorrang (sicherer als lateinische Transkription)

### Entscheidungs-Schwellenwerte

| `decision` | Score | Bedeutung | Empfehlung |
|------------|-------|-----------|------------|
| `IMPORT` | < 0.82 | Kein ähnlicher Eintrag gefunden | ✅ Direkt importieren |
| `POSSIBLE_DUPLICATE` | 0.82–0.89 | Ähnlicher Name — könnte gleiche Person sein | ⚠️ Manuell prüfen |
| `PROBABLE_DUPLICATE` | 0.90–0.96 | Wahrscheinliches Duplikat | 🔍 Mit Farsi-Name verifizieren |
| `DEFINITE_DUPLICATE` | ≥ 0.97 | Sehr sicher das gleiche Duplikat | ❌ Nicht importieren |

### Ausgabe-Spalten im Check-CSV

| Spalte | Beschreibung |
|--------|--------------|
| `decision` | Empfehlung (IMPORT / POSSIBLE_DUPLICATE / PROBABLE_DUPLICATE / DEFINITE_DUPLICATE) |
| `match_score` | Ähnlichkeitswert 0.000 – 1.000 |
| `matched_db_name` | Beste Übereinstimmung in DB (lateinisch) |
| `matched_db_farsi` | Beste Übereinstimmung in DB (persisch) |
| `matched_db_slug` | Slug des DB-Eintrags → prüfbar unter `/victims/{slug}` |

---

## Schritt 3: Output reviewen

### Bei `POSSIBLE_DUPLICATE` oder `PROBABLE_DUPLICATE`

Für jeden solchen Eintrag prüfen:

1. Vergleiche `name_farsi` des Input-Eintrags mit `matched_db_farsi`
2. Falls **identisch oder sehr ähnlich** → `decision` auf `SKIP` setzen (bestätigtes Duplikat)
3. Falls **unterschiedlich** → `decision` auf `IMPORT` setzen (verschiedene Personen)
4. Im Zweifel: DB-Eintrag aufrufen: `https://iran-memorial.org/victims/{matched_db_slug}`

### Bei `DEFINITE_DUPLICATE`

Diese Einträge sind fast sicher bereits in der DB. Nur in sehr seltenen Fällen überschreiben (z.B. wenn die DB-Version unvollständig ist → dann direkt via Admin-Panel bearbeiten).

### Decision-Werte im CSV bearbeiten

Unterstützte Werte für `decision`:
- `IMPORT` — wird importiert
- `SKIP` — wird übersprungen
- `POSSIBLE_DUPLICATE`, `PROBABLE_DUPLICATE`, `DEFINITE_DUPLICATE` — werden NICHT importiert (außer mit `--decision` Override)

---

## Schritt 4: Import ausführen

### Dry-Run (Vorschau)

```bash
python3 tools/import-victims.py tools/data/mein-import-checked.csv --dry-run
```

Zeigt was importiert würde ohne DB-Änderungen.

### Echter Import

```bash
python3 tools/import-victims.py tools/data/mein-import-checked.csv
```

Importiert nur Zeilen mit `decision=IMPORT`.

### Optionen

```bash
# Auch POSSIBLE_DUPLICATEs importieren (nach manuellem Review)
python3 tools/import-victims.py mein-import-checked.csv --decision POSSIBLE_DUPLICATE

# Nur bestimmte Decision importieren
python3 tools/import-victims.py mein-import-checked.csv --decision IMPORT
```

### Was der Import macht

Für jeden Eintrag mit passendem `decision`:

1. **Slug generieren** aus `name_latin` + Jahr aus `date_of_death`
2. **Slug-Konflikt prüfen** — bei Konflikt: `-2`, `-3`, … anhängen
3. **Stadt-Lookup** — `location` gegen `cities`-Tabelle matchen (optional)
4. **Todesursache ableiten** — aus `cause_of_death` oder automatisch aus `notes`
5. **Victim-Record einfügen** mit `verification_status = 'unverified'`
6. **Source-Records einfügen** für jede URL in `source_urls`
7. **Idempotent** — `ON CONFLICT DO NOTHING` → doppelter Import ist sicher

### Automatisch abgeleitete Todesursachen

| Schlüsselwörter in `notes` | Abgeleitete Ursache |
|---------------------------|---------------------|
| shot, bullet, gunshot, live ammunition, birdshot | `Shot` |
| executed, execution, hanged, hanging | `Execution` |
| custody, prison, jail, arrested | `Death in custody` |
| torture | `Torture` |
| (nichts passendes) | `null` |

### Automatisch zugewiesene Quelltypen

| URL-Domain | `source_type` |
|-----------|---------------|
| instagram.com, x.com, t.me | `SOCIAL_MEDIA` |
| iranvictims.com | `MEMORIAL_PROJECT` |
| Alle anderen | `MEDIA` |

---

## Schritt 5: Verifizieren

```bash
# Gesamtanzahl prüfen
psql -h localhost -U Pedi -d iran_memorial -c "SELECT COUNT(*) FROM victims"

# Neueste Einträge anzeigen
psql -h localhost -U Pedi -d iran_memorial -c \
  "SELECT slug, name_latin, date_of_death, created_at FROM victims ORDER BY created_at DESC LIMIT 10"
```

Oder im Admin-Panel: `http://localhost:3000/de/admin`

---

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| `psycopg2 not installed` | `pip install psycopg2-binary` |
| `could not connect to server` | Lokale DB läuft nicht: `pg_ctl start` oder Docker-Container starten |
| `slug already exists` → SKIPPED | Normal — idempotent. Eintrag existiert bereits. |
| `ON CONFLICT DO NOTHING` in Sources | Doppelter Import ist sicher. |
| Farsi-Spalte leer | Tool funktioniert trotzdem, aber Trefferquote sinkt. Farsi-Namen aus iranvictims.com immer mitspeichern. |
| Alle Einträge als DEFINITE_DUPLICATE | Prüfen ob Input-CSV bereits importierte Daten enthält |

---

## Verwandte Workflows

- `workflows/data-import.md` — Vollständiger Import-Pipeline mit Enricher-Plugins
- `workflows/dedup-pipeline.md` — Deduplizierung nach Batch-Import
- `workflows/deploy.md` — Deployment auf Server nach Import
