# Workflow: Datenimport neuer Opfer-Quellen

## Ziel
Opferdaten aus einer neuen Quelle importieren, deduplizieren und in die Produktions-DB einfügen.

## Voraussetzungen
- Quelle identifiziert (URL, CSV, PDF, API)
- Lokale PostgreSQL läuft (`docker compose up -d db`)

## Schritte

### 1. Quelle analysieren
- Format bestimmen (HTML-Tabelle, CSV, PDF, API)
- Erwartete Felder und Opferzahl schätzen
- Gegen 5 Opferkategorien prüfen (Protest-Tote, Hingerichtete, Hafttode, verdächtige Tode, Hijab-Enforcement)

### 2. Enricher-Plugin erstellen oder vorhandenen nutzen
- Prüfe `tools/enricher/sources/` auf existierende Plugins
- Neues Plugin mit `@register` Decorator erstellen falls nötig
- Historische Einmalskripte als Referenz in `tools/legacy/`

| Quelltyp | Aktives Tool (Enricher) | Historische Referenz (Legacy) |
|----------|------------------------|------------------------------|
| Wikipedia-Tabelle | `enricher/sources/wikipedia_wlf.py` | `legacy/parse_wikipedia_wlf.py` |
| CSV-Export | `enricher/sources/iranvictims.py` | `legacy/import_iranvictims_csv.py` |
| PDF-Report | — | `legacy/parse_hrana_82day.py`, `legacy/parse_amnesty_children.py` |
| HTML-Scrape | `enricher/sources/boroumand.py` | `legacy/scrape_boroumand.py` |
| Supabase REST API | `enricher/sources/iranrevolution.py` | — |
| Telegram Channel | `enricher/sources/telegram_rtn.py` | — |
| Community API (JSON) | `enricher/sources/iranmonitor.py` | — |
| iranvictims.com (Foto-Scrape) | — | `legacy/scrape_iranvictims_photos.py` |

### 3. Enrichment durchführen
```bash
python3 -m tools.enricher check -s <plugin> -v     # Dry-Run
python3 -m tools.enricher enrich -s <plugin>        # Ausführen
```

### 4. Deduplizierung
```bash
python3 -m tools.enricher dedup --dry-run -v        # Vorschau
python3 -m tools.enricher dedup --apply              # Ausführen
```
Siehe auch `workflows/dedup-pipeline.md`

### 5. Verifizierung
- `SELECT COUNT(*) FROM "Victim"` — Zahl prüfen
- Stichprobe auf der Website: `http://localhost:3000/en/victims/`

## Verfügbare Plugins

| Plugin | Quelle | Felder | Besonderheit |
|--------|--------|--------|-------------|
| `boroumand` | iranrights.org/memorial (HTML) | Name FA/EN, Foto, Umstände, Quellen | 26K historische Opfer |
| `iranvictims` | iranvictims.com/victims.csv | Name, Alter, Ort, Datum, Status, Quellen, Notizen | CSV-basiert, filtert `killed` |
| `iranrevolution` | iranrevolution.online (Supabase) | Name FA/EN, Ort, Datum, Bio EN/FA, Foto | Einzige Quelle mit `circumstances_fa` |
| `wikipedia_wlf` | Wikipedia WLF-Tabelle | Name, Ort, Datum, Umstände | ~420 Opfer |
| `iranmonitor` | iranmonitor.org/api/memorial (JSON) | Name FA/EN, Foto, Datum, Alter, Ort | Strukturierte API von @RememberTheirNames |
| `telegram_rtn` | t.me/s/RememberTheirNames (HTML) | Name FA, Foto, Datum (Jalali), Ort, Alter | ~2.865 Opfer, per-Post Source-URLs |

## 6. Deutsche Übersetzung
Nach Enrichment können Textfelder ins Deutsche übersetzt werden:
```bash
python3 tools/translate_de.py --field circumstances   # circumstances_en → _de
python3 tools/translate_de.py --field occupation       # occupation_en → _de
python3 tools/translate_de.py --dry-run --limit 5      # Vorschau
```
- GPT-4o-mini, ~$10 für 22K Texte, Semaphore-Concurrency (default 45)
- Resume-safe (überspringt bereits übersetzte)
- Verfügbare Felder: circumstances, occupation, beliefs, personality, dreams, burial_circumstances, family_persecution

## Edge Cases
- **Cloudflare-Blockade:** Wayback Machine als Fallback (`web.archive.org/web/URL`)
- **SSL-Fehler auf macOS:** `curl` als Fallback, Cache-File speichern
- **YAML-ID als Zahl geparst:** IDs mit `-` Prefix immer in Anführungszeichen oder `String()` Coercion
- **Bezahlte API-Calls:** Vor erneutem Laufen nach Fehler immer nachfragen
- **Supabase API:** Anon Key als `extra_headers` übergeben, Paginierung via `Range` Header (0-999, 1000-1999, ...)

## Dokumentation
- Eintrag in `docs/LEARNINGS.md` (Data Import Notes)
- Log-Eintrag in aktiver Log-Datei
- CLAUDE.md "Data Collection Status" Tabelle aktualisieren
