# Agent Instructions — Iran Memorial

**Mission:** Digital memorial for victims of the Islamic Republic of Iran (1979–present). Every victim gets their own page with photos, biographical information, and source documentation.

**Live:** [<DEPLOYMENT_DOMAIN>](<DEPLOYMENT_URL>) | **Version:** v0.17.0 | **Tests:** 809 (552 Vitest + 257 pytest)
**Data:** 36,250+ victims | 30,917 verified (85%) | 62,695 sources | 32,652 photos (23,658 self-hosted) | 18 data sources | **16 languages** (fa/en/de/ar/fr/it/es/he/ru/tr/ckb/hi/ur/sv/nl/zh — 5 RTL)

---

## Workflow Orchestration

### Plan Mode
**CRITICAL: Enter plan mode for ANY non-trivial task.**
- New features (victim fields, pages, API endpoints)
- Database schema changes (migrations, new models)
- Multi-file changes (3+ files)
- Data pipeline changes (enricher plugins, dedup logic)
- Unclear requirements (need exploration first)

**Skip plan mode only for:**
- Single-line fixes (typos, obvious bugs)
- Data imports (use enricher CLI directly)
- Tasks with very specific detailed instructions

### Verification Before Done
**Never mark a task complete without proving it works.**
- Run tests: `npm test` (552 Vitest) + `python3 -m pytest tools/enricher/tests/` (257 pytest)
- Check build: `npm run build` must succeed
- Verify deployment: Check Docker logs after `docker compose up -d --build app`
- Demonstrate correctness

### Self-Improvement Loop
**After ANY user correction:**
1. Update `docs/LEARNINGS.md` with the pattern
2. Write a rule to prevent the same mistake
3. Review lessons at session start for context

### Subagent Strategy
**Use subagents liberally to keep main context clean.**
- Enricher research → Explore subagent
- Data verification → parallel subagents per source

### Demand Elegance (Balanced)
**For non-trivial changes: pause and ask "is there a more elegant way?"**
- Skip for simple data imports or obvious fixes
- Challenge database schema designs before implementing

### Autonomous Bug Fixing
**When given a bug report: just fix it.**
- Point at logs/errors/tests → resolve them
- Enricher failures → check plugin, fix, re-run
- CI failures → fix without being told how

---

## README Maintenance

**CRITICAL: Update README.md immediately when you make these changes:**
1. **Version bumps** → Update "Current Status" (v0.15.0) and add to "Timeline of Key Releases" table
2. **New features** → Add to "Features" section with description
3. **Test count changes** → Update badge (809 tests) and "Test Coverage" row
4. **New languages** → Update "Multilingual" line (currently 16: fa/en/de/ar/fr/it/es/he/ru/tr/ckb/hi/ur/sv/nl/zh)
5. **New data sources** → Update "Data Sources" table
6. **Victim count changes** → Update "Victims Documented" row (currently 37,008+)
7. **New API endpoints** → Add to "Open API v1" section
8. **Verified count** → Update "Verified" row (currently 31,255 / 84%)

**Before `/push`: Check if README reflects current state.**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Database | PostgreSQL 16 (Docker, 37,008 victims) |
| ORM | Prisma 6 |
| Search | PostgreSQL `tsvector` + `pg_trgm` |
| i18n | next-intl (URL-based: `/fa/`, `/en/`, `/de/`, `/ar/`, `/fr/`, `/it/`, `/es/`) |
| Styling | Tailwind CSS v4 |
| Testing | Vitest (552) + pytest (257) = 809 total |
| Container | Docker Compose (PostgreSQL + App) |
| Data Pipeline | Python asyncpg + aiohttp (`tools/enricher/`) |

---

## Key Commands

```bash
# Development
npm run dev                    # Next.js dev (Turbopack, port 3000)
npm run build                  # Production build
npm test                       # 552 Vitest tests

# Database
npx prisma generate            # Regenerate Prisma client
npx prisma migrate deploy      # Apply migrations (production)
npx prisma studio              # Visual DB editor (port 5555)
npx prisma db seed             # Seed events from timeline.yaml

# Enricher (Data Pipeline)
python3 -m tools.enricher list                    # Show 12 plugins
python3 -m tools.enricher check -s wikipedia_wlf  # Dry-run preview
python3 -m tools.enricher enrich -s iranvictims --resume  # Import + match
python3 -m tools.enricher dedup --dry-run -v      # Preview dedup
python3 -m tools.enricher dedup --apply           # Execute dedup
python3 -m tools.enricher status                  # Progress stats

# Photo Pipeline (v0.16.0)
python3 -m tools.enricher photo-health --apply --recheck-broken  # mark dead URLs
python3 -m tools.enricher photo-mirror --apply                   # download to /var/photos
python3 -m tools.enricher photo-dedupe --hardlink                # SHA-256 + pHash + storage dedup

# Testing
npm test                                          # Vitest (552 tests)
python3 -m pytest tools/enricher/tests/ -v        # pytest (257 tests)

# Docker
docker compose up -d db                           # Start PostgreSQL only
docker compose up -d --build app                  # Rebuild + deploy app
docker compose logs -f app                        # Follow app logs
```

---

## Critical Rules

1. **Data Over Features** — More documented victims is always higher priority than new UI features
2. **Respect Sensitivity** — This documents real people who were killed. Every code change affects how their stories are told.
3. **force-dynamic Required** — All pages that query the DB must include `export const dynamic = "force-dynamic"`
4. **Localized Content** — Use `localized(item, 'field', locale)` from `lib/queries.ts` for multilingual fields
5. **Enricher --resume Flag** — Always use `--resume` for enrichment (continues from checkpoint, handles API failures)
6. **Migration Check** — Always verify ALL migrations on server, not just the latest one
7. **Docker Build Required** — Docker Compose builds the image (not volume mount). Always use `--build` flag when code changes.

---

## Deployment

**Server:** <HETZNER_IP> (Hetzner) | **Path:** `/opt/iran-stack/iran-memorial` | **Domain:** <DEPLOYMENT_DOMAIN>
**Database:** Docker `iran-db` (combined), Port 5434 | **App:** Docker `iran-memorial-app-1`, Port 5555→3000

```bash
# SSH to server
ssh root@<HETZNER_IP>

# Navigate & pull
cd /opt/iran-stack/iran-memorial && git pull

# Apply migrations if needed
npx prisma migrate deploy

# Rebuild & restart
cd /opt/iran-stack && docker compose up -d --build memorial-app

# Check logs
docker compose logs -f memorial-app
```

**CRITICAL:** Docker Stack at `/opt/iran-stack/` combines all 3 Iran projects + 1 shared DB.

---

## Testing

**809 tests total** — 552 Vitest (frontend) + 257 pytest (enricher)

| Category | Tests | Command |
|----------|-------|---------|
| Frontend Components | 552 | `npm test` |
| Enricher Plugins | 257 | `python3 -m pytest tools/enricher/tests/ -v` |

**CI/CD:** GitHub Actions (`.github/workflows/test.yml`) runs Vitest + pytest + build on every push.

**Pattern:** When changing Node version, ALWAYS regenerate `package-lock.json`:
```bash
nvm use $(cat .nvmrc)
rm -rf node_modules package-lock.json
npm install
```

---

## Data Pipeline — Enricher

**Location:** `tools/enricher/` | **Architecture:** Async Python, plugin-based, CLI-driven

### 12 Active Plugins

| Plugin | Source | Entries | Notes |
|--------|--------|---------|-------|
| `boroumand` | Boroumand Foundation | 31,203 | Complete historical archive (1979–2023), HIGH credibility |
| `iranvictims` | iranvictims.org | 4,791 | CSV format, 7 fields, circumstances_fa |
| `iranrevolution` | iranrevolution.org | API-based | Real-time Supabase REST API |
| `wikipedia_wlf` | Wikipedia WLF | Manual | Reference list scraping |
| `iranmonitor` | Iran Monitor Memorial | Structured | JSON API access |
| `telegram_rtn` | @RememberTheirNames | 2,709 posts | Jalali dates, photos |
| `telegram_vahid` | @VahidOnline | Filtered | Intelligent content filtering, 934K subs |
| `khrn` | Kurdistan Human Rights Network | Hiwa list | Political prisoner profiles |
| `cpj` | Committee to Protect Journalists | 270 records | Iran killed-journalist records |
| `witness_report` | witness.report | 14.5K records | Cloudflare-bypass via curl_cffi (chrome120 TLS) |
| `hrana` | HRANA | Article scraping | JSON-LD + body parsing, HIGH credibility |
| `hengaw` | Hengaw | Article scraping | Title + body parser, Kurdish-region focus, HIGH credibility |

### Workflow
1. **Check** — Dry-run preview (`--check -v`)
2. **Enrich** — Import + match + update (`enrich -s <plugin> --resume`)
3. **Dedup** — Find + remove duplicates (`dedup --dry-run -v`, then `dedup --apply`)
4. **Status** — Check progress and stats

**Creating a New Plugin:** See `tools/enricher/sources/` for examples. Use `@register` decorator for auto-registration.

---

## Configuration

**Environment (.env):**
```bash
DATABASE_URL="postgresql://memorial:PASSWORD@localhost:5434/iran_memorial"
POSTGRES_PASSWORD=<CHANGE_ME>
```

**Server .env Path:** `/opt/iran-stack/iran-memorial/.env` (production credentials)

---

## Common Patterns

### Localized Content
```typescript
import { localized } from "@/lib/queries";
const circumstances = localized(victim, "circumstances", locale);
// → victim.circumstancesFa || victim.circumstancesEn (for fa locale)
```

### force-dynamic Pages
```typescript
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await getDataFromDB();
  return <Content data={data} locale={locale as Locale} />;
}
```

### RTL-Safe CSS
```css
/* Use logical properties, never left/right */
margin-inline-start: 1rem;   /* NOT margin-left */
padding-inline-end: 0.5rem;  /* NOT padding-right */
```

---

## Database Schema

**ORM:** Prisma 6 | **Schema:** `prisma/schema.prisma` | **36,250 Victims**

| Model | Purpose |
|-------|---------|
| `Victim` | 51 fields: identity, life, death, aftermath, admin (7 `_de` fields for German) |
| `Event` | 15 fields: Timeline events with 3-language titles/descriptions (12 seeded) |
| `Source` | 7 fields: Links (victim/event → URL), cascading delete, optional FK to DataSource |
| `DataSource` | 18 fields: Source organizations metadata (credibility ratings, source type) |
| `Photo` | 11 fields: Attached to victim/event (32,652 photos total) |
| `Submission` | 8 fields: Community submissions (pending/approved/rejected) |
| `Province` | 7 fields: 31 Iranian provinces with coordinates |
| `City` | 6 fields: 112 cities linked to provinces (21,363 victims have city_id) |
| `Comment` | 6 fields: Community comments (pending/approved moderation) |

**Rendering:** All pages use `export const dynamic = "force-dynamic"` — DB queried on every request, no SSG, no ISR.

---

## Documentation

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` (this file) | AI agent instructions — WAT framework, commands, patterns |
| `CHANGELOG.md` | Full version history (v0.1.0 → v0.13.5) |
| `README.md` | User-facing documentation |
| `docs/LEARNINGS.md` | Bugs, decisions, patterns (520+ lines) |
| `docs/VISION.md` | Design philosophy, target audiences, inspiration |
| `docs/PROJECT.md` | Full project documentation (14 chapters) |
| `docs/IRAN_KNOWLEDGE.md` | Historical context (1979–2026) |
| `workflows/` | SOPs for data import, dedup, deploy, testing |

---

## Known Issues

| Issue | Status |
|-------|--------|
| Next.js 16 middleware deprecation warning | ⚠️ Cosmetic (next-intl still uses middleware) |
| ~4,511 victims without city_id | ⚠️ Low priority (generic locations, manual mapping needed) |
| German content: `occupation_de`, `beliefs_de` | ⚠️ Low (columns exist, translation pending) |

---

## Bottom Line

You sit between intent (workflows) and execution (tools). Read instructions, make smart decisions, call the right tools, recover from errors, keep improving.

**Key Priorities:**
1. Data quality over features
2. Test coverage for reliability
3. Documentation for continuity
4. Respect for the victims documented

Stay pragmatic. Stay reliable. Keep learning.

---

**Last Updated:** 2026-05-18
**Maintainer:** Iran Memorial Archive
