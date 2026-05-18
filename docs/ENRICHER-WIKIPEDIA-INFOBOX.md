# Wikipedia Infobox Enricher — Proposal

**Status:** proposal · **Owner:** Sia (next enricher iteration) · **Drafted:** 2026-05-12

A walking-direction enricher that backfills the 27 structured columns added in
migrations `20260512210000` (education + online presence) and `20260512220000`
(tier-2 goldstandard) by reading Wikipedia article infoboxes for each
matchable victim.

## Why a new plugin

The 12 existing enricher plugins enumerate their source — Wikipedia WLF list,
Boroumand archive, Telegram channel, etc. — and walk forward to find victims.
Wikipedia article coverage is the inverse: most articles do not show up in any
curated victim list. We have to walk *our* records and ask "does Wikipedia
have an article for this person?"

The recently merged `grokipedia` plugin (`tools/enricher/pipeline/grokipedia.py`)
already does walking-direction enrichment against xAI's wiki. The proposal
here mirrors that pattern against Wikipedia proper. They are complementary —
Wikipedia has stronger coverage for pre-2010 victims, Grokipedia for post-2024.

## Scope (Tier-1, in this proposal)

Walk every verified victim record. For each:

1. **Disambiguate.** Wikipedia search API → top hit. Confidence score from:
   - Death year match (± 2 years)
   - Birth year match (± 5 years)
   - Country = Iran
   - Article contains both Latin and Farsi name forms
   - Article references at least one of: execution, prison, protest

2. **Skip if low confidence** (score < 0.7). Log skipped IDs so a human can
   audit borderline cases later.

3. **Parse the infobox** via the Wikipedia REST API
   (`/api/rest_v1/page/summary/<title>` + the wikitext API for the infobox
   template). Map fields:

   | Wikipedia infobox field | DB column |
   |---|---|
   | `birth_date` | `date_of_birth` (only if NULL) |
   | `birth_place` | `place_of_birth` (only if NULL) |
   | `death_date` | `date_of_death` (only if NULL; never overwrite OHCHR-quality) |
   | `death_place` | `place_of_death` (only if NULL) |
   | `occupation` / `profession` | `occupation_en` |
   | `nationality` | (skip — already always Iran) |
   | `alma_mater` / `education` | `university_name` + best-effort `university_city` from the school's own wikipedia page |
   | `known_for` | `international_recognition` |
   | `cause_of_death` | `cause_of_death` (only if NULL) |
   | `mother_tongue` / `native_language` | `mother_tongue` |
   | `imprisoned_at` / `held_at` | `prison_name` |
   | `criminal_charge` / `charge` | `charges_en` |
   | `awards` | `international_recognition` |
   | external link to `instagram.com/x` | `instagram_handle` |
   | external link to `twitter.com/x` / `x.com/x` | `x_handle` |
   | external link to `github.com/x` | `github_handle` |
   | external link to `linkedin.com/in/x` | `linkedin_url` |
   | external link to `t.me/x` | `telegram_handle` |

4. **Source attribution.** Always insert a `sources` row pointing at the
   Wikipedia article URL. Credibility tier: MEDIUM (Wikipedia is editable,
   but the citations on the article itself are typically high-quality —
   the row should be flagged for a human re-check before promoting the
   victim to `verified`).

5. **NEVER overwrite non-null fields.** OHCHR / Boroumand / Hengaw all
   outrank Wikipedia. Wikipedia fills gaps only.

## Out of scope (file a separate proposal)

- Tier-2 social network deduplication (e.g. matching multiple Twitter
  handles for the same person across language-localized Wikipedia articles)
- Photo download from Wikimedia Commons (gallery already handled by
  `photo-mirror`)
- Real-time updates when a Wikipedia article changes (would require a
  cron + diff worker — high cost, low value)

## API surface

```bash
# Check (dry run)
python3 -m tools.enricher wikipedia-infobox --check --limit 50 -v

# Apply
python3 -m tools.enricher wikipedia-infobox --apply --resume

# Status
python3 -m tools.enricher wikipedia-infobox --status
```

Single global rate limit: **1 request per second** to Wikipedia. The full
walk over 37k records would take ~10 hours unattended. `--resume` writes a
checkpoint after every 100 records.

## Risk: AI-generated Wikipedia content

Wikipedia has a soft AI-content policy that lags reality. For sensitive
Iran topics it's common to see GPT-generated stub articles seeded by
activist accounts. Heuristics to drop these:

- Article age < 7 days AND author has < 50 edits → skip
- Article references zero external sources → skip
- Article body has no Iranian-press citations (BBC Persian, IranWire,
  Hengaw, HRANA, Radio Zamaneh, Iran Wire) → confidence ≤ 0.5

These heuristics live in `tools/enricher/sources/wikipedia_infobox.py` and
should be unit-tested with fixture articles.

## Coordination with grokipedia plugin

Both walkers visit the same record set in parallel; they MUST share the
checkpoint state file so we don't double-rate-limit each other. The
existing `tools/enricher/checkpoint/` directory is the right place. Add
a `walker_id` field to the checkpoint row (`wikipedia` vs `grokipedia`).

## Why this is gold-standard work

The 27 new columns are mostly **filterable signals** for the kind of
analysis that drives international accountability:

- "Every Sharif University student executed during the 2022 protests"
- "Every Evin Prison detainee whose lawyer was also persecuted"
- "Every victim whose family member was also killed"

Free-text `circumstances_*` fields can't answer these queries. Backfilling
the structured columns from Wikipedia at ~1 second/record turns the archive
from "documentation" into "analyzable evidence base" — directly aligned
with the project's goal #2 (gold-standard for human-rights memorial
documentation, schema.org Person/Dataset compliance) and goal #1
(maximum information transparency → maximum damage to the Islamic Republic).

## Estimated effort

- New plugin file: ~300 LoC Python (similar shape to `grokipedia.py`)
- Unit tests: ~150 LoC pytest (fixture-driven; no live network)
- DataSource row in seed-data-sources.sql for `wikipedia_infobox`
- CHANGELOG + workflows/ entry
- README "Data Sources" table update

Total: ~half-day of focused work, plus one walkthrough with the maintainer on
the confidence-score thresholds before the first --apply run.
