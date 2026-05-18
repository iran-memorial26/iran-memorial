# Iran Memorial — یادبود قربانیان

**A digital memorial for the victims of the Islamic Republic of Iran (1979–present)**

> **They had names. They had faces. They had lives.**
> **Most of them were never properly documented.**

This project exists to break the silence.

---

## Live Project

**[<DEPLOYMENT_DOMAIN>](<DEPLOYMENT_URL>)**

**Current Status:** v0.17.0 — Security hardening (CSP nonce, SHA-256 API keys, Redis rate limiter, CI gate, SSRF/XSS fixes, Next.js 16.2.6)

| Metric | Count |
|--------|-------|
| **Victims Documented** | 37,008+ |
| **Verified** | 31,255 (84%) |
| **Photos archived** | 25,682+ (19,453 self-hosted as of 2026-05-11) |
| **Sources** | 60,990+ |
| **Data Sources** | 16 organizations |
| **Languages** | 16 (FA/EN/DE/AR/FR/IT/ES + HE/RU/TR/KU/HI/UR/SV/NL/ZH) |
| **Test Coverage** | 834 tests (559 Vitest + 275 pytest) |

---

## Mission

Every victim of the Islamic Republic of Iran deserves to be remembered — not as a statistic, but as a **human being** with a name, a face, and a story.

**What we do:**
- Document every known victim since 1979
- Preserve their stories with dignity and respect
- Create a permanent, verified historical record
- Make the data accessible and searchable
- Support truth, accountability, and justice

**What makes this different:**
- **Comprehensive**: Spans all eras (1979–present)
- **Verified**: 12 trusted data sources with credibility ratings
- **Multilingual**: 16 languages — Farsi, English, German, Arabic, French, Italian, Spanish, Hebrew, Russian, Turkish, Sorani Kurdish, Hindi, Urdu, Swedish, Dutch, Simplified Chinese (5 RTL: fa/ar/he/ckb/ur)
- **Open**: Public API v1 with Bearer auth, rate limiting
- **Independent**: No political agenda, non-commercial

---

## Features

### Interactive Map
Province-level visualization showing victim distribution across Iran. Built with Leaflet + react-leaflet.

### Statistics Dashboard
Visualize victims by year, province, cause of death, age, and gender. Per-event statistics available.

### Interactive Timeline
12 historical events from 1979 to 2026. Clickable event cards with descriptions in all 7 languages.

### Advanced Search
Full-text search powered by PostgreSQL `tsvector` + `pg_trgm` + `unaccent`. Filter by event, province, date range, case type, verified status.

### Victim Profiles
Each victim gets their own page with:
- Identity (name, age, photo)
- Life details (occupation, beliefs, personality)
- Death circumstances (date, location, cause)
- Case status badge (killed / executed / imprisoned / unknown)
- Related victims (same event, 6 cards grid)
- JSON-LD Person schema (SEO)
- Source documentation with credibility ratings

### Case Status System
- `killed` — protesters killed during demonstrations
- `executed` — executed by the state
- `imprisoned` — currently in prison (political prisoners)
- `unknown` — status unclear

### Political Prisoners Page (`/imprisoned`)
Lists all documented political prisoners (1,755+) with pagination (50/page), Amnesty International CTA.

### Data Sources Page (`/sources`)
Full transparency: all 15 data sources with credibility ratings and methodology.

### Verification Methodology (`/methodology`)
Public explanation of the 3-tier credibility system (high / reputable / community), the auto-verification rules (A/B/C), the deduplication algorithm, the cron schedule, and known limitations. Lives at [<DEPLOYMENT_DOMAIN>/methodology](<DEPLOYMENT_URL>/en/methodology) in 7 languages and is the citation page for journalists & researchers.

### Source Credibility Badges
Each source citation on a victim profile shows a colored chip (high / reputable / community) reflecting the source organization's credibility tier. Tier maps to the DB FK first, URL pattern fallback second.

### Photo Provenance & Storage (v0.16.0)
A memorial only works if the photos it shows remain available. Every external
photo URL is self-hosted on memorial-controlled infrastructure so victim faces
survive even when the source CDN expires (the Telegram public-CDN pattern).

- **Mirror.** Every photo (`photos.url` + legacy `victims.photo_url`) is
  downloaded on first sight to `/var/photos/<id-prefix>/<id>.<ext>`, served
  via a Next.js streaming route at `/photos/[...path]` with immutable
  cache headers. Currently **19,453 photos / 1.4 GB self-hosted**.
- **Provenance.** Original source URL is archived in `photos.original_url` /
  `victims.photo_original_url` for attribution and re-mirror.
- **Health monitoring.** Weekly cron HEAD-checks every external URL and
  marks broken ones (`photos.is_broken=true`) so they never reach the
  frontend. 4,720 expired Telegram-CDN URLs filtered to date.
- **Perceptual dedup.** Each mirrored file gets SHA-256 + 64-bit pHash.
  Exact duplicates hardlinked on disk (1,567 clusters, 169 MB freed).
  ~62k visually-similar pairs surfaced for admin review.
- **Candle fallback.** Whenever a photo cannot load, a candle SVG
  placeholder appears in its place — never a broken-image icon.
- **Reverse image search.** Admins can upload a photo or paste a photo
  id at `/admin/photo-search` to find similar faces already in the DB
  (via pg14 `bit_count(p.phash # $target)`).

### RSS + JSON Feeds (`/feed.xml`, `/feed.json`)
Top 50 newly documented victims, with verified-status tags. RSS 2.0 + Media RSS for thumbnails, JSON Feed 1.1 for modern tooling. Lets journalists and researchers subscribe instead of polling the API.

### Embed Widget (`/embed`)
Free iframe-friendly live counter for activist sites and partner NGOs. CC BY-SA 4.0 with attribution baked in. Themes (dark/light), sizes (sm/md), and 7 locales via URL params. Preview + copy-paste snippet at `/embed-preview`.

### Three integration paths

The platform exposes data through three deliberately distinct surfaces, each
sized for a different audience:

**1. MCP for AI agents — public, no auth**

Five tools any MCP-aware LLM (Claude Desktop, Cursor, Cline, ChatGPT-via-MCP)
can call directly. Same tools are also reachable as plain HTTP/JSON for
non-MCP clients. App-rate-limited per IP, **DB-level read-only enforced**.

| Tool | HTTP | Limit |
|---|---|---|
| `search_victims` | `GET /api/mcp/search?q=…` | 60/min |
| `get_victim` | `GET /api/mcp/victims/{slug}` | 120/min |
| `get_executions` | `GET /api/mcp/executions?method=&year=` | 30/min |
| `get_death_row` | `GET /api/mcp/death-row` | 30/min |
| `get_statistics` | `GET /api/mcp/statistics` | 30/min |

Local stdio server bundled in [`tools/mcp/`](tools/mcp/). Add to
`claude_desktop_config.json`:

```json
{ "mcpServers": { "iran-memorial": {
  "command": "node",
  "args": ["/path/to/iran-memorial/tools/mcp/dist/index.js"]
}}}
```

**2. REST API v1 — Bearer auth, 1000 req/h**

Five read endpoints under `/api/v1/*`. Bearer key requested by mail.
ReDoc spec at `/openapi.yaml`.

- `GET /api/v1/victims` — paginated list with filters
- `GET /api/v1/victims/:slug` — single profile
- `GET /api/v1/events` — timeline events
- `GET /api/v1/sources` — data-source registry
- `GET /api/v1/statistics` — aggregate counts

**3. Bulk dataset — public, CC BY-SA 4.0**

`GET /api/v1/public/dump` returns a single ~30 MB JSON of every victim.
Cloudflare-cached for an hour. Refreshed weekly by the enricher cron.

### Developer Portal (`/developers`)

Hospitable-style dev portal: sticky TOC, three-card hero (MCP / REST / Bulk),
sectioned docs for auth, rate limits, license. Full ReDoc reference
collapsed at the bottom.

### Webhook System
HMAC-SHA256 signed webhooks for real-time event notifications. Admin CRUD for webhook management.

### Admin Panel
- Review and approve community submissions
- "Convert to Victim" button (approved submissions → victim records)
- Photo upload with extension spoofing protection
- Victim creation form (`/admin/victims/new`)
- Victim edit form (`/admin/victims/[slug]/edit`)
- Pagination + status filter
- Duplicate detection cache (`duplicate_candidates` table, pre-computed trigram scan)
- Data-quality dashboard with Confirm/Dismiss duplicate actions
- Partnership Analytics (`/admin/partners`)
- **Reverse photo search** (`/admin/photo-search`) — upload an image or paste a photo id to find visually similar photos already in the DB via 64-bit pHash + Hamming distance

### Import Workflow
- `tools/check-duplicates.py` — fuzzy match against 30K+ DB victims
- `tools/import-victims.py` — CSV→DB with duplicate gate
- `workflows/add-victims.md` — SOP

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript (strict mode) |
| **Database** | PostgreSQL 16 (Docker, 37,008+ victims) |
| **ORM** | Prisma 6 |
| **Search** | PostgreSQL full-text search (`tsvector` + `pg_trgm` + `unaccent`) |
| **i18n** | next-intl, 16 locales (URL-based: `/fa/`, `/en/`, `/de/`, `/ar/`, `/fr/`, `/it/`, `/es/`, `/he/`, `/ru/`, `/tr/`, `/ckb/`, `/hi/`, `/ur/`, `/sv/`, `/nl/`, `/zh/`) |
| **Styling** | Tailwind CSS v4 |
| **Maps** | Leaflet + react-leaflet |
| **Testing** | Vitest (544 tests) + pytest (225 tests) |
| **Data Pipeline** | Python asyncpg + aiohttp (`tools/enricher/`) |
| **Deployment** | Docker Compose + Nginx |

---

## Quick Start

### Prerequisites
- Node.js 22 (see `.nvmrc`)
- Docker & Docker Compose
- PostgreSQL 16

### Installation

```bash
git clone https://github.com/iran-memorial26/iran-memorial.git
cd iran-memorial
npm install
docker compose up -d db
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Visit http://localhost:3000

### Testing

```bash
npm test
python3 -m pytest tools/enricher/tests/ -v
npm run build
```

---

## Data Pipeline

The **Enricher** is an async Python pipeline for importing, enriching, and deduplicating victim data from external sources.

### 12 Data Source Plugins + 1 Enrichment-Only Walker

Twelve bulk-import plugins (each subclasses `SourcePlugin` and enumerates
its source) plus one match-only walker (`grokipedia`) that iterates the
DB and probes per-victim rather than enumerating the source. See
`tools/enricher/pipeline/grokipedia.py` for the walker pattern.

| Plugin | Source | Type | Entries |
|--------|--------|------|---------|
| `boroumand` | Boroumand Foundation | API | 31,203 (1979–2023) |
| `iranvictims` | iranvictims.org | CSV | 4,791 |
| `iranrevolution` | iranrevolution.org | Supabase REST | API-based |
| `wikipedia_wlf` | Wikipedia WLF | Scraping | Manual |
| `iranmonitor` | Iran Monitor Memorial | API | Telegram RTN mirror |
| `telegram_rtn` | @RememberTheirNames | Telegram HTML | 2,709 posts |
| `telegram_vahid` | @VahidOnline | Telegram HTML | Mixed (30% victims) |
| `khrn` | Kurdistan Human Rights Network | Scraping | Hiwa political prisoners |
| `cpj` | Committee to Protect Journalists | REST API | 270 Iran records, 9 killed |
| `witness_report` | witness.report | DataTables JSON | 8,056 records (4,585 new + 2,968 enriched) |
| `hrana` | HRANA (Human Rights Activists) | JSON-LD scraping | Articles with name + photo extraction |
| `hengaw` | Hengaw (Kurdish HR org) | HTML scraping | Headline + article body parsing |
| `grokipedia` (walker) | grokipedia.com (xAI) | Per-victim probe | ~1,500 cross-refs added 2026-05-13. Match-only, never creates new victims, fills NULL `circumstances_en` only. Strict phrase-only name validation. Re-runs every 6 months via cron. |

### Permanent slug redirects

The `victim_slug_redirects` table captures old slugs after deduplication or
slug renames. `/victims/[slug]` issues a 308 to the surviving record on miss.
External links (Twitter, NGO reports, press citations, Google) keep landing
on the canonical record after a merge. Populated automatically by
`enricher dedup` and manually by operator scripts (see
`scripts/merge-sharmahd.py`).

### Usage

```bash
# Victim-record enrichment
python3 -m tools.enricher list
python3 -m tools.enricher check -s iranvictims -v
python3 -m tools.enricher enrich -s iranvictims --resume
python3 -m tools.enricher dedup --dry-run -v
python3 -m tools.enricher dedup --apply

# Photo pipeline (v0.16.0)
python3 -m tools.enricher photo-health --apply --recheck-broken      # mark dead URLs
python3 -m tools.enricher photo-mirror --apply --limit 100           # canary mirror
python3 -m tools.enricher photo-mirror --apply                       # full mirror
python3 -m tools.enricher photo-dedupe --hash-only                   # SHA + pHash
python3 -m tools.enricher photo-dedupe --hardlink                    # storage dedup
```

The `photo-health` job runs weekly via `/etc/cron.d/iran-photo-health`
(Sun 04:13 UTC) — re-checks all external photo URLs so newly-rotted
ones are filtered out automatically.

---

## Project Structure

```
iran-memorial/
├── app/[locale]/              # Pages (homepage, victims, events, executions, timeline, map, statistics, imprisoned, sources, developers)
├── components/                # UI components (VictimCard, ShareButtons, FilterBar, etc.)
├── lib/                       # Queries, translations, utilities (status.ts, etc.)
├── prisma/                    # Schema, migrations, seeds
├── tools/enricher/            # Data pipeline (10 plugins, 225 tests)
├── tools/check-duplicates.py  # Fuzzy duplicate checker
├── tools/import-victims.py    # CSV→DB import with duplicate gate
├── workflows/                 # SOPs (data import, dedup, deploy, add-victims)
├── docs/                      # LEARNINGS.md, VISION.md, PROJECT.md
├── __tests__/                 # Vitest test suite (544 tests)
└── docker-compose.yml         # PostgreSQL + App
```

---

## Data Sources

All data is aggregated from verified sources with credibility ratings:

| Organization | Type | Credibility |
|--------------|------|-------------|
| **HRANA** | Human Rights Org | HIGH |
| **Boroumand Foundation** | Memorial Project | HIGH |
| **Amnesty International** | Human Rights Org | HIGH |
| **Iran Human Rights (IHR)** | Human Rights Org | HIGH |
| **iranvictims.org** | Memorial Project | MEDIUM |
| **iranrevolution.org** | Memorial Project | MEDIUM |
| **Iran Monitor** | Memorial Project | MEDIUM |
| **Telegram @RememberTheirNames** | Social Media | MEDIUM |
| **Telegram @VahidOnline** | Citizen Journalism | MEDIUM |
| **Wikipedia (WLF)** | Crowdsourced | UNVERIFIED |
| **Kurdistan Human Rights Network (KHRN)** | Human Rights Org | HIGH |
| **Committee to Protect Journalists (CPJ)** | Human Rights Org | HIGH |
| **witness.report** | Community Database | MEDIUM |

**Total:** 15 data sources with full provenance tracking

---

## Documentation

| Document | Purpose |
|----------|---------|
| **[CLAUDE.md](CLAUDE.md)** | AI agent instructions (WAT framework, development) |
| **[CHANGELOG.md](CHANGELOG.md)** | Version history (v0.1.0 → v0.16.0) |
| **[docs/VISION.md](docs/VISION.md)** | Design philosophy and mission (EN + DE) |
| **[docs/LEARNINGS.md](docs/LEARNINGS.md)** | Technical decisions and patterns |
| **[docs/PROJECT.md](docs/PROJECT.md)** | Full project documentation |

---

## Timeline of Key Releases

| Version | Date | Highlights |
|---------|------|------------|
| **v0.16.0** | 2026-05-11 | Photo permanence & global reach: self-hosted photo mirror (19,453 photos), perceptual deduplication (SHA-256 + 64-bit pHash, 169 MB freed), candle fallback (no more broken-image icons), reverse image search admin tool (`bit_count` Hamming distance), photo-health weekly cron (4,720 expired Telegram-CDN URLs filtered), methodology page expanded with photo-provenance section, **9 new languages** (he/ru/tr/ckb/hi/ur/sv/nl/zh → 16 total), ISO 639-1 language switcher |
| **v0.15.0** | 2026-05-03 | Trust & reach release: `/methodology` page (7 langs), source credibility badges, RSS + JSON feeds, embed widget, source-FK backfill (+3,846 verified), `/statistics` trust-block |
| **v0.14.0** | 2026-05-01 | New `/executions` tab + 10th data source `witness_report` (8,056 records → 4,585 new victims, 36,958 total, 21 dedup-merges) |
| **v0.13.5** | 2026-02-17 | 35 missing 2026 victims imported (Jan 8-9), 9 duplicates caught; 30,843 total |
| **v0.13.4** | 2026-02-17 | Import workflow: check-duplicates.py, import-victims.py, add-victims.md SOP |
| **v0.13.3** | 2026-02-17 | Security hardening: 8 vulnerabilities fixed (SSRF, upload spoofing, secret exposure) |
| **v0.13.0** | 2026-02-17 | Frontend overhaul: case status system, /imprisoned, /sources, admin victim creation |
| **v0.12.0** | 2026-02-17 | Duplicate detection cache, victim edit form, data-quality improvements |
| **v0.11.0** | 2026-02-17 | Search: unaccent extension, GIN trigram indexes, admin pagination + status filter |
| **v0.10.0** | 2026-02-17 | Webhook system (HMAC-SHA256 signed, admin CRUD, 32 new tests) |
| **v0.9.2** | 2026-02-16 | Multilingual expansion: French, Italian, Spanish (7 languages total) |
| **v0.9.0** | 2026-02-16 | Developer experience: ReDoc portal (/developers), partnership analytics |
| **v0.8.0** | 2026-02-16 | Open API v1: 5 endpoints, Bearer auth, rate limiting, admin API keys |
| **v0.7.6** | 2026-02-16 | VahidOnline plugin, 12 data sources, CI/CD best practices |
| **v0.6.0** | 2026-02-14 | German translation (22K texts via GPT-4o-mini) |
| **v0.4.0** | 2026-02-13 | Boroumand historical import (31,203 victims) |
| **v0.1.0** | 2026-02-09 | Initial release (Next.js 16, Prisma 6, trilingual) |

---

## Security

**Defense-in-depth read-only model** for everything public. Full audit:
[`docs/SECURITY-AUDIT-2026-05-09.md`](docs/SECURITY-AUDIT-2026-05-09.md).
Vulnerability reporting: [`SECURITY.md`](SECURITY.md).

| Layer | Control |
|---|---|
| Edge | Cloudflare proxy + nginx allowlist of CF IP ranges (origin returns 403 to direct hits, weekly auto-refresh). |
| App write paths | nginx basic auth + `x-forwarded-user` allowlist for admin. Per-IP rate limits on submit/comment/upload. |
| App public reads | `/api/mcp/*` and bulk dump are unauthenticated but app-rate-limited (30–120/min/IP). All requests logged to `api_usage` for abuse detection. |
| App authenticated reads | `/api/v1/*` requires `Authorization: Bearer iran_mem_…`. Per-key rate limit 1000/h. |
| **Data** | Public read paths use a separate Postgres role `memorial_readonly` with `GRANT SELECT` only. A buggy commit that smuggles a write through `/api/mcp/*` is rejected with `permission denied for table …`. |
| Transport | HSTS, CSP, X-Frame-Options DENY (except `/embed/*`), Referrer-Policy strict, Permissions-Policy. |
| Implementation | `$queryRaw` with `Prisma.sql` (never `$queryRawUnsafe`), upload MIME from content not filename, webhook SSRF guard against private IPs, `crypto.timingSafeEqual` for HMAC. |
| Config | No hardcoded site URL — single `NEXT_PUBLIC_SITE_URL` env var. No fallback passwords in docker-compose. `.env.example` carries only placeholders. |

---

## Ethics & Principles

### Data Integrity
- Every entry verified by at least one credible source
- Credibility ratings for all source organizations
- Full provenance tracking and source URLs

### Respect & Dignity
- Every victim treated with dignity and respect
- Family privacy paramount — sensitive details require consent
- Focus on human stories, not just statistics

### Independence
- Non-partisan memorial — all victims deserve remembrance
- No political agenda beyond truth and accountability
- Non-commercial, open-source, community-driven

### Transparency
- Source code publicly available (private repo, open on request)
- Data export available for researchers and journalists
- Clear documentation of methodology and decisions

---

## License

**Code:** [MIT](LICENSE) — fork, adapt, deploy your own.
**Data:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — share and adapt with attribution.

See [`LICENSE`](LICENSE) for the full text and where each license applies.

## Contributing

We welcome data corrections, new source plugins, translations, and code
improvements. See [`CONTRIBUTING.md`](CONTRIBUTING.md). Found a security
issue? See [`SECURITY.md`](SECURITY.md) — please don't open a public issue.

---

> *"Those who cannot remember the past are condemned to repeat it."*
> — George Santayana

**Every name. Every story. Every life. Remembered.**
