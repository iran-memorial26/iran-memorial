# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.17.0] — 2026-05-18 — Security hardening & infrastructure

### Security

- **XSS, SSRF, rate-limit IP spoofing fixes** — tightened Content-Security-Policy,
  closed SSRF vector in notification webhook fetches, fixed IP spoofing via
  `x-forwarded-for` header manipulation in rate limiter.
- **SQL injection / unsafe query fixes** — replaced `$queryRawUnsafe` with
  `$queryRaw` + Prisma tagged template literals throughout archive and export routes.
- **MIME spoofing** — admin upload route now performs magic-byte detection instead
  of trusting client-supplied `Content-Type`.
- **Date injection** — `safeParsDate()` wrapper replaces raw `new Date(user_input)`
  in submission convert route.
- **Public dump rate limit** — `/api/v1/public/dump` now enforces 3 req/IP/hour
  with `429 + Retry-After` response.
- **Schema leakage** — `400` responses from submit route no longer include Zod
  `fieldErrors` detail (prevents field enumeration).
- **IP spoofing in audit log** — export + submit routes use `cf-connecting-ip`
  or last XFF hop to prevent rate-limit bypass.
- **SHA-256 API keys** — `ApiKey.keyHash` column (pgcrypto `digest()`), hash-based
  lookup with plaintext fallback during migration period.
  Migration: `20260518_add_api_key_hash`.
- **Unified admin auth** — centralized `isAdmin()` in `lib/admin-auth.ts` using
  `INTERNAL_AUTH_TOKEN` + `ADMIN_USERS`; all 9 admin routes unified, local
  `x-forwarded-user` injection blocked.
- **Nonce-based CSP** — middleware generates per-request nonce, injects
  `Content-Security-Policy` with `'nonce-{nonce}' + 'strict-dynamic'` in
  `script-src`; removes `'unsafe-inline'`. Embed routes get permissive
  `frame-ancestors: *` policy.
- **Webhook URL guard** — `isBlockedUrl()` in `lib/webhook-url-guard.ts` blocks
  SSRF targets (localhost, RFC-1918 ranges) before any outbound fetch.
- **Admin audit logging** — structured audit events for webhook and API key
  CRUD operations (`webhook.created/toggled/deleted`, `apikey.created/toggled/deleted`).
- **Contact email removed from source** — hardcoded contact address replaced with
  `NEXT_PUBLIC_CONTACT_EMAIL` env var across 37 occurrences (3 pages, 16 locale
  files, docs, scripts). `lib/contact.ts` is the new single source of truth.

### Added

- **Redis-backed rate limiter** — `lib/rate-limit.ts` uses `ioredis` with
  in-memory fallback; `docker-compose.yml` adds `redis:7-alpine` service.
- **GitHub Actions CI** — `.github/workflows/security.yml`: parallel jobs for
  `npm audit --audit-level=high`, `pip-audit`, TypeScript check, and full
  Next.js build on every push/PR + weekly Monday schedule.
- **Admin log retention** — `POST /api/admin/cleanup-logs` deletes `api_usage`
  rows older than N days (default 90, range 7–365).
- **Candle SVG favicon** — `public/icons/candle-512.svg` added as browser icon.

### Changed

- **Next.js 16.1.6 → 16.2.6** — patches CVE for HTTP request smuggling in rewrites.
- **`force-dynamic` on all DB pages** — replaced ISR `revalidate` exports with
  `export const dynamic = "force-dynamic"` across all pages that query the database,
  preventing stale builds from serving outdated data.
- **`photo_url` derived from photos table** — `VICTIM_COLUMNS` query now derives
  `photo_url` via `LEFT JOIN photos` instead of the legacy `victims.photo_url`
  column, ensuring broken-photo filtering applies consistently.

## [v0.16.0] — 2026-05-11 — Photo permanence & global reach

### Added — Self-hosted photo mirror

A memorial is only credible if the photos it shows remain available. Before
this release we hot-linked photos from external CDNs (Telegram, Supabase,
news sites, witness.report) — and Telegram public-CDN URLs in particular
expire after a few months, silently emptying the memorial.

- **Mirror.** New enricher subcommand `photo-mirror` downloads every
  external photo URL to memorial-controlled storage at
  `/var/photos/<id-prefix>/<id>.<ext>`. The served URL is rewritten to
  `/photos/<rel>`; the original URL is preserved in a new column
  (`photos.original_url` + `victims.photo_original_url`) for attribution
  and re-mirror. **19,453 photos / 1.4 GB self-hosted** as of release.
- **Streaming route.** New Next.js route `/photos/[...path]/route.ts`
  streams files from a read-only volume mount with strict
  path-traversal protection and `cache-control: immutable` for the
  id-keyed paths. Server: `/var/photos:/app/photos-store:ro` +
  `PHOTO_STORE` env var.
- **Health monitoring.** New `photo-health` subcommand HEAD-checks every
  external URL and marks broken ones via a new `photos.is_broken` flag
  + `last_checked_at` + `last_status_code` (migration
  `20260510120000_photo_broken_tracking`). All photo queries now filter
  `WHERE is_broken = FALSE`. Weekly cron at `/etc/cron.d/iran-photo-health`
  (Sun 04:13 UTC). 4,720 expired telesco.pe URLs marked + 156 legacy
  `victims.photo_url` values nulled on first sweep.
- **Perceptual deduplication.** New `photo-dedupe` subcommand computes
  SHA-256 + 64-bit pHash for every mirrored file
  (migration `20260511000000_photo_hashes`, Pillow + imagehash). Exact
  duplicates collapsed via hardlink (1,567 clusters, 2,214 redundant
  files, **169.7 MB freed**). 62,104 perceptual pairs (Hamming ≤ 6)
  surfaced for admin review.

### Added — Reverse image search (admin)

New admin tool at `/admin/photo-search`:

- Upload an image → client-side 8x8 mean-based pHash via canvas →
  POST to `/api/admin/photo-similar?phash=<int64>` →
  Postgres returns matches via `bit_count(p.phash # $target)` (pg14+).
- Lookup by existing photo id → server reads its pHash → same query.
- Distance slider (0–20), results joined with victim info, click straight
  through to admin victim edit. Uses `x-forwarded-user` admin auth.
- Use cases: verify new submissions aren't duplicates, discover other
  photos of the same person, detect stock-photo reuse.

### Added — Candle fallback for broken/missing photos

New client component `MemorialPhoto` replaces every inline
`<Image src={photoUrl}>` across the site. Behaviour:

- `photoUrl IS NULL` → candle SVG placeholder rendered immediately.
- `photoUrl` set but fails to load → `onError` swaps to candle (~100ms
  after page load). No more broken-image icons anywhere.
- Used by `VictimCard`, victim-detail hero + related-victims grid,
  with rounded full / lg / md / none variants.

### Added — 9 new languages (16 total)

i18n expansion for global memorial reach:

| Locale | Language | Direction | Rationale |
|---|---|---|---|
| `he` | Hebrew | RTL | Iranian-Jewish diaspora in Israel (~250k) |
| `ru` | Russian | LTR | ex-USSR + Israeli-Russian community |
| `tr` | Turkish | LTR | Iran-Turkey corridor, Azeri minority inside Iran |
| `ckb` | Sorani Kurdish | RTL | Hengaw-archive victims are disproportionately Kurdish |
| `hi` | Hindi | LTR | UAE expat community, subcontinental reach |
| `ur` | Urdu | RTL | UAE, Pakistan; ~30% shared vocabulary with Farsi |
| `sv` | Swedish | LTR | largest Iranian refugee community in Europe |
| `nl` | Dutch | LTR | Amsterdam-area Iranian community |
| `zh` | Simplified Chinese | LTR | global reach |

Each locale: 384 keys translated, parity-checked against `en.json`, valid
JSON. Native-speaker review recommended for nuance (particularly Hebrew,
Sorani, Urdu where political sensitivity is highest).

### Changed — Language switcher uses ISO 639-1 codes

Header switcher now shows `EN` / `DE` / `FA` / `AR` / ... (2-letter
uppercase) instead of native names like "English" / "Deutsch" / "فارسی".
Industry standard (Apple, Google, GitHub, Wikipedia). Native name is
preserved as the `title` attribute on each `<option>` for hover
disambiguation. Sorani Kurdish uses `KU` (no ISO 639-1 code exists).

### Changed — Methodology page expanded

`/methodology` gets a new "Photo Provenance & Storage" section between
Deduplication and Auto-update workflow. Five bullets covering mirror,
provenance preservation, perceptual dedup, health monitoring, and
candle fallback. Translated in all 16 languages.

### Changed — Compose dependency resilience

Memorial-app's `depends_on: meili: condition: service_healthy` switched
to `service_started`. Search is degradeable; the app should boot even
if meili is briefly unhealthy during a parallel build. Plus added
`start_period: 30s` to the meili healthcheck for boot-time grace.

### [Unreleased]



A full audit of the public read surface, captured in
[`docs/SECURITY-AUDIT-2026-05-09.md`](docs/SECURITY-AUDIT-2026-05-09.md). All
five priorities shipped:

- **P0 — DB-level read-only enforcement.** New Postgres role
  `memorial_readonly` with `GRANT SELECT` only. New Prisma client
  `prismaReadOnly`. All five MCP routes plus `/api/v1/public/dump` route
  through it. INSERT as the readonly role is rejected by Postgres with
  `permission denied for table …` — defence-in-depth that doesn't rely on
  application code being bug-free.
- **P1 — App rate-limit on `/api/mcp/*`.** Per-IP sliding-window limits
  (30–120/min depending on endpoint) layered on top of Cloudflare. 429
  responses are written to `api_usage` for abuse detection.
- **P2 — Origin firewall.** nginx now allowlists Cloudflare's published IP
  ranges; direct hits to the origin IP return 403. Weekly cron refreshes
  the IP list from `cloudflare.com/ips-{v4,v6}`.
- **P3 — Access logging for MCP.** `api_usage.api_key_id` is now nullable
  (migration `20260509020000_api_usage_nullable_key`); MCP routes log with
  `apiKeyId IS NULL` so existing abuse queries cover the public surface.
- **P4 — Translation noise.** `CommentSection` referenced `t("loading")`
  and `t("submit")` at the wrong namespace, flooding production logs with
  `MISSING_MESSAGE`. Redirected to `common.loading` and `common.submit`.

### Added — MCP server + public read-only API for LLM integrations

Bundled stdio server in [`tools/mcp/`](tools/mcp/) using
`@modelcontextprotocol/sdk`. Five tools: `search_victims`, `get_victim`,
`get_executions`, `get_death_row`, `get_statistics`. Same surface as plain
HTTP under `/api/mcp/*` for non-MCP clients. CORS-enabled, no auth.
Compatible with Claude Desktop, Cursor, Cline, ChatGPT-via-MCP.

### Changed — `/developers` page redesigned (Hospitable-style)

Three-card hero ("Choose your integration") routes the user to MCP / REST /
Bulk dump. Sticky sidebar TOC with eight anchored sections. Each section
has a colour-coded pill (public·read-only / bearer auth / CC BY-SA 4.0).
ReDoc moved to a collapsible `<details>` at the end so it doesn't dominate
the page. New rate-limits and license sections.

### Changed — Domain-portable site URL

65 hardcoded references to `<DEPLOYMENT_DOMAIN>` across 20 runtime files
removed. Single source of truth at [`lib/site-url.ts`](lib/site-url.ts)
sourced from `NEXT_PUBLIC_SITE_URL` env var. Domain change is now a
two-second job: edit the env, redeploy.

### Added — Open-source readiness

- [`LICENSE`](LICENSE) — MIT for code, CC BY-SA 4.0 for data, with explicit
  rules for which file lives under which licence.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — data-ethics ground rules, plugin
  development guide, what we do and don't accept.
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting + posture summary.

### Fixed — `lib/queries.ts` dedup query

Replaced two correlated `(SELECT count(*) FROM …)` subqueries with grouped
`LEFT JOIN` aggregates. Wall time dropped from "timeout after 30 s" to
~0.7 s for the full 32 K-victim load. The `dedup --apply` tool was
unusable for months because of this.

### Fixed — Vahid Telegram plugin

Three drift bugs in `tools/enricher/sources/telegram_vahid.py` against the
current `SourcePlugin` base contract — wrong `fetch_with_retry` signature,
unknown `note` kwarg on `ExternalVictim`, missing `_sleep` method. Plugin
runs again, although Farsi-only-name imports still need transliteration
work to avoid slug collisions.

## [0.15.0] - 2026-05-03

### Trust & Reach Release

A focused sprint to make the database citable, embeddable, and self-explanatory for journalists, researchers, and partner NGOs.

### Added — `/methodology` Page (7 languages)

Public explanation of the verification system, source registry, and update workflow:

- **Three-tier credibility model:** high / reputable / community, with public criteria
- **Auto-verification rules (A/B/C):** documented and live-counted
- **Source registry table:** 15 organizations with credibility, type, country
- **Deduplication methodology:** name normalization, date window, score bands
- **Auto-update workflow:** cron schedule for witness/hrana/hengaw
- **Known limitations:** honest accounting of pre-2000 gaps + transliteration drift
- **Citation block:** academic citation + CC BY-SA 4.0 link

### Added — Source Credibility Badges

Every source citation on `/victims/[slug]` shows a colored chip (●/○) reflecting the source's credibility tier. `lib/credibility.ts` maps via DB FK first, URL-pattern fallback second, so legacy Source rows without `dataSourceId` still get classified.

### Added — Verified Chip on Victim Cards

Small emerald check-circle next to verified victim names on `/victims`, `/executions`, and event listings. Localized tooltip in 7 languages.

### Added — RSS + JSON Feeds

- `/feed.xml` — RSS 2.0 + Media RSS namespace for thumbnails
- `/feed.json` — JSON Feed 1.1 with `tags: ["verified", ...]`
- Top 50 newly documented victims, ordered by `createdAt`
- HTML autodiscovery `<link>` rels in root layout
- Footer link with RSS glyph

### Added — Embed Widget (`/embed`)

Iframe-friendly live counter for activist sites and partner NGOs:

- Three stats: total documented, verified, executions in current year
- Query params: `theme=dark|light&size=sm|md&locale=en/de/fa/ar/fr/it/es`
- RTL support for fa/ar
- Standalone layout (no header/footer/i18n shell)
- `next.config.ts`: split header rules so `/embed` allows `frame-ancestors *` while everything else stays strict
- `/embed-preview` (7 langs): landing page with 3 live previews + copy-paste snippet + URL parameter table

### Added — `/statistics` Trust-Block

- Verification-status bar with %
- Top-tier-per-victim list with credibility chips
- Sources-per-victim histogram (1, 2, 3-5, 6-10, 11+)
- Cross-link to `/methodology`

### Added — Two New Data Source Plugins (11th + 12th)

- `hrana` — HRANA article scraping with JSON-LD + body parsing (HIGH credibility, NGO)
- `hengaw` — Hengaw headline parser + body parser, Kurdish-region focus (HIGH credibility, NGO)
- Both use curl_cffi chrome120 impersonation for Cloudflare bypass
- Daily crons on Hetzner: HRANA 04:30 UTC, Hengaw 05:00 UTC

### Changed — Source FK Backfill + Auto-Verify Pass

Audit found that all 9,629 unverified victims had sources without `data_source_id` FK. The auto-verify rule only saw the FK, never the URL.

One-shot idempotent SQL (`tools/data/backfill-source-fk-and-verify.sql`):
- Registered 5 missing data_sources (hengaw HIGH, iranmonitor MEDIUM, witness-report LOW, iranintl MEDIUM, iranwire MEDIUM)
- Backfilled 51,509 source rows by URL pattern → data_source slug
- Re-ran auto-verify Rules A/B/C

**Result: verified count 27,328 → 31,255 (+3,927, +14%)**

### Added — Weekly Backfill Cron

- `tools/backfill_cron_runner.sh` — wraps the SQL with before/after snapshots
- Crontab: `0 6 * * 6` on Hetzner (Saturday 06:00 UTC, after all 3 source crons)
- Logs to `/var/log/iran-memorial/backfill.log`
- Idempotent: safe to re-run weekly without duplicating work

### Added — SEO Polish

- Sitemap split via `generateSitemaps()` into 40K-URL victim shards with hreflang alternates per victim (was capped at ~6.4K victims due to 50K single-sitemap limit; now indexes all 37K+)
- Victim Person JSON-LD enriched: `@id`, `nationality: Iran`, structured `deathPlace`, `gender`; conditional rendering so empty fields don't emit
- Robots: blocks `/admin` for all 7 locales (was 3)
- Root layout: full `alternateLocale` (fr/it/es), keywords, twitter @iran_memorial, googleBot `max-image-preview=large`

### Operations

- CI workflow re-enabled (`.github/workflows/test.yml`) with updated pytest deps (curl_cffi + asyncpg)

### Tests

- 7 new feed-helper tests (`__tests__/lib/feed.test.ts`)
- 15 new Hengaw plugin tests
- VictimCard test updated to match localized verified-tooltip prefix
- **Total: 809 tests** (552 Vitest + 257 pytest)

### Stats Snapshot (2026-05-03)

| Metric | Before sprint | After |
|---|---|---|
| Victims | 36,958 | 37,008 |
| Verified | 27,328 (74%) | 31,255 (84%) |
| Sources | 60,100 | 60,990 |
| Photos | 25,200 | 25,682 |
| Data sources | 13 | 17 |
| Tests | 769 | 809 |

### Audit: Remaining 5,753 unverified

Per-victim source-credibility audit confirms the remaining unverified records are *correctly* held back by the methodology rules:

- 4,530 community-only sources (witness.report, Telegram, X) — appropriately need a HIGH or 2+ MEDIUM citation
- 855 single-MEDIUM citation — appropriately needs corroboration
- 309 1-MEDIUM + 1 community pairing — Rule B requires 2+ MEDIUM (distinct organizations)
- 59 community-tier URLs only

No silent rule relaxation was applied; tampering with rules to bump numbers would weaken the trust claims this release was built around. Two new community data_sources (`telegram`, `twitter-x`) registered for `/sources` visibility — verification status unchanged.

---

## [0.14.0] - 2026-05-01

### Added — `/executions` Reiter

- Neue Seite `/executions` listet politische Gefangene auf, die hingerichtet wurden (Erhängen, Erschießung, andere staatliche Hinrichtungen)
- `getExecutedVictims()` in `lib/queries.ts` mit mehrsprachigen Cause-Filtern (execution/hanging/firing squad/اعدام/Hinrichtung)
- Header- und Footer-Navigation um den neuen Reiter ergänzt (zwischen Events und Karte)
- Lokalisierung in 7 Sprachen (de: Hinrichtungen, fa: اعدام‌ها, ar: الإعدامات, fr: Exécutions, it: Esecuzioni, es: Ejecuciones, en: Executions)
- Blutrotes "Im Gedenken"-Badge statt amber-Badge der `/imprisoned`-Seite
- Sortierung nach Sterbedatum absteigend, 50/Seite mit Pagination
- 23.189 Hinrichtungen live dokumentiert

### Added — `witness_report` Plugin (10. Datenquelle)

Community-getragene Iran-Detention/Execution-Registry mit ~14.500 Records:

- **API:** `https://witness.report/api/advancedsearch_list.php` (DataTables-Format, 200/Seite Server-Cap)
- **Target-Status (7):** Executed, Murdered, Murdered in custody, Shot to death, Imprisoned, Sentenced to death, Kidnapped (= Disappeared)
- **Skipped:** Arrested, Released, Released on bail, Escaped, Temporary detention, "Shot in eyes", Lost (zu transient)
- **Filter:** Iranische Nationalität (`is_iranian()`)
- **Detail-Pages nicht gescrapt:** Erfordern Google Login

**Ergebnisse:**
- 8.056 Records verarbeitet
- 2.968 Match auf bestehende Opfer
- 4.585 neue Opfer importiert (+14,2 % Wachstum: 32.394 → 36.979)
- 7.553 Quellen-Links + 7.553 Fotos hinzugefügt
- 21 Auto-Merge-Duplikate via Dedup entfernt → final 36.958

**Cloudflare-Workaround:** Hetzner-Server-IP wird von Cloudflare gechallenged, deshalb wird der HTTP-Cache lokal generiert und per rsync zum Server geshippt; das Enrichment läuft anschließend auf dem Server gegen die Production-DB ohne erneuten HTTP-Traffic.

### Tests

- 29 neue pytest-Tests (`tools/enricher/tests/test_witness_report.py`)
- Header-Test auf 9 Nav-Items angepasst
- **Total: 769 Tests** (544 Vitest + 225 pytest)

### Files

**Frontend:**
- `app/[locale]/executions/page.tsx` (152 Zeilen, neue Seite)
- `components/Header.tsx` + `Footer.tsx` (Nav-Link)
- `messages/{de,en,fa,ar,fr,it,es}.json` (`executions`-Key)
- `lib/queries.ts` (`getExecutedVictims()`)
- `__tests__/components/Header.test.tsx` (Link-Count)

**Enricher:**
- `tools/enricher/sources/witness_report.py` (245 Zeilen, neues Plugin)
- `tools/enricher/tests/test_witness_report.py` (29 Tests)

---

## [0.13.2] - 2026-02-17

### Fixed — UI Cleanup

**Navigation:**
- "Inhaftierte"-Link aus dem Header-Reiter entfernt (Seite über URL weiterhin erreichbar)
- Header-Test von +9 auf +8 Links angepasst

**Startseite:**
- "Aktuell: Neue Einträge — Aufstand Januar 2026"-Banner entfernt

### Tests

- 544 Vitest Tests, alle bestanden (unverändert)

---

## [0.13.1] - 2026-02-17

### Fixed — Bugfixes & Performance

**Foto-Bug (iranrights.org Hotlink-Protection):**
- `iranrights.org` blockiert server-seitige Anfragen des Next.js Image Optimizers (403 Forbidden)
- 1.941 Victims + 1.942 Photos betroffen
- Fix: `unoptimized={true}` für alle externen `https://` URLs in `VictimCard`, `PhotoGallery` (3× Image), `EventHero`, Victim Detail Page (2× Image)
- Der Browser fetcht direkt mit Referrer (200 OK) statt durch den Server-Optimizer

**Navigation:**
- "Quellen"-Link aus dem Header-Reiter entfernt (zu viele Einträge)

**Performance — `/imprisoned` Seite:**
- Root Cause: `prisma.victim.findMany({ where: { dateOfDeath: null } })` ohne Limit lud 1.755+ Datensätze
- Fix: Pagination mit 50 Einträgen/Seite (`skip`/`take` + `count` parallel)
- `getImprisonedVictims(page, pageSize)` in `lib/queries.ts` refaktoriert
- Gesamtanzahl wird im Header angezeigt
- Pagination-UI identisch zur Victims-Seite

**CSP:**
- `cdn4.telesco.pe` zu `img-src` + `remotePatterns` hinzugefügt (369 Victims mit Telesco.pe-Photos)

### Tests

- 544 Vitest Tests, alle bestanden (31 Dateien)
- Kein Rückgang — Header-Test von +10 auf +9 Links angepasst (nach Quellen-Entfernung)

---

## [0.13.0] - 2026-02-17

### Added — Frontend Overhaul

**Status-System:**
- `lib/status.ts` — `getCaseStatus()` leitet Runtime-Status aus `causeOfDeath` + `dateOfDeath` ab
- 6 Status-Typen: `executed | death_in_custody | killed | imprisoned | disappeared | deceased`
- `STATUS_CONFIG` mit Label-Maps (alle 7 Sprachen), Farb-Klassen
- VictimCard: Status-Badge (farbig, mit Punkt), Amber-Ring für Lebende

**Neue Seiten:**
- `/sources` — Datenquellen-Transparenzseite mit Credibility-Badges, Victim-Anzahl pro Quelle
- `/imprisoned` — Politische Gefangene (dateOfDeath=null), Amnesty International CTA
- `/admin/victims/new` — Admin-Formular zum Erstellen neuer Victim-Einträge

**Erweiterte Filter (Victims-Seite):**
- `FilterBar.tsx`: Case-Type-Dropdown (Execution, Death in Custody, Killed, Imprisoned) + Verified-Toggle
- `lib/queries.ts`: `buildFilterFragment` mit `verified` + `caseType` Filtern
- neue i18n-Keys: `allCaseTypes`, `caseExecution`, `caseCustody`, `caseKilled`, `caseImprisoned`, `verifiedOnly`

**Victim Detail:**
- Status-Badge in Header, Inhaftierungs-Notice für Lebende
- ShareButtons-Komponente (Copy Link, X/Twitter, Facebook)
- JSON-LD: `deathDate` nur wenn nicht null
- Related Victims Section (gleiche Veranstaltung, 6 Cards im Grid)

**Homepage:**
- Aktuelles-Banner (Jan 2026 Aufstand) mit "View"-Link
- Notable Cases Section (6 hardcodierte prominente Fälle)

**i18n:** Alle 7 Sprachdateien (en/de/fa/ar/fr/it/es) mit neuen Keys aktualisiert

**Admin API:**
- `POST /api/admin/victims` — Erstellt neuen Victim-Eintrag mit Slug-Kollisions-Erkennung

### Tests

- 544 Vitest Tests, alle bestanden (31 Dateien, 1.9s)

---

## [0.12.2] - 2026-02-17

### Added — Prominente Fälle: Hinrichtungen + Inhaftierungen

**Hinrichtungen (bereits vollzogen):**
- **Kaveh Panahi** (کاوه پناهی) — Hingerichtet 7. Jan 2026, Zentralgefängnis Yazd, Moharebeh-Anklage, Quelle: Hengaw
- **Ali Nirang** (علی نیرنگ) — Hingerichtet 7. Jan 2026, Zentralgefängnis Yazd, gemeinsamer Fall mit Panahi, Quelle: Hengaw
- **Jamshid Sharmahd** (جمشید شارمهد) — Deutsch-iranischer Dissident, entführt in Dubai 2020, hingerichtet 28. Okt 2024; Deutschland wies iranische Diplomaten aus; OHCHR: Opfer willkürlicher Inhaftierung
- **Mohammad Mahdi Karami** (محمد مهدی کرمی) — Natl. Karate-Meister, 21 Jahre, hingerichtet 7. Jan 2023 in Karaj; WLF-Proteste 2022; Efsad-fel-arz-Anklage; 15 Min. für Verteidigung
- **Seyed Mohammad Hosseini** (سیدمحمد حسینی) — Natl. Kickbox-Meister, 39 Jahre, hingerichtet 7. Jan 2023 in Karaj; WLF-Proteste 2022; beim Friedhofsbesuch verhaftet
- **Mohammad Ghobadlou** (محمد قبادلو) — 23 Jahre, hingerichtet 23. Jan 2024; Moharebeh; dokumentierte Bipolar-Störung; Oberstes Gericht hatte Todesurteil annulliert — wurde ignoriert

**Aktuelle Inhaftierung:**
- **Fatemeh Sepehri** (فاطمه سپهری) — Politische Aktivistin, Mutter von 4 Kindern, verwitwet seit 1982; verhaftet 21. Sep 2022; 18 Jahre Haft im Vakilabad-Gefängnis Mashhad; Quelle: IGFM

SQL-Skripte: `tools/data/add-jan-2026-moharebeh-executions.sql`, `tools/data/add-2022-protest-executions.sql`, `tools/data/add-jamshid-sharmahd.sql`, `tools/data/add-fatemeh-sepehri.sql`

## [0.12.1] - 2026-02-17

### Added — Daten: Todesfälle in Haft (Januar 2026-Aufstand)

**Quelle:** Iran International, 6. Februar 2026 (https://www.iranintl.com/en/202602068911)

- **Mohammad-Amin Aghilizadeh** — Jugendlicher aus Fooladshahr (Isfahan), nach Verhaftung in Haft gestorben; Leiche mit Schusswunden am Kopf; Familie wurde zunächst um Kaution gebeten
- **Javad Molaverdi** — Karaj, nach Schrotschuss-Verletzung bei Protesten verhaftet, ins Ghezel-Hesar-Gefängnis verlegt, Leiche auf Friedhof aufgefunden; keine offizielle Todesursache mitgeteilt

Beide Fälle: `cause_of_death = 'Death in custody'`, `data_source = 'iran-international'`, `verification_status = 'unverified'`
SQL-Skript: `tools/data/add-feb-2026-custody-deaths.sql` (idempotent, applied to local + production)

## [0.12.0] - 2026-02-17

### Added — Duplicate Detection Cache, Victim Edit, Data-Quality API

**Option 1 — Duplicate Detection (pre-computed cache)**
- New `duplicate_candidates` table + migration `20260217130000` for cached results
- `POST /api/admin/duplicate-scan` — runs 55s trigram similarity scan (up to 200 pairs), stores in table, preserves confirmed/dismissed statuses across scans
- `GET /api/admin/duplicate-scan` — reads cached candidates instantly (no heavy query on page load)
- `PATCH /api/admin/duplicate-scan` — update pair status (confirmed / dismissed / pending)
- `/admin/data-quality` converted to client component: async data fetch, "Run Scan" button with live feedback, confirm/dismiss actions per pair, last-scanned timestamp

**Option 2 — Admin Victim Edit**
- `GET /api/admin/victims?slug=...` — fetch victim fields for editing
- `PATCH /api/admin/victims` — update identity, death, circumstances, verification status
- `/admin/victims/[slug]/edit` — full edit form with sections: Identity, Death, Circumstances (EN+FA), Admin (verification, data source, notes)
- Linked from duplicate detection table ("Edit A" button)

## [0.11.1] - 2026-02-17

### Fixed
- **Data-quality page timeout**: Duplicate detection query (O(n²) self-join) timed out on 30k+ records
  — wrapped in `$transaction` with `SET LOCAL statement_timeout = '8000'`, filtered out 'Unknown'
  names and names shorter than 6 chars, returns empty array on timeout

## [0.11.0] - 2026-02-17

### Added — Search & Admin Improvements

**Option 2 — Search Improvements (migration 20260217120000)**
- `unaccent` PostgreSQL extension — accent-insensitive search (e.g. "amini" finds "Amīnī")
- New text search config `simple_unaccent` — combines unaccent + simple tokenizer
- GIN trigram indexes on `name_latin` + `name_farsi` for faster fuzzy matching
- Updated search vector trigger to use `simple_unaccent` on Latin names
- Rebuilt all 30,796 search vectors with new config
- Updated all `to_tsquery('simple', ...)` calls to `to_tsquery('simple_unaccent', unaccent(...))`

**Option 3 — Admin Data-Quality Dashboard (`/admin/data-quality`)**
- Overview cards: % verified, % with photo, % with date of death, % with circumstances
- Missing fields bar chart (9 fields, ranked by % missing)
- Verification status breakdown with progress bars
- Top data sources table with verified counts
- **Potential duplicates** table: trigram similarity > 85%, color-coded (red ≥95%, yellow ≥90%)

**Option 1 — 2026 Data Research (Verified)**
- Confirmed: all major January 2026 uprising cases already in DB via iranvictims-csv-import
  (Mehdi Zatparvar, Mansoureh Heidari Bushehri, Behrouz Mansouri, Bahar Hosseini 3yo,
  Hamidreza Sabet Esmaeilpour, Setayesh Shafiei + 13 Tehran victims Jan 8-9)
- Context: 2026 Iran massacres — 400+ cities, 500+ killed by Jan 11, 1,449 martyrs documented

### Files Modified
- `prisma/migrations/20260217120000_search_improvements/migration.sql` — new migration
- `lib/queries.ts` — all tsquery calls updated to simple_unaccent
- `app/[locale]/admin/data-quality/page.tsx` — new admin page

---

## [0.10.2] - 2026-02-17

### Added — Data Entry: Pouria Hamidi (پوریا حمیدی)

**Manually documented victim** — politically-motivated suicide, February 2026

- **Name:** Pouria Hamidi (پوریا حمیدی), 28 years old, from Bushehr
- **Cause:** Suicide (politically motivated) — died after recording final video addressed to Donald Trump and Western governments urging them not to negotiate with the Islamic Republic
- **Video:** "This Is My Sacrifice – Please, Free My Country" (YouTube, PoorY X, ~10 min, English)
- **Context:** Claimed 40,000+ killed in government crackdowns; expressed despair at the regime's systematic repression; stated "We, the people of Iran, are lonely people"
- **Note:** Some sources questioned official suicide narrative, alleging possible regime involvement (unverified)
- **Sources:** Iran International, Daily Wire, Republic World, YouTube video
- **SQL script:** `tools/data/add-pouria-hamidi-2026.sql` (idempotent, for server deployment)

> These cases of politically-motivated suicide caused by the Islamic Republic's repression are an integral part of this memorial. Without the regime, these people would still be alive.

---

## [0.10.1] - 2026-02-17

### Added — Memorial Features

**JSON-LD Structured Data (SEO)**
- Added `Person` schema markup to all victim detail pages
- Fields: `name`, `alternateName` (Farsi), `birthDate`, `deathDate`, `deathPlace`, `image`, `description`, `sameAs` (source URLs)
- Improves Google discoverability and enables rich search results for victims

**Related Victims Section**
- New `getRelatedVictims()` query: fetches up to 6 co-victims from the same historical event
- Displays photo thumbnail, name, date of death as a clickable card grid
- "See all victims from this event" link to the event page
- Multilingual labels in all 7 languages (en/de/fa/ar/fr/it/es)
- Positioned between the Comment Section and Sources

### Files Modified
- `app/[locale]/victims/[slug]/page.tsx` — JSON-LD script injection + RelatedVictims grid
- `lib/queries.ts` — `getRelatedVictims()` function
- `messages/*.json` — `relatedVictims` + `seeAllFromEvent` keys (all 7 languages)

---

## [0.10.0] - 2026-02-17

### Added — Webhook System

**Webhook Delivery (`lib/webhooks.ts`)**
- `triggerWebhooks(event, data)` — fires HMAC-SHA256 signed POST requests to all active subscribers
- `verifyWebhookSignature(body, sig, secret)` — constant-time signature verification for receivers
- Fire-and-forget delivery: webhooks never block the main request flow
- 10-second timeout per delivery, graceful failure handling

**Triggered Events**
- `victim.created` — fired when an approved submission is converted to a Victim record
- `submission.approved` — fired when an admin approves a community submission

**Admin Webhook CRUD (`app/api/admin/webhooks/route.ts`)**
- GET: list all webhooks (filterable by API key)
- POST: create webhook (URL, events array, auto-generated HMAC secret)
- PATCH: toggle active status
- DELETE: remove webhook

**Test Suite (+32 tests)**
- `__tests__/lib/webhooks.test.ts` (13 tests): signature verification, trigger behavior, parallel delivery
- `__tests__/api/admin/webhooks-route.test.ts` (19 tests): all CRUD operations + auth

### Testing
- **544 Vitest tests** passing (previously 512)
- **Total: 680 tests** (Vitest + pytest)

---

## [0.9.5] - 2026-02-17

### Fixed — CI/CD Cross-Platform Compatibility

**Root Cause:** macOS-generated `package-lock.json` omits Linux-native binaries (npm Bug #4828).
When CI runs `npm ci` on ubuntu-latest, platform-specific optional packages are missing from the lock file.

**Fixes Applied:**

1. **`@swc/helpers` version bump** — Updated to `0.5.18` to satisfy `@swc/core@1.15.11` peer dependency (`>=0.5.17`). Lock file regenerated with Node 22 to match `.nvmrc`.

2. **Linux optional dependencies added** — Explicit `optionalDependencies` in `package.json`:
   - `@rollup/rollup-linux-x64-gnu@4.57.1` — Rollup native binary for Linux
   - `@parcel/watcher-linux-x64-glibc@2.5.6` — Next.js file watcher on Linux
   - `lightningcss-linux-x64-gnu@1.30.2` — Tailwind v4 CSS compiler (Lightning CSS)
   - `@tailwindcss/oxide-linux-x64-gnu@4.1.18` — Tailwind v4 Oxide engine
   - `@esbuild/linux-x64@0.27.3` — ESBuild native binary for Linux
   - `@unrs/resolver-binding-linux-x64-gnu@1.11.1` — Module resolver for Next.js

3. **CI workflow updated** — `npm ci` → `npm install --prefer-offline` to install platform-specific optional packages missing from lock file.

4. **`vitest.config.ts` TypeScript fix** — Removed `minThreads`/`maxThreads` which were removed in Vitest 4 and caused TypeScript compile error during Next.js build check.

### Files Modified
- `package.json` — Added 6 linux optional dependencies + `@swc/helpers`
- `package-lock.json` — Regenerated with Node 22, includes linux native binaries
- `.github/workflows/test.yml` — `npm ci` → `npm install --prefer-offline`
- `vitest.config.ts` — Removed invalid `minThreads`/`maxThreads` properties

### Testing
- **CI: All 3 jobs passing** (Vitest, pytest, Next.js Build) — previously failing on every push
- **512 Vitest tests** passing (local + CI)
- **136 pytest tests** passing

---

## [0.9.4] - 2026-02-16

### Added — Phase 3C (API Testing) + Test Infrastructure Fix

**API v1 Test Coverage (+56 Tests)**
- Comprehensive tests for missing API v1 endpoints
  - `events-route.test.ts` (17 tests) — Event retrieval, filtering, photo inclusion
  - `sources-route.test.ts` (20 tests) — Data sources, credibility ratings, multilingual support
  - `victims-slug-route.test.ts` (19 tests) — Single victim retrieval, relations, 404 handling

### Fixed — Worker Timeout Issue

**Vitest Configuration**
- Switched from `forks` pool to `threads` pool (Vitest 4 syntax)
- Added `minThreads: 1`, `maxThreads: 4` for optimal parallelism
- Eliminated all 13 worker timeout errors

**Performance Improvements:**
- Test duration: 95.21s → 33.87s (**3x faster**)
- Tests passing: 260 → 512 (**+252 tests**)
- Worker timeouts: 13 → 0 (**100% stability**)

### Files Modified
- `vitest.config.ts` — Pool configuration update (Vitest 4 compatibility)

### Files Added
- `__tests__/api/v1/events-route.test.ts` — 17 tests for events endpoint
- `__tests__/api/v1/sources-route.test.ts` — 20 tests for sources endpoint
- `__tests__/api/v1/victims-slug-route.test.ts` — 19 tests for victim detail endpoint

### Testing
- **512 Vitest tests** passing (previously 260)
- **136 pytest tests** passing (unchanged)
- **Total: 648 tests** (previously 396)
- **Duration: 33.87s** (previously 95.21s)

## [0.9.3] - 2026-02-16

### Added — Timeline Event Descriptions (Multilingual)
- **Event short descriptions** in all 7 languages (en, de, fa, ar, fr, it, es)
  - 12 historical events with 127-159 character descriptions
  - Translated from German source descriptions (Kurzbeschreibungen)
  - Timeline component automatically displays localized descriptions
- Database columns for new languages
  - `description_ar` (Arabic)
  - `description_fr` (French)
  - `description_it` (Italian)
  - `description_es` (Spanish)
- Migration 20260216235020
  - Added 4 new description columns to `events` table
  - Fixed GIN index for `search_vector` column (removed invalid `gin_trgm_ops` operator for tsvector type)

### Technical Details
- **SQL Quoting:** PostgreSQL dollar-quoting (`$$`) used for handling apostrophes in French/Italian/Spanish text
- **Tool Created:** `tools/get-event-descriptions.ts` — Prisma-based script to fetch event descriptions
- **SQL File:** `tools/translate-event-descriptions.sql` — Contains all 12 event translations (72 UPDATE statements)

### Events Translated
1. revolution-1979 — Iranian Revolution (1979)
2. post-revolution-executions — Summary executions (1979)
3. cultural-revolution-1980 — University closures (June 1980)
4. iran-iraq-war — Eight-year war with Iraq (1980-1988)
5. reign-of-terror-1981-1985 — Mass executions campaign
6. chain-murders — Systematic assassinations (1988-1998)
7. massacre-1988 — Prison massacre (Summer 1988)
8. student-protests-1999 — Tehran University raids (July 1999)
9. green-movement-2009 — Post-election protests (2009)
10. bloody-november-2019 — Fuel price protests (November 2019)
11. woman-life-freedom-2022 — Mahsa Amini protests (2022-)
12. massacres-2026 — Nationwide crackdown (2026)

### Files Modified
- prisma/schema.prisma — No changes (migration only)
- prisma/migrations/20260216235020_add_multilingual_event_descriptions/migration.sql — New migration

### Files Added
- tools/get-event-descriptions.ts — TypeScript utility for fetching descriptions
- tools/translate-event-descriptions.sql — Translation SQL script

### Testing
- 260 Vitest tests passed (13 files with worker timeouts)
- 136 pytest tests passing (unchanged)
- All database migrations applied successfully (local + production)

### Deployment
- Server: <HETZNER_IP> (<DEPLOYMENT_DOMAIN>)
- Database: Migration applied to production
- Docker rebuild: ✓ Successful
- Timeline verified in all languages

## [0.9.2] - 2026-02-16

### Added — Multilingual Expansion (7 Languages)
- **French (fr)**, **Italian (it)**, **Spanish (es)** language support
  - Added to i18n/config.ts locales array (4 → 7 languages)
  - Locale mappings for date/number formatting (fr-FR, it-IT, es-ES)
  - Database field suffix mappings (Fr, It, Es)
  - Verified badge translations (Vérifié, Verificato, Verificado)
- Translation files created (English fallback)
  - messages/fr.json (231 keys)
  - messages/it.json (231 keys)
  - messages/es.json (231 keys)
- Static site generation: 105 pages (7 locales × 15 routes)

### Changed
- Build output: 53 → 105 static pages generated
- Navigation: Language switcher now shows 7 options

### Files Modified
- i18n/config.ts — Added fr/it/es locales, names, directions
- lib/utils.ts — Added fr-FR/it-IT/es-ES to both localeMaps
- lib/queries.ts — Added Fr/It/Es suffixes to suffixMap
- components/VictimCard.tsx — Added fr/it/es verified badge translations

### Files Added
- messages/fr.json — French translations (English fallback)
- messages/it.json — Italian translations (English fallback)
- messages/es.json — Spanish translations (English fallback)

### Testing
- Build: ✓ Successful (Next.js 16.1.6, TypeScript ✓)
- 245 Vitest tests passing (unchanged)
- 136 pytest tests passing (unchanged)
- Total: 381 tests

### Deployment
- Server: <HETZNER_IP> (<DEPLOYMENT_DOMAIN>)
- Docker rebuild: ✓ Successful
- Live URLs verified:
  - <DEPLOYMENT_URL>/fr (French)
  - <DEPLOYMENT_URL>/it (Italian)
  - <DEPLOYMENT_URL>/es (Spanish)

## [0.9.1] - 2026-02-16

### Added — Phase 2B Completion
- **"Convert to Victim" button** in Admin Panel approved submissions tab
  - Calls existing POST `/api/admin/submissions/[id]/convert` endpoint
  - Creates new victim record with `verificationStatus = "unverified"`
  - Generates unique slug from victim name
  - Adds source record linking to submission
  - Updates submission status to "converted"
  - Success/error message feedback
  - Auto-removes converted submission from list
- Phase 2B Schritt 7 (Submission → Victim Converter) now complete
  - Backend API existed since Phase 2, now has UI integration

### Changed
- AdminPanel Component: +57 lines (convertSubmission function, UI state management)
- SubmissionCard: New `isApproved`, `converting`, `onConvert` props

## [0.9.0] - 2026-02-16

### Added — Phase 3: Developer Experience & API Testing

**Phase 3A: Interactive API Documentation**
- Developer Portal (`/developers`) with ReDoc integration
  - Interactive OpenAPI 3.0 documentation UI
  - Memorial-themed dark design (gold accents)
  - Live API explorer with request/response examples
  - Quick start guide for partner integration
- Extended OpenAPI specification with complete schemas
  - All 5 v1 endpoints fully documented
  - Request/response examples for every endpoint
  - Error schemas (401, 429, 500)
  - Victim, Event, Statistics, DataSource schemas
- 11 new translation keys for developer portal (×3 languages = 33 keys)
- Navigation updated: "API Docs" → "Developers"

**Phase 3B: Partnership Analytics Dashboard**
- Admin analytics page (`/admin/partners`)
  - 3 summary cards: Total Requests, Active Partners, Requests (Last 7 Days)
  - Time-series chart for 30-day combined API usage
  - Partner breakdown table with stats
  - Top 10 endpoints global chart
- TimeSeriesChart component (`components/charts/TimeSeriesChart.tsx`)
  - Bar chart with hover tooltips
  - Locale-aware number formatting
  - Responsive design with dynamic height calculation
- Partner statistics query (`getPartnerStatistics()` in `lib/queries.ts`)
  - 5 parallel SQL queries for performance
  - Aggregates: total requests, last 7/30 days, endpoints, daily usage
  - Supports filtering by specific API key

**Phase 3C: Comprehensive API Test Suite**
- **101 new tests** added (144 → 245 total Vitest tests)
- Test coverage for all Phase 2/3 features:
  - `__tests__/lib/api-auth.test.ts` — 13 tests (API key verification, rate limiting, usage logging)
  - `__tests__/api/v1/victims-route.test.ts` — 29 tests (pagination, filters, response format, errors)
  - `__tests__/api/v1/statistics-route.test.ts` — 20 tests (locale param, response structure, error handling)
  - `__tests__/lib/queries-partners.test.ts` — 13 tests (partner stats, data aggregation, edge cases)
  - `__tests__/components/TimeSeriesChart.test.tsx` — 26 tests (rendering, tooltips, bar heights, locales)
- Updated existing tests:
  - Header.test.tsx: "apiDocs" → "developers" navigation
  - vitest.config.ts: Added Phase 3 files to coverage tracking

**Dependencies**
- `redoc` — OpenAPI documentation UI (93 packages)

### Technical Improvements
- Client Component pattern for browser-only libraries (ReDoc with `ssr: false`)
- Modular chart architecture (StatCard, Section, HorizontalBars, TimeSeriesChart)
- Test-driven development for all new API features
- Comprehensive edge case coverage (zero values, large datasets, locale variations)

### Files Added/Modified
- **New:** 7 files (1,590 lines)
  - `app/[locale]/developers/page.tsx` — Interactive API docs page
  - `app/[locale]/admin/partners/page.tsx` — Partnership analytics dashboard
  - `components/charts/TimeSeriesChart.tsx` — Time-series bar chart component
  - `__tests__/lib/api-auth.test.ts` — API auth tests
  - `__tests__/api/v1/victims-route.test.ts` — Victims endpoint tests
  - `__tests__/api/v1/statistics-route.test.ts` — Statistics endpoint tests
  - `__tests__/lib/queries-partners.test.ts` — Partner stats tests
  - `__tests__/components/TimeSeriesChart.test.tsx` — Chart component tests
- **Modified:** 6 files
  - `public/openapi.yaml` — Extended with complete schemas & examples
  - `lib/queries.ts` — Added `getPartnerStatistics()` query
  - `components/Header.tsx` — Added /developers link
  - `components/charts/index.ts` — Exported TimeSeriesChart
  - `messages/{en,de,fa}.json` — 11 new keys (developers.*)
  - `vitest.config.ts` — Coverage tracking for Phase 3 files
  - `__tests__/components/Header.test.tsx` — Updated for "developers" nav

### Testing
- **245 Vitest tests** passing (+101)
- **136 pytest tests** passing (unchanged)
- **Total: 381 tests** (+101)
- Test coverage: 90%+ for Phase 3 features
- Build: ✓ Successful (Next.js 16.1.6, TypeScript ✓)

### Fixed
- **Critical:** Prisma.empty conditional bug in `getPartnerStatistics()`
  - Root cause: `Prisma.empty` is truthy (object), not falsy
  - Symptom: `ERROR: syntax error at or near "GROUP"` on `/admin/partners` page
  - Fixed: Check `apiKeyId` instead of `whereCondition` in SQL conditionals
  - Affected queries: Query 2, 3, 5 (requests in last 7/30 days, daily usage)
  - Resolution: 3 hours debugging, 3 failed --no-cache rebuilds, identified via strategic console.log()
- SQL table alias consistency in `getPartnerStatistics()`
  - Query 1 uses `au` alias (LEFT JOIN), Queries 2-5 use no alias
  - Split `whereCondition` into `whereConditionWithAlias` and `whereCondition`

### Deployment
- No database migrations required (uses existing Phase 2 tables)
- Docker rebuild required: `docker compose up -d --build app`
- New pages deployed: `/developers`, `/admin/partners`

## [0.8.0] - 2026-02-16

### Added — Phase 2: Open API & Partnership Infrastructure

**Phase 2A: API v1 with Authentication**
- API key authentication system (ApiKey + ApiUsage models)
- Bearer token authentication (`Authorization: Bearer iran_mem_...`)
- Rate limiting per API key (default: 1000 requests/hour vs public 10/hour)
- Usage logging for analytics and monitoring
- 5 new API v1 endpoints:
  - `GET /api/v1/victims` — List with filters (event, province, year, gender, verified)
  - `GET /api/v1/victims/[slug]` — Single victim with full relations
  - `GET /api/v1/events` — All events with victim counts
  - `GET /api/v1/statistics` — Global statistics (localized)
  - `GET /api/v1/sources` — Data sources with credibility ratings
- Admin API key management: `GET/POST/PATCH/DELETE /api/admin/api-keys`

**Phase 2B: UI, Docs & Integration**
- Admin UI for API key management (`/admin/api-keys`)
  - Create, activate/deactivate, delete API keys
  - View usage stats and last used timestamp
  - Form validation and rate limit configuration
- Comment system integration
  - CommentSection component with form + display
  - Integrated into all victim detail pages
  - Rate-limited submissions (10/hour per IP)
  - Pending approval workflow
  - Fully multilingual (EN/DE/FA)
- OpenAPI 3.0 specification (`/public/openapi.yaml`)
  - Complete v1 API documentation
  - Authentication, rate limits, schemas
  - Ready for Swagger UI integration
- Submission converter API (`POST /api/admin/submissions/[id]/convert`)
  - Convert approved submissions to Victim records
  - Auto-generate unique slugs
  - Create source attribution
  - Mark submission as "converted"

**Translation Updates**
- 11 new translation keys for comment system (×3 languages = 33 keys)

**Database**
- Migration `20260216110000_add_api_keys`
- New tables: `api_keys`, `api_usage`
- 8 indexes for performance

### Technical Improvements
- Consistent API error handling and response formats
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Fire-and-forget usage logging (non-blocking)
- Pagination with total pages metadata
- Backward compatibility maintained (old `/api/export` still works)

### Files Added/Modified
- **New:** 8 files (1,299 lines)
  - `lib/api-auth.ts` — API key verification & rate limiting
  - `app/api/v1/victims/route.ts` — List victims API
  - `app/api/v1/victims/[slug]/route.ts` — Single victim API
  - `app/api/v1/events/route.ts` — Events API
  - `app/api/v1/statistics/route.ts` — Statistics API
  - `app/api/v1/sources/route.ts` — Data sources API
  - `app/api/admin/api-keys/route.ts` — API key CRUD
  - `app/api/admin/submissions/[id]/convert/route.ts` — Submission converter
  - `app/[locale]/admin/api-keys/page.tsx` — Admin UI
  - `components/CommentSection.tsx` — Comment UI component
  - `public/openapi.yaml` — OpenAPI specification
- **Modified:** 5 files
  - `prisma/schema.prisma` — ApiKey + ApiUsage models
  - `app/[locale]/victims/[slug]/page.tsx` — Comment integration
  - `messages/{en,de,fa}.json` — Translation keys

### Testing
- **144 Vitest tests** passing (unchanged)
- **136 pytest tests** passing (unchanged)
- **Total: 280 tests** (all passing)
- Build: ✓ Successful (Next.js 16.1.6, TypeScript ✓)

## [0.7.6] - 2026-02-16

### Added
- **Telegram @VahidOnline Plugin**: Intelligent content filtering for mixed-content Telegram channel (934K subscribers)
  - Victim keywords vs. exclude keywords to filter ~30% victim posts from ~70% news/politics
  - Name parsing: underscore removal, parenthetical extraction, verb trimming
  - Jalali date conversion, age/location extraction
  - 24 new pytest tests (4 test classes: IsVictimPost, ParsePostText, ExtractPosts, ExtractPrevLink)
  - Plugin: `tools/enricher/sources/telegram_vahid.py`
- **DataSources Extension**: 2 new sources added (10 → 12 total)
  - `iranmonitor`: Structured API version of @RememberTheirNames (MEDIUM credibility, MEMORIAL_PROJECT)
  - `telegram-vahid`: Vahid Online citizen journalism channel (MEDIUM credibility, SOCIAL_MEDIA)
  - Migration: `20260216000000_add_iranmonitor_vahid_sources`
- **CI/CD Best Practice**: `.nvmrc` file for Node version synchronization
  - Prevents package-lock.json mismatches between local and CI environments
  - Workflow updated: `node-version: 22` → `node-version-file: '.nvmrc'`

### Fixed
- **GitHub Actions CI**: pytest dependencies (aiohttp, beautifulsoup4)
- **GitHub Actions CI**: package-lock.json regenerated with Node 22 (was Node 20)
  - Root cause: Node version mismatch between local and CI
  - Fix required 2 iterations (workflow update, then lock-file regeneration)

### Testing
- **144 Vitest tests** passing (unchanged)
- **136 pytest tests** passing (+24 for VahidOnline)
- **Total: 280 tests** (+24)

### Documentation
- LEARNINGS.md: Added v0.7.6 section (VahidOnline patterns, CI/CD best practice)
- CLAUDE.md: Version history updated, current stats (12 data sources, 280 tests)
- VISION.md: Added English executive summary (high-impact pitch for international audience)

## [0.7.5] - 2026-02-15

### Changed
- **Timeline Refactoring**: Event titles now link directly to `/events/[slug]` instead of expand/collapse
  - Always-visible event descriptions (displayed exactly as stored in DB)
  - Removed `truncateText()` function — user-formatted text displayed AS-IS
  - Commits: d8a2b7959 (initial), dcf5de4af (truncation improvement), 667415f4f (truncation removal)

### Added
- **DataSources Metadata Table**: New `data_sources` table for source organization metadata
  - 18 fields: slug, trilingual names/descriptions, credibility rating, source type, country, URL, etc.
  - 2 new enums: `SourceCredibility` (HIGH/MEDIUM/LOW/UNVERIFIED), `SourceType` (8 types)
  - 10 seed organizations: HRANA, Boroumand Center, Amnesty, IHR, UN FFM, Wikipedia, iranvictims, iranrevolution, Telegram RTN, Community
  - Optional FK relationship: `sources.data_source_id` → `data_sources.id`
  - Migration: `20260215180000_add_data_sources_table`

### Database Content
- 11 events updated with custom German descriptions (`description_de`)
- Events: revolution-1979, post-revolution-executions, iran-iraq-war, reign-of-terror-1981-1985, chain-murders, massacre-1988, student-protests-1999, green-movement-2009, bloody-november-2019, woman-life-freedom-2022, massacres-2026
- Deployed via SQL UPDATE statements (not tracked in git)

### Testing
- **144 Vitest tests** passing in 1.12s (13 test files)
- **112 pytest tests** passing in 0.11s (enricher suite)
- **Total: 256 tests**

## [0.7.4] - 2026-02-15

### Security
- Admin auth switched from "header exists" to allowlist-based (`ADMIN_USERS` env var)
- Zod validation on all admin endpoints (`z.string().uuid()`, `z.enum()`, `z.string().max(2000)`)

### Changed
- Google Fonts CDN → `next/font/google` self-hosting (eliminates 2 external requests)
- Image optimization enabled (removed `unoptimized` prop from all 7 `<Image>` components)
- Sitemap URL cap at 45,000 (Google limit: 50K)

### Added
- Accessibility improvements: `aria-label`, `aria-expanded`, `aria-pressed`, semantic HTML
- i18n for hardcoded strings (submit form, admin panel)

### Removed
- `NEXTAUTH_SECRET` from docker-compose (NextAuth never used)
- `@anthropic-ai/sdk` + `openai` from devDeps (only in tools/legacy/)

### Fixed
- BUG-017: AdminPanel camelCase vs. snake_case (backward-compatible `data.name_latin || data.nameLatin`)
- BUG-018: Wrong translation namespace (`ts` → `t` in victims/page.tsx)

## [0.7.3] - 2026-02-15

### Added
- **Event Statistics**: Per-event charts for province/cause/age/gender distribution
  - New query: `getEventStatistics()` in `lib/queries.ts`
  - New component: `EventStatistics.tsx`
  - Shared chart components: `StatCard`, `Section`, `HorizontalBars` (extracted from statistics page)
  - Integration: Event detail page shows statistics when ≥10 victims
  - 20 new Vitest tests

### Fixed
- Map rendering issue: Leaflet CSS now imported from node_modules (not CDN)
- Map overflow: Wrapped in `overflow-hidden` div to prevent scrollbars

## [0.7.2] - 2026-02-15

### Added
- Province/City normalization in enricher: `city_id` resolution via 5-step backfill
- Homepage shows localized city names (via JOIN cities/provinces)
- 12 new pytest tests for city resolver

### Fixed
- Server deployment: Missing `_de` columns added via migration

## [0.7.1] - 2026-02-15

### Added
- **SEO**: Dynamic sitemap (30K+ victims, 12 events × 3 locales), robots.txt, Open Graph, Twitter Cards
- **Province/City DB Schema**: 31 provinces + 112 cities with coordinates (migration `20260215120000`)
  - 21,363 victims (69%) linked to cities via 5-step backfill
- **Comments API**: `GET/POST /api/comments` (pending/approved moderation, rate-limited)
- **Photo Upload API**: `POST /api/upload` (auth, file validation, auto-isPrimary)
- **CI/CD Pipeline**: GitHub Actions (Vitest + pytest + build)
- **E2E Tests**: Playwright test suite

### Changed
- IranMap coordinates from DB (not hardcoded)
- FilterBar province dropdown from DB query

### Data
- **Telegram RTN Full Run**: 2,709 posts, 2,070 photos added (+42%), 413 enrichments

## [0.7.0] - 2026-02-15

### Added
- **Interactive Map** (`/map`): Province-level visualization with Leaflet
- **Data Export API** (`/api/export`): JSON + CSV download (rate-limited: 10/hour)
- **API Documentation** (`/api-docs`): Live stats + 3 endpoints documented
- **Admin Review Panel** (`/admin`): Tab-based UI for submission review (auth via `X-Forwarded-User`)
- **Interactive Timeline** (upgrade): Zoom controls (50%-300%), click-to-expand event cards

## [0.6.1] - 2026-02-15

### Added
- **Telegram @RememberTheirNames Plugin**: New enricher source (2,709 entries)
  - Jalali date conversion (`utils/jalali.py`)
  - ~100 Farsi city mappings
  - 47 new pytest tests (enricher suite: 53 → 100)

## [0.6.0] - 2026-02-14

### Added
- **German Translation**: 7 `_de` columns in victims table
  - Batch translation script: `tools/translate_de.py` (GPT-4o-mini, asyncpg)
  - Semaphore-based concurrency (~1.7/s, ~$10 for 22K texts)
  - ~22K `circumstances_de` translated

## [0.5.1] - 2026-02-14

### Added
- **Enricher Upgrade**:
  - iranvictims: CSV-based import (7 fields, 4,791 entries)
  - iranrevolution: Supabase REST API plugin (with `circumstances_fa`)
  - Shared province mapping: `utils/provinces.py` (72 cities)
  - 53 pytest tests

## [0.5.0] - 2026-02-14

### Added
- **Enricher Framework**: WAT architecture (Workflows, Agents, Tools)
  - 6 plugins: boroumand, iranvictims, iranrevolution, wikipedia_wlf, iranmonitor, telegram_rtn
  - CLI: `python3 -m tools.enricher {list,check,enrich,dedup,status}`
- **Multi-Photo Support**: Polymorphic `photos` table (4,999 photos migrated)
- **Dedup Pipeline**: 5,318 duplicates removed (30,795 unique victims)
- **Timeline**: Interactive timeline with 12 historical events
- **force-dynamic**: All DB pages use dynamic rendering (no ISR, no SSG)

## [0.4.0] - 2026-02-13

### Data
- **Boroumand Historical Import**: 31,203 victims from 1979-2023 (5,318 dedups)
- Database: 30,795 unique victims, 43K+ sources

## [0.3.0] - 2026-02-12

### Added
- **Deployment**: Docker Compose (PostgreSQL + Next.js app)
- **AI Enrichment**: OpenAI GPT-4o-mini for bio summaries
- **Security Hardening**: Rate limiting, input validation

## [0.2.0] - 2026-02-09

### Data
- **Multi-Source Import**: 7 sources, 4,378 victims
- Sources: Wikipedia WLF, iranvictims, iranrevolution, iranmonitor, Telegram RTN, HRANA, IHR

## [0.1.0] - 2026-02-09

### Added
- **Initial Release**: Next.js 16, Prisma 6, PostgreSQL 16, next-intl (FA/EN/DE)
- 8 pages: Homepage, Victims (list + detail), Events (list + detail), Timeline, Submit, About
- Dark memorial design (Tailwind v4)
- Trilingual support with RTL for Farsi
- Docker setup
