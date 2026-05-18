# Iran Memorial — Projektdokumentation

> Letzte Aktualisierung: 16. Februar 2026

---

## Inhaltsverzeichnis

1. [Was ist dieses Projekt?](#1-was-ist-dieses-projekt)
2. [Warum existiert es?](#2-warum-existiert-es)
3. [Wofür wird es gebraucht?](#3-wofür-wird-es-gebraucht)
4. [Wer steht dahinter?](#4-wer-steht-dahinter)
5. [Wo ist es zu finden?](#5-wo-ist-es-zu-finden)
6. [Wie funktioniert es technisch?](#6-wie-funktioniert-es-technisch)
7. [Datenmodell](#7-datenmodell)
8. [Sprachen und Internationalisierung](#8-sprachen-und-internationalisierung)
9. [Open Source und Transparenz](#9-open-source-und-transparenz)
10. [Wie kann man beitragen?](#10-wie-kann-man-beitragen)
11. [Datenquellen und Verifizierung](#11-datenquellen-und-verifizierung)
12. [Ethische Grundsätze](#12-ethische-grundsätze)
13. [Phasenplan](#13-phasenplan)
14. [Architekturentscheidungen](#14-architekturentscheidungen)

---

## 1. Was ist dieses Projekt?

Das **Iran Memorial** ist eine digitale Gedenkstätte für die Opfer der Islamischen Republik Iran von 1979 bis heute. Jedes Opfer staatlicher Gewalt — ob bei Massenexekutionen, Straßenprotesten, in Gefängnissen oder durch gezielte Tötung — bekommt eine eigene Seite im Stil eines Wikipedia-Eintrags. Diese Seiten sind in einen chronologischen Zeitstrahl eingebettet, der die großen Ereignisse der Repressionsgeschichte Irans dokumentiert.

Das Projekt ist:

- **Eine Datenbank**: Strukturierte, durchsuchbare Erfassung aller bekannten Opfer mit Name, Lebensgeschichte, Todesumständen, Quellen
- **Eine Gedenkseite**: Jeder Mensch wird nicht als Statistik, sondern als Individuum mit Träumen, Familie und Geschichte gewürdigt
- **Ein Zeitstrahl**: Chronologische Darstellung aller großen Ereignisse — von der Revolution 1979 über das Massaker von 1988, die Grüne Bewegung 2009, den Bloody November 2019, die „Frau, Leben, Freiheit"-Bewegung 2022 bis zu den Massakern 2026
- **Ein offenes Archiv**: Alle Daten sind öffentlich zugänglich, die Software ist Open Source, jeder kann beitragen
- **Dreisprachig**: Farsi, Englisch und Deutsch — von Anfang an

### Umfang

Die Datenbank zielt darauf ab, über **500.000 Opfer** zu dokumentieren. Zum Start sind 3 exemplarische Einträge enthalten (Mahsa Amini, Neda Agha-Soltan, ein repräsentativer Eintrag für das 1988-Massaker) sowie 12 historische Ereignisse. Die Datenbank wächst durch Community-Beiträge und Partnerschaften mit Menschenrechtsorganisationen.

---

## 2. Warum existiert es?

### Das Problem

Seit 1979 hat die Islamische Republik Iran systematisch ihre eigene Bevölkerung unterdrückt, inhaftiert, gefoltert und getötet. Die Zahlen sind erschütternd:

| Ereignis | Zeitraum | Geschätzte Opfer |
|---|---|---|
| Nachrevolutionäre Hinrichtungen | 1979 | ~438 |
| Terrorherrschaft | 1981–1985 | ~7.900 |
| Iran-Irak-Krieg (inkl. Kindersoldaten) | 1980–1988 | ~500.000 |
| Gefängnismassaker | 1988 | 5.000–30.000 |
| Kettenmorde an Intellektuellen | 1988–1998 | ~80 |
| Studentenproteste | 1999 | ~4 |
| Grüne Bewegung | 2009 | ~72 |
| Blutiger November | 2019 | 1.500–3.000 |
| Frau, Leben, Freiheit | 2022–2023 | ~500 |
| Massaker 2026 | 2026 | 3.428–20.000 |

Trotz dieser Dimensionen gibt es **keine zentrale, öffentliche, durchsuchbare Datenbank**, die alle Opfer mit ihren Geschichten erfasst. Informationen sind verstreut über verschiedene NGO-Berichte, Nachrichtenartikel und Zeitzeugenberichte. Viele Opfer sind nur Zahlen — namenlos, gesichtslos, vergessen.

### Die Absicht des Regimes

Das iranische Regime arbeitet aktiv daran, die Erinnerung auszulöschen:
- Massengräber (z.B. Khavaran) werden planiert und überbaut
- Familien werden bedroht, wenn sie öffentlich trauern
- Grabstätten werden unter Überwachung gestellt oder zerstört
- Das Internet wird bei Protesten abgeschaltet, um Dokumentation zu verhindern
- Offizielle Totenzahlen werden systematisch heruntergelogen

**Dieses Projekt ist ein Akt des Widerstands gegen das Vergessen.**

---

## 3. Wofür wird es gebraucht?

### Für Familien und Hinterbliebene
Die Angehörigen der Opfer verdienen einen Ort, an dem ihre Liebsten würdig erinnert werden. Viele Familien wissen nicht einmal, wo ihre Toten begraben sind. Diese Datenbank gibt ihnen einen digitalen Ort der Trauer und des Gedenkens.

### Für die iranische Diaspora
Millionen Iraner leben im Exil. Für sie ist diese Seite eine Verbindung zu dem, was in ihrer Heimat geschieht und geschehen ist — ein kollektives Gedächtnis der Gemeinschaft.

### Für Journalisten und Forscher
Eine strukturierte, quellenbasierte Datenbank ermöglicht fundierte Berichterstattung und akademische Forschung. Jeder Eintrag ist mit verifizierbaren Quellen verknüpft.

### Für Menschenrechtsorganisationen
Organisationen wie Amnesty International, Human Rights Watch und die UN-Faktenfindungsmissionen können die Daten nutzen, um ihre Berichte zu stützen und Muster der Repression sichtbar zu machen.

### Für die internationale Öffentlichkeit
Die Weltgemeinschaft muss wissen, was in Iran geschieht. Wenn jedes Opfer ein Gesicht und eine Geschichte hat, sind es keine abstrakten Zahlen mehr — es sind Menschen.

### Für zukünftige Rechenschaft
Eines Tages wird es Tribunale geben, Wahrheitskommissionen, juristische Aufarbeitung. Diese Datenbank bewahrt Beweise, die für Gerechtigkeit gebraucht werden. Die Namen der Verantwortlichen sind dokumentiert.

---

## 4. Wer steht dahinter?

### Initiator
Das Projekt wurde initiiert von **Iran Memorial Archive** ([GitHub: iran-memorial26](https://github.com/iran-memorial26)) — als Open-Source-Projekt konzipiert, damit es nicht von einer einzelnen Person abhängt.

### Wer kann beitragen?
**Jeder Mensch auf der Welt.** Das Projekt ist bewusst offen gestaltet:

- **Forscher und Historiker**: Verifizierung und Dokumentation von Opferdaten
- **Übersetzer**: Farsi, Englisch, Deutsch, Arabisch, Kurdisch, Türkisch und weitere Sprachen
- **Entwickler**: Frontend, Backend, Datenverarbeitung, Suche, Barrierefreiheit
- **Designer**: UI/UX, Visualisierungen, Infografiken
- **Menschenrechtsorganisationen**: Verifizierte Datenpartnerschaften
- **Zeitzeugen und Familien**: Einreichung von Informationen über Opfer
- **Juristen**: Dokumentation für zukünftige Rechtsverfahren

### Wie wird die Qualität gesichert?
Eingereichte Informationen durchlaufen einen Verifizierungsprozess:
1. **Community-Einreichung** über das Formular auf der Website
2. **Prüfung** durch verifizierte Editoren gegen mindestens eine glaubwürdige Quelle
3. **Statusmarkierung**: `unverified` → `verified` (oder `disputed`)
4. Jeder Eintrag enthält seine Quellen — vollständig transparent

---

## 5. Wo ist es zu finden?

| Was | Wo |
|---|---|
| **Quellcode** | [github.com/iran-memorial26/iran-memorial](https://github.com/iran-memorial26/iran-memorial) |
| **Website** | Wird unter einer eigenen Domain gehostet (TBD) |
| **Datenbank** | PostgreSQL — die Rohdaten werden als offener Datenexport (CSV/JSON) regelmäßig veröffentlicht |
| **YAML-Seed-Daten** | Im Repository unter `/data/` — die ursprünglichen Einträge im lesbaren YAML-Format |
| **Lizenz** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — frei nutzbar mit Namensnennung |

### Offener Datenzugang

Die Datenbank ist nicht hinter verschlossenen Türen. **Maximale Transparenz** bedeutet:

- Der gesamte Quellcode ist auf GitHub öffentlich einsehbar
- Die Opferdaten werden regelmäßig als offener Datenexport (JSON, CSV) veröffentlicht
- Eine öffentliche API (`/api/search`) erlaubt programmatischen Zugriff
- Jeder kann die Datenbank lokal mit Docker aufsetzen und selbst betreiben
- Die YAML-Quelldaten im Repository sind menschenlesbar und maschinenverarbeitbar

Das Ziel: Selbst wenn diese Website morgen offline geht, existieren die Daten weiter — verteilt, kopiert, archiviert.

---

## 6. Wie funktioniert es technisch?

### Tech Stack

| Komponente | Technologie | Begründung |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | ISR (Incremental Static Regeneration) für on-demand Rendering von 500.000+ Seiten, ohne alle vorher generieren zu müssen |
| **Sprache** | TypeScript | Typsicherheit über den gesamten Stack |
| **Datenbank** | PostgreSQL 16 (self-hosted) | Volltext-Suche mit Farsi über `simple`-Konfiguration, volle Datensouveränität, kein Drittanbieter |
| **ORM** | Prisma 6 | Typsichere Datenbankabfragen, automatische Migrationen, Seed-Skripte |
| **Suche** | PostgreSQL `tsvector` + `pg_trgm` | Farsi + lateinische Volltext-Suche und unscharfe Suche (Tippfehler-Toleranz) |
| **i18n** | next-intl | RTL-Unterstützung (Farsi), LTR (Englisch, Deutsch), URL-basiertes Routing `/fa/`, `/en/`, `/de/` |
| **Styling** | Tailwind CSS v4 | RTL-Support über `dir="rtl"`, responsiv, dunkles Design |
| **Container** | Docker Compose | PostgreSQL + Next.js in einem Befehl startbar |
| **Webserver** | Nginx | Reverse Proxy, Caching statischer Assets |

### Warum self-hosted PostgreSQL statt Cloud?

**Volle Datensouveränität.** Bei einem Projekt, das politisch verfolgte Opfer dokumentiert, dürfen die Daten nicht in der Hand eines US-Cloud-Anbieters liegen, der auf Regierungsanfragen reagieren könnte. Self-hosted bedeutet:
- Wir kontrollieren, wo die Daten physisch liegen
- Kein Drittanbieter kann den Zugang sperren
- Keine versteckten Kosten bei wachsender Datenmenge
- Vollständige Kontrolle über Backups und Replikation

### Warum Datenbank als Source of Truth (nicht YAML-Dateien)?

Bei 500.000+ Einträgen sind einzelne YAML-Dateien in Git nicht mehr handhabbar:
- Git-Operationen werden extrem langsam
- Volltextsuche über Dateien ist ineffizient
- Beziehungen (Opfer ↔ Ereignis ↔ Quellen) lassen sich in YAML nicht gut abbilden
- Gleichzeitige Bearbeitung durch mehrere Personen führt zu Merge-Konflikten

Die YAML-Dateien im Repository dienen als **initialer Seed** (Startdaten) und als lesbares Referenzformat. Danach ist PostgreSQL die einzige Wahrheitsquelle.

### Projektstruktur

```
iran-memorial/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # Sprachbasierte Routen (/fa/, /en/, /de/)
│   │   ├── page.tsx              # Startseite: Statistiken, Suche, Intro
│   │   ├── layout.tsx            # RTL/LTR Layout pro Sprache
│   │   ├── timeline/page.tsx     # Interaktiver Zeitstrahl (Zoom, Expand)
│   │   ├── map/page.tsx          # Provinz-Karte (Leaflet)
│   │   ├── statistics/page.tsx   # Diagramme und Statistiken
│   │   ├── api-docs/page.tsx     # API-Dokumentation
│   │   ├── admin/page.tsx        # Admin Submission-Review
│   │   ├── victims/
│   │   │   ├── page.tsx          # Opferliste mit Suche und Filtern
│   │   │   └── [slug]/page.tsx   # Opfer-Einzelseite
│   │   ├── events/
│   │   │   ├── page.tsx          # Alle Ereignisse chronologisch
│   │   │   └── [slug]/page.tsx   # Einzelnes Ereignis + verknüpfte Opfer
│   │   ├── submit/page.tsx       # Einreichungsformular für die Community
│   │   └── about/page.tsx        # Über das Projekt
│   ├── api/
│   │   ├── search/route.ts       # Öffentliche Such-API
│   │   ├── submit/route.ts       # Einreichungs-API
│   │   ├── export/route.ts       # Datenexport (JSON/CSV)
│   │   ├── comments/route.ts     # Community-Kommentare (GET/POST, rate-limited)
│   │   ├── upload/route.ts       # Foto-Upload (Auth, Validierung)
│   │   └── admin/submissions/    # Admin Review API
│   ├── sitemap.ts                # Dynamische Sitemap (30K+ URLs)
│   └── robots.ts                 # robots.txt
├── components/                   # React-Komponenten (Header, Footer, VictimCard, etc.)
├── i18n/                         # Internationalisierung (Routing, Navigation, Config)
├── lib/                          # Datenbank-Client, Abfragen, Hilfsfunktionen
├── messages/                     # Übersetzungsdateien (fa.json, en.json, de.json)
├── prisma/
│   ├── schema.prisma             # Datenbankschema
│   ├── seed.ts                   # YAML → PostgreSQL Import
│   └── init.sql                  # PostgreSQL-Erweiterungen (pg_trgm)
├── data/                         # Ursprüngliche YAML-Daten (Seed)
│   ├── events/timeline.yaml      # 12 historische Ereignisse
│   └── victims/                  # 3 exemplarische Opfereinträge
├── docker-compose.yml            # PostgreSQL + App in einem Befehl
├── Dockerfile                    # Produktions-Build
└── nginx.conf                    # Webserver-Konfiguration
```

---

## 7. Datenmodell

### Opfer (`victims`)

Jeder Opfer-Eintrag dokumentiert ein ganzes Menschenleben — nicht nur den Tod:

| Bereich | Felder | Zweck |
|---|---|---|
| **Identität** | Name (Lateinisch + Farsi), Aliase, Geburtsdatum, Geburtsort, Geschlecht, Ethnie, Foto | Wer war dieser Mensch? |
| **Leben** | Beruf, Bildung, Familie, Träume, Überzeugungen, Persönlichkeit, Zitate | Was hat diesen Menschen ausgemacht? |
| **Tod** | Todesdatum, Alter, Todesort, Todesursache, Umstände, verantwortliche Kräfte | Was ist passiert? |
| **Nachwirkung** | Begräbnisort, Familienverfolgung, Rechtsverfahren, Gedenken | Was geschah danach? |
| **Verwaltung** | Verifizierungsstatus, Quellen, Erstellungsdatum | Wie verlässlich ist dieser Eintrag? |

Jedes Textfeld existiert in Englisch und Farsi (z.B. `circumstances_en`, `circumstances_fa`), Deutsch wird in Phase 2 ergänzt.

### Ereignisse (`events`)

| Feld | Beschreibung |
|---|---|
| Titel (EN/FA/DE) | Name des Ereignisses in allen Sprachen |
| Datum (Start/Ende) | Zeitraum des Ereignisses |
| Beschreibung (EN/FA/DE) | Was geschah? |
| Geschätzte Opferzahl | Niedrig- und Hochschätzung |
| Tags | Kategorisierung (massacre, protests, children, etc.) |

### Quellen (`sources`)

Jede Quelle ist einem Opfer oder Ereignis zugeordnet:
- URL zum Originaldokument
- Name der Quelle (z.B. "Amnesty International — Blood-Soaked Secrets")
- Typ: `news`, `ngo_report`, `witness`, `court`, `social_media`, `encyclopedia`
- Veröffentlichungsdatum

### Einreichungen (`submissions`)

Community-Beiträge werden als JSON gespeichert und durchlaufen einen Review-Prozess:
- Status: `pending` → `approved` oder `rejected`
- Prüfer-Notizen für Transparenz
- Einreicher bleibt optional (Anonymität möglich)

---

## 8. Sprachen und Internationalisierung

### Warum dreisprachig von Anfang an?

- **Farsi (فارسی)**: Die Sprache der Opfer und ihrer Familien. Primärsprache. RTL-Layout (rechts nach links).
- **Englisch**: Internationale Reichweite. Sprache der Menschenrechtsorganisationen, der UN, der internationalen Presse.
- **Deutsch**: Die iranische Diaspora in Deutschland ist eine der größten weltweit. Deutschland ist Sitz vieler Exil-Organisationen.

### Technische Umsetzung

- URL-basiertes Routing: `/fa/victims/amini-mahsa-2000`, `/en/victims/amini-mahsa-2000`, `/de/victims/amini-mahsa-2000`
- Farsi: Automatisches `dir="rtl"` auf dem gesamten Layout, spezielle Farsi-Schriftart (Vazirmatn)
- Alle UI-Texte (Buttons, Labels, Navigation) sind in allen 3 Sprachen übersetzt
- Inhaltliche Felder (Opferbeschreibungen, Ereignistexte) werden pro Sprache in der Datenbank gespeichert
- Sprachumschalter in der Navigation — wechselt die Sprache ohne Seitenverlust

### Spätere Erweiterung

Arabisch, Kurdisch (Sorani/Kurmanji), Türkisch und weitere Sprachen können durch Hinzufügen neuer Übersetzungsdateien ergänzt werden.

---

## 9. Open Source und Transparenz

### Philosophie

Dieses Projekt folgt einem radikalen Transparenzprinzip:

> **Alles ist öffentlich. Alles ist überprüfbar. Alles ist kopierbar.**

Das ist kein Zufall, sondern Absicht. Ein Regime, das seine Verbrechen vertuscht, kann nur durch maximale Offenheit bekämpft werden.

### Was genau ist offen?

| Aspekt | Umsetzung |
|---|---|
| **Quellcode** | Vollständig auf GitHub, MIT-lizenziert für Code, CC BY-SA 4.0 für Inhalte |
| **Datenbank-Schema** | Öffentlich dokumentiert im Repository (`prisma/schema.prisma`) |
| **Opferdaten** | Regelmäßige Exports als JSON und CSV zum freien Download |
| **API** | Öffentliche Such-API ohne Authentifizierung für Leseoperationen |
| **Entscheidungen** | Alle Architektur- und Designentscheidungen sind in dieser Dokumentation festgehalten |
| **Änderungshistorie** | Jede Änderung an Code und Daten ist über die Git-Historie nachvollziehbar |
| **Verifizierungsprozess** | Der Status jedes Eintrags (verifiziert/ungeprüft/umstritten) ist sichtbar |

### Wie kann jemand die Datenbank lokal betreiben?

```bash
git clone https://github.com/iran-memorial26/iran-memorial.git
cd iran-memorial
docker compose up -d db        # PostgreSQL starten
npm install                     # Abhängigkeiten installieren
npx prisma migrate dev          # Datenbank-Tabellen erstellen
npx prisma db seed              # Seed-Daten importieren
npm run dev                     # Lokaler Server auf http://localhost:3000
```

Damit hat jeder Mensch auf der Welt eine vollständige Kopie der Gedenkstätte auf seinem eigenen Rechner. Selbst wenn das Original offline geht — die Daten überleben.

### Resilienz gegen Zensur

- Die Daten liegen in einem öffentlichen Git-Repository → jeder Fork ist eine vollständige Kopie
- Die Datenbank kann von jedem lokal aufgesetzt werden
- Regelmäßige Datenexports werden an mehreren Orten archiviert
- Die Website kann auf verschiedenen Servern in verschiedenen Ländern gehostet werden
- Falls GitHub blockiert wird: Das Repository kann auf GitLab, Codeberg oder eigenen Servern gespiegelt werden

---

## 10. Wie kann man beitragen?

### Für Nicht-Techniker

1. **Informationen einreichen**: Auf der Website unter `/submit` kann jeder Informationen über Opfer einreichen — mit oder ohne Account, auch anonym
2. **Bestehende Einträge prüfen**: Fehler melden, fehlende Informationen ergänzen, Übersetzungen verbessern
3. **Verbreiten**: Die Seite teilen, in sozialen Medien verlinken, in Artikeln zitieren

### Für Entwickler

1. Repository forken auf GitHub
2. Lokale Entwicklungsumgebung aufsetzen (siehe oben)
3. Issues ansehen — es gibt immer offene Aufgaben
4. Pull Request erstellen mit Änderungen
5. Code Review durch Maintainer

### Für Menschenrechtsorganisationen

- **Datenpartnerschaften**: Verifizierte Datensätze können direkt importiert werden
- **API-Zugang**: Programmatischer Zugriff auf die Datenbank für eigene Recherchen
- **Gemeinsame Verifizierung**: Einträge können gemeinsam geprüft und freigegeben werden

### Für Übersetzer

- UI-Texte liegen als JSON-Dateien unter `/messages/` — einfach neue Sprache als Datei hinzufügen
- Inhaltliche Übersetzungen (Opferbeschreibungen) werden über die Datenbank verwaltet

---

## 11. Datenquellen und Verifizierung

### Primärquellen

| Organisation | Schwerpunkt |
|---|---|
| [Amnesty International](https://www.amnesty.org/) | Globale Menschenrechtsberichte, Einzelfälle |
| [Human Rights Watch](https://www.hrw.org/) | Investigative Berichte, Zeugenaussagen |
| [Iran Human Rights (IHR)](https://iranhr.net/) | Echtzeit-Dokumentation von Hinrichtungen und Tötungen |
| [HRANA](https://www.hra-news.org/) | Nachrichtenagentur für Menschenrechte in Iran |
| [Boroumand Foundation](https://www.iranrights.org/) | Umfassendste Opferdatenbank für das 1988-Massaker |
| [Center for Human Rights in Iran](https://iranhumanrights.org/) | Langfristige Dokumentation |
| [Justice for Iran](https://justiceforiran.org/) | Juristische Dokumentation für Rechenschaft |
| UN-Faktenfindungsmissionen | Offizielle UN-Berichte und -Untersuchungen |

### Verifizierungsstufen

| Status | Bedeutung | Kriterium |
|---|---|---|
| `verified` | Verifiziert | Mindestens eine glaubwürdige unabhängige Quelle bestätigt die Kernfakten |
| `unverified` | Ungeprüft | Einreichung eingegangen, aber noch nicht gegen unabhängige Quellen geprüft |
| `disputed` | Umstritten | Widersprüchliche Informationen aus verschiedenen Quellen |

### Quellentypen

- `ngo_report` — Berichte von Menschenrechtsorganisationen
- `news` — Nachrichtenartikel von etablierten Medien
- `witness` — Zeugenaussagen (mit besonderer Sensibilität behandelt)
- `court` — Gerichtsdokumente und juristische Verfahren
- `social_media` — Social-Media-Dokumentation (Videos, Fotos, Posts)
- `encyclopedia` — Enzyklopädie-Einträge (Wikipedia, Iranica, etc.)

---

## 12. Ethische Grundsätze

### Würde

Jeder Eintrag behandelt das Opfer als ganzen Menschen — nicht als Datenpunkt. Wir dokumentieren ihre Träume, ihre Persönlichkeit, ihre Worte. Der Tod ist nur ein Teil ihrer Geschichte.

### Wahrheit

Keine Übertreibung, keine Untertreibung. Wenn Zahlen unsicher sind, geben wir Spannen an (z.B. „5.000–30.000" beim 1988-Massaker). Wenn Informationen nicht verifiziert sind, kennzeichnen wir sie als solche.

### Familienrespekt

Sensible Details (z.B. über Folter oder sexuelle Gewalt) werden mit Bedacht formuliert. Die Würde der Opfer und der Schutz der Hinterbliebenen haben Vorrang vor sensationeller Darstellung.

### Schutz von Einreichern

Einreichungen können anonym erfolgen. E-Mail und Name sind optional. In einem Land, in dem Familien für das Gedenken an ihre Toten verfolgt werden, ist Anonymität ein Schutz.

### Überparteilichkeit

Dies ist kein Projekt einer politischen Gruppierung. **Alle** Opfer verdienen Gedenken — unabhängig von Ethnie, Religion, politischer Überzeugung oder Zugehörigkeit. Kurden, Perser, Balutschen, Araber, Azerbaijaner. Linke, Religiöse, Liberale, Unpolitische. Alle.

### Keine Agenda außer Wahrheit

Das einzige Ziel ist Dokumentation und Erinnerung. Keine Parteinahme für eine bestimmte Opposition, kein Regime-Change-Programm, kein Fundraising. Nur: **Was ist geschehen? Wem ist es geschehen? Wer war verantwortlich?**

---

## 13. Phasenplan

### Phase 1 — Fundament (abgeschlossen)

- [x] Next.js 15 Projekt mit TypeScript und Tailwind CSS v4
- [x] PostgreSQL-Datenbankschema (Opfer, Ereignisse, Quellen, Einreichungen)
- [x] Prisma ORM mit Migrationen und Seed-Skript
- [x] Dreisprachiges i18n-System (Farsi RTL, Englisch, Deutsch)
- [x] Dunkles, würdevolles Memorial-Design
- [x] Startseite mit Statistiken und Suche
- [x] Opfer-Einzelseiten mit ISR (stündliche Aktualisierung)
- [x] Ereignis-Seiten mit verknüpften Opfern
- [x] Statischer Zeitstrahl
- [x] Einreichungsformular für Community-Beiträge
- [x] Such-API
- [x] Docker-Compose für lokale Entwicklung und Deployment
- [x] 3 Opfer-Einträge + 12 Ereignisse als Seed-Daten

### Phase 2 — Wachstum (größtenteils abgeschlossen)

- [x] Admin-Panel für Submission-Review (Approve/Reject via Nginx Basic Auth)
- [x] Bulk-Import von Opferdaten aus externen Quellen (Boroumand, IHR, HRANA, iranvictims, iranrevolution, Wikipedia, Telegram RTN)
- [x] Deutsche Übersetzungen der Opfer-Inhalte (~22K circumstances_de via GPT-4o-mini)
- [x] Foto-Upload UI (AdminPanel PhotoUploadSection: victim search, drag&drop, preview, caption)
- [x] Erweiterte Suchfilter (Provinz, Jahr, Geschlecht in FilterBar)
- [x] Offener Datenexport (JSON/CSV-Download via `/api/export`, rate-limited)
- [x] Öffentliche API-Dokumentation (`/api-docs` Seite mit Live-Stats)

### Phase 3 — Interaktivität (größtenteils abgeschlossen)

- [x] Interaktiver Zeitstrahl mit Zoom (50%–300%) und Click-to-Expand
- [x] Kartenvisualisierung (Provinz-Level Leaflet-Karte mit proportionalen Markern, DB-driven)
- [x] Statistische Dashboards (Tötungen nach Jahr, Region, Geschlecht — Statistics-Seite)
- [x] Community-Kommentare API (pending/approved Moderation, Rate-Limited)
- [ ] Benachrichtigungssystem für Datenänderungen

### Phase 4 — Reichweite (geplant)

- [ ] Weitere Sprachen (Arabisch, Kurdisch, Türkisch)
- [ ] Partnerschaften mit Universitäten und Forschungsinstituten
- [ ] Archivierung bei Internet Archive und anderen Langzeitarchiven
- [ ] Bildungsmaterialien für Schulen und Universitäten
- [ ] Mobile App

---

## 14. Architekturentscheidungen

### Warum Next.js und nicht ein statischer Site-Generator?

Bei 500.000+ Seiten ist es unmöglich, alle Seiten zur Build-Zeit zu generieren. Next.js ISR (Incremental Static Regeneration) generiert Seiten **on-demand beim ersten Aufruf** und cached sie danach. Eine Seite, die nie aufgerufen wird, wird nie generiert — spart Rechenleistung und Speicher.

### Warum PostgreSQL und nicht MongoDB/SQLite?

- **Volltextsuche**: PostgreSQL hat eingebaute Volltextsuche, die auch mit Farsi funktioniert (über die `simple`-Konfiguration, die sprachagnostisch tokenisiert)
- **Unscharfe Suche**: Die `pg_trgm`-Erweiterung erlaubt Tippfehler-tolerante Suche
- **Beziehungen**: Opfer → Ereignisse → Quellen sind relationale Daten
- **Bewährt**: PostgreSQL ist die robusteste Open-Source-Datenbank, läuft seit Jahrzehnten stabil

### Warum Tailwind CSS?

- Eingebaute RTL-Unterstützung (`start`/`end` statt `left`/`right`)
- Schnelle Entwicklung ohne separate CSS-Dateien
- Konsistentes Design-System
- Kein CSS-Bloat — nur verwendete Klassen landen im Build

### Warum self-hosted statt Cloud (Vercel, AWS)?

- **Datensouveränität**: Kein US-Unternehmen hat Zugriff auf die Daten
- **Kosten**: Bei 500.000+ Seiten mit ISR wären Cloud-Kosten erheblich
- **Unabhängigkeit**: Kein Anbieter kann den Dienst kündigen oder auf Regierungsanfragen reagieren
- **Kontrolle**: Volle Kontrolle über Backups, Verschlüsselung, Zugriffsrechte

---

> *„Diejenigen, die sich nicht an die Vergangenheit erinnern können, sind dazu verurteilt, sie zu wiederholen."*
> — George Santayana

> *«کسانی که نمی‌توانند گذشته را به یاد آورند، محکوم به تکرار آن هستند.»*

---

**Repository**: [github.com/iran-memorial26/iran-memorial](https://github.com/iran-memorial26/iran-memorial)
**Lizenz**: Code: MIT | Inhalte: CC BY-SA 4.0
