# Iran Memorial: A Reproducible Methodology for Aggregating, Verifying, and Open-Publishing Victims of State Violence (1979–present)

**Author:** Iran Memorial Project, Woman Life Freedom e.V.
**Correspondence:** <CONTACT_EMAIL>
**Working Paper · Draft v0.1 — 2026-05-09**
**License:** CC BY-SA 4.0
**Recommended citation (after SSRN/Zenodo deposit):**
> Iran Memorial Project. (2026). *Iran Memorial: A Reproducible Methodology for Aggregating, Verifying, and Open-Publishing Victims of State Violence (1979–present).* Working paper. https://doi.org/10.5281/zenodo.NNNNNN

---

## Abstract

We describe the data architecture, verification methodology, and ethical
framework of *Iran Memorial* — an open, machine-readable database of
individuals killed by the Islamic Republic of Iran since 1979. As of May
2026 the dataset contains 37,000+ victim records aggregated from twelve
human-rights and journalism sources, with 31,000+ records satisfying our
verification criteria (84%). The dataset is published under CC BY-SA 4.0
and exposed through three programmatic surfaces (public MCP API for
LLM-based research workflows, authenticated REST API for institutional
consumers, and a single-file weekly bulk dump). Verification is performed
via a three-tier source-credibility model and three rule-based
auto-verification predicates whose code, SQL, and intermediate state are
all public. The system runs as an open-source, Postgres-backed Next.js
application reproducible from a single `git clone`. We discuss the
implications of the architecture for sanctions advocacy, universal-
jurisdiction prosecutions, asylum proceedings, and academic research, and
the trade-offs we made to make the data simultaneously accessible to
families, citable in court, and resilient against censorship.

**Keywords:** Iran, human rights, open data, source verification, dataset
aggregation, censorship resilience, MCP, sanctions, Mahsa Amini

---

## 1. Introduction

Documentation of victims of the Islamic Republic of Iran is fragmented
across at least a dozen organisations, each with different scopes,
formats, languages, and access models. The Boroumand Foundation's *Omid
Memorial* covers 1979–2023 with rigorous case-by-case verification but is
HTML-scraped and not directly machine-queryable. HRANA News Agency
publishes daily reports on current cases but in narrative Persian text.
The Committee to Protect Journalists tracks killed and imprisoned
journalists but only those with verified press credentials. Wikipedia's
*Deaths during the Mahsa Amini protests* aggregates community-sourced
data with no formal credibility model. Hengaw, the Kurdistan Human
Rights Network, and witness.report cover overlapping but non-identical
populations. None of these sources individually provides a complete
picture; collectively they do, but only after non-trivial integration.

Iran Memorial integrates these sources into a single, deduplicated,
multi-language, machine-readable record. The objectives are:

1. **Completeness:** every documented victim, regardless of which
   source first reported them.
2. **Verifiability:** every record traces to at least one credible source,
   and the credibility of that source is publicly classified.
3. **Reproducibility:** the entire pipeline (source ingestion → matching
   → deduplication → publication) is open-source and re-runnable from
   the source data.
4. **Accessibility:** human-readable profiles in seven languages plus
   programmatic access for journalists, researchers, lawyers, and AI
   agents.
5. **Censorship resilience:** the dataset survives the loss of any
   single hosting provider, jurisdiction, or maintainer.

This paper describes how each objective is operationalised. Section 2
presents the data model. Section 3 describes the source-ingestion
pipeline ("the enricher") and its twelve plugins. Section 4 explains
the three-tier credibility model and the three auto-verification
predicates. Section 5 covers deduplication (the hardest single technical
problem in the project). Section 6 describes the multiple publication
surfaces and the read-only enforcement model. Section 7 discusses
limitations and open problems. Section 8 outlines applications already
realised or in development.

---

## 2. Data Model

The conceptual model is small, in line with the project's principle that
*the dataset is the memorial; the application is only a window*.

### 2.1 Core entities

- **Victim**: a single person killed, executed, disappeared, or held in
  death-related custody by the Islamic Republic. 51 fields covering
  identity, life context, death circumstances, aftermath, and
  administrative metadata. Multilingual fields (`circumstancesEn`,
  `circumstancesFa`, `circumstancesDe`, …) coexist; Latin and Farsi names
  are both indexed for search. Each victim has a stable URL slug
  (`/en/victims/<slug>`) generated from name and birth year.

- **Source**: a citation. A URL, a name, a publication date, an
  optional foreign key to a `DataSource`. Each Victim typically has
  multiple Sources; we never delete sources, only add.

- **DataSource**: an organisation that produces sources (e.g. HRANA,
  Boroumand, CPJ). Carries credibility tier, country, source type, and
  contact metadata. The tier is editorially set, not dynamically
  computed (Section 4).

- **Event**: a historical context (1988 mass executions, 2009 Green
  Movement, 2022 Mahsa Amini protests, 1979 revolution, etc.). Victims
  may belong to an Event; Events have multilingual title and
  description. Twelve seeded events as of v1.

- **Photo**: optional, attached to a Victim. Carries credit and source.

- **Province / City**: geographic taxonomy used for filtering and the
  national map view.

- **ApiUsage**, **ApiKey**, **Submission**, **Comment**, **Webhook**:
  operational entities, not part of the citable dataset.

### 2.2 Field philosophy

We default to **structured fields** (date, place, age, cause-of-death
enum) with **free-text companions** (`circumstancesEn`, etc.) for
context that doesn't fit a structured slot. Both are queryable. The
free-text fields are the ones lawyers and journalists most often quote;
the structured fields drive aggregations and the search index.

Every multilingual field follows the convention `fieldEn`, `fieldFa`,
`fieldDe`, etc. — independent strings, not auto-translations. We
explicitly do **not** machine-translate sensitive content (cause of
death, circumstances) because mistranslation in this domain creates
factual errors that propagate into citations.

### 2.3 What we do not store

- IP addresses or fingerprints of website visitors (privacy by design).
- Email addresses of submitters who request anonymity.
- Personal identifying information about living family members in Iran
  unless explicitly consented to and published elsewhere by reputable
  human-rights organisations.

This restraint is part of the methodology, not just an ops choice
(Section 7.2).

---

## 3. Source Ingestion: The Enricher Pipeline

Source ingestion is fully automated via a Python pipeline (`tools/enricher/`)
running on a weekly cron. The pipeline has twelve plugins as of v1, each
handling one source organisation. Plugins are open-source and follow a
shared `SourcePlugin` ABC (abstract base class).

### 3.1 Plugin registry

| Plugin | Source | Format | Records | Tier |
|---|---|---|---|---|
| `boroumand` | Abdorrahman Boroumand Center (Omid Memorial) | HTML scrape | 31,203 | HIGH |
| `iranvictims` | iranvictims.org | CSV | 4,791 | MEDIUM |
| `iranrevolution` | iranrevolution.org (Supabase REST) | API | live | MEDIUM |
| `iranmonitor` | iranmonitor.org Memorial | Structured JSON | live | MEDIUM |
| `wikipedia_wlf` | Wikipedia "Deaths during Mahsa Amini protests" | HTML | manual | UNVERIFIED |
| `telegram_rtn` | @RememberTheirNames | Telegram channel | 2,709+ | MEDIUM |
| `telegram_vahid` | @VahidOnline (citizen journalism) | Telegram channel | filtered | MEDIUM |
| `khrn` | Kurdistan Human Rights Network — Hiwa | HTML | live | HIGH |
| `cpj` | Committee to Protect Journalists | API | killed/Iran subset | HIGH |
| `witness_report` | witness.report | HTML (Cloudflare-bypass) | 14,500 | HIGH |
| `hrana` | HRANA News Agency | Article scrape (JSON-LD + body) | live | HIGH |
| `hengaw` | Hengaw (Kurdish region focus) | Article scrape | live | HIGH |

### 3.2 Plugin contract

Each plugin implements `fetch_all() -> AsyncIterator[ExternalVictim]`
yielding one record per victim found. The `ExternalVictim` dataclass is
the canonical interchange format — it carries fields from any source's
native format normalised into a common shape (Latin name, Farsi name,
date of death, place of death, cause of death, source URLs, photo URL,
free-text circumstances).

### 3.3 Match-or-import workflow

For each yielded `ExternalVictim`, the orchestrator:

1. **Match** against the existing victim index by trigram name
   similarity, date proximity, and place proximity. If a confident
   match is found, the source is *added to* the existing victim;
   missing fields may be enriched.
2. **Import** if no match. The new victim is added with a generated
   slug.
3. **Quarantine** if multiple candidates with similar but not
   identical signatures exist (the deduplication problem; Section 5).

The pipeline is idempotent: re-running it produces no duplicate sources
or victims, only additive enrichment.

### 3.4 Operational schedule

Sundays 02:30 UTC the full enrich pipeline runs, followed at 02:40 UTC
by the dedup pass and at 03:00 UTC by the IPFS snapshot. The Wayback
Machine cron snapshots the public surface daily at 03:30 UTC. Logs are
public on the GitHub repo (sanitised of any submitter PII).

---

## 4. Verification: Three-Tier Credibility + Three Rule-Based Predicates

A victim record's `verificationStatus` is `verified` ∈ {true, false}.
The criteria are explicit, rule-based, and inspectable in code.

### 4.1 Three-tier source credibility

Every `DataSource` is assigned one of three tiers, editorially set by
maintainers based on:

- **HIGH:** primary investigation by a human-rights organisation with
  established methodology and editorial accountability (Boroumand,
  HRANA, KHRN, Hengaw, CPJ, witness.report, Amnesty International, IHR).
- **MEDIUM:** secondary aggregation, citizen journalism, or community-
  sourced with selective editorial review (iranvictims, iranrevolution,
  iranmonitor, @RememberTheirNames, @VahidOnline).
- **COMMUNITY / UNVERIFIED:** crowdsourced or single-source-only
  (Wikipedia, isolated submissions).

Tier is assigned to the *organisation*, not to the individual record.
This is a deliberate simplification: a HIGH-tier organisation can publish
a wrong record, but on average their records are right at a much higher
rate than COMMUNITY tier records.

### 4.2 Three auto-verification predicates

A victim becomes `verified` automatically when *any* of the following
predicates hold:

- **Rule A:** at least two distinct DataSources cite the record, and at
  least one is HIGH tier.
- **Rule B:** at least one HIGH-tier DataSource cites the record AND
  the record has a non-null `dateOfDeath` AND a non-null `placeOfDeath`
  (the structural minimum for a citable historical record).
- **Rule C:** the record originates from a HIGH-tier DataSource AND has
  been independently corroborated by a Wikipedia article that
  specifically references the same name and event.

Records that fail all three rules are kept in the dataset (we do not
delete) but are visibly flagged as `unverified` and not counted in the
"verified" public statistic.

The predicates are SQL functions in the codebase; running them is a
single-command operation (`tools/data/backfill-source-fk-and-verify.sql`)
and the cron re-runs them weekly so newly added sources retroactively
verify older records.

### 4.3 Editorial review of predicates

The predicates themselves are subject to peer review. As of v1 they have
been reviewed informally by the maintainer team and partner NGOs; we
publish them in this paper to invite formal review.

### 4.4 Disputed records

Records flagged `disputed` (sources contradict on a material fact: date,
location, cause) are kept visible but marked. Disputes are resolved
manually with all candidate sources cited.

---

## 5. Deduplication

Deduplication is the single hardest technical problem in the project.
Each source uses different name transliterations (Mahsa, Mehsa, Mahasa;
Amini, Amni, Aminian), different date precisions (year-only, month-only,
exact), and different geographic granularities (Tehran province vs city
vs neighbourhood). A naive name-string match misses 30–50% of true
duplicates.

### 5.1 Match algorithm

We use a multi-signal scorer (`tools/enricher/pipeline/dedup.py`):

- **Name similarity:** Postgres `pg_trgm` similarity on Farsi names
  (after normalising Arabic/Persian script unification: `ي → ی`,
  `ك → ک`, etc.) plus Latin transliteration. Weight: 50 if exact, scaled
  by similarity score otherwise.
- **Date of death:** ±1 day tolerance scored as full match (40), wider
  windows score lower. Year-only matches get partial credit (5).
- **Geographic proximity:** province match scores 20, city match 30,
  exact place match 40. Mismatches are penalised, not merely uncounted.
- **Age, gender, occupation, ethnicity:** small-magnitude contributors,
  mostly disambiguators when name+date are similar.

A composite score ≥ 50 triggers an *auto-merge* candidate; 30–49 is
flagged for manual review; <30 is treated as different people.

### 5.2 Performance

Until 2026-05 the dedup pass timed out on the full dataset because of
correlated subqueries in the count-aggregation step. We rewrote the
query as grouped LEFT JOINs; wall time dropped from "timeout after 30s"
to ~0.7s for a 32K-victim load. The dedup pass now runs weekly as part
of the standard cron.

### 5.3 Cross-source duplicate audit

In May 2026 we performed a one-off audit of 1,545 newly imported records
from `iranrevolution`, `iranvictims`, and `iranmonitor` against the
existing 30K. Results: zero same-name-and-same-date duplicates (the
matcher worked); seven likely duplicates where a new import had a missing
date_of_death and the existing record had it (different slugs, otherwise
same person). All seven were manually merged. 241 records had matching
names but different death dates — these are different people sharing
common Iranian names (e.g. multiple "Ali Karimi" hanged in different
years), and we kept them as separate records.

This audit pattern is repeatable; the SQL is published.

---

## 6. Publication: Three Read-Only Surfaces

The dataset is exposed through three programmatic surfaces, each sized
for a different audience.

### 6.1 MCP API for AI agents

`/api/mcp/*` (HTTP) and `tools/mcp/` (stdio Model Context Protocol
server). Five tools: `search_victims`, `get_victim`, `get_executions`,
`get_death_row`, `get_statistics`. Public, no authentication, CORS
enabled. Per-IP rate-limited at the application layer (30–120 req/min
depending on endpoint). Designed for direct integration with Claude
Desktop, Cursor, Cline, Continue.dev, and ChatGPT-via-MCP.

### 6.2 REST API for institutional consumers

`/api/v1/*`. Bearer-token authenticated (`Authorization: Bearer
iran_mem_…`). Per-key rate limit 1000 requests / hour. Paginated
endpoints over victims, sources, events, statistics. OpenAPI 3.0 spec
served at `/openapi.yaml`, rendered via ReDoc on the developer page.

### 6.3 Bulk dataset

`/api/v1/public/dump`. Single ~30 MB JSON containing every victim record
with key fields. Cloudflare-cached for an hour. CC BY-SA 4.0. Refreshed
weekly by the enricher cron. Citable as both a live URL and as a Zenodo
DOI snapshot (monthly cadence).

### 6.4 Defense-in-depth read-only enforcement

All three public surfaces use a separate Postgres role
(`memorial_readonly`) with `GRANT SELECT` and no other privileges. A
buggy commit that introduces a write call inside an MCP handler is
rejected at the database layer with `permission denied for table victims`,
not at the application layer. This is the single most important
architectural property for an open-data project of this kind: it makes
the read-only guarantee a property of the database, not of the
application code, which is harder to break by accident.

---

## 7. Limitations and Open Problems

### 7.1 Pre-2000 coverage gaps

Coverage is uneven across decades. The 1980s and 1988 mass executions
are well-documented by Boroumand and Amnesty but not all victims have
verifiable date_of_death (which was withheld by the regime); we admit
these into the dataset as `verified` with `dateOfDeath = NULL` if the
fact of execution is established. The 1990s "chain murders" period has
fewer source organisations active than the 2010s and onward, leading to
known undercount.

### 7.2 Living-family privacy

Records about people whose families remain in Iran face an inherent
tension: full documentation supports accountability but may put
relatives at risk of regime retaliation. Our policy is to publish only
information already public in reputable human-rights reports; family
contact details, sexuality, religious conversion, or other sensitive
attributes are excluded unless the family or a credible NGO has already
made them public. Maintainers can take down individual records on
family request even if those records are otherwise sourced from public
data — this is a deliberate trade-off favoring families' agency over
maximalist documentation.

### 7.3 Transliteration drift

Persian/Arabic-to-Latin transliteration is unstandardised in the source
ecosystem. The same person may appear as "Mahsa Amini", "Mehsa Aminian",
"Mahasa Amni" across three sources. We normalise where confident, but
edge cases produce occasional false negatives in matching (separate
records for the same person until manual review).

### 7.4 No structured perpetrator schema yet

Currently perpetrators (judges, courts, security forces) are extracted
on-the-fly from the unstructured `responsible_forces` and
`legal_proceedings` text fields. A typed perpetrator schema is on the
roadmap; until then, sanctions-toolkit dossiers (Section 8.1) rely on
ILIKE substring matching, which misses some references and includes
some false positives.

### 7.5 Verification is automated, not adjudicated

The auto-verification predicates are deliberately conservative
(requiring source diversity and structural completeness) but do not
constitute factual adjudication. A `verified` label means "multiple
independent sources concur on enough structural detail" — not "a court
has ruled on this case". For court use, our dataset is one input among
several, not a substitute for evidence-grade case files.

---

## 8. Applications

### 8.1 Sanctions submission pipeline

The dataset feeds Magnitsky-style submissions to the EU Global Human
Rights Sanctions Regime, US OFAC, UK Global Human Rights Sanctions
Regulations 2020, and Canadian SEMA. A generator script
(`scripts/sanctions-dossier.ts`) takes a court or judge name, queries
all linked victims, and produces a print-ready A4 HTML dossier with
statistical pattern of conduct, top-N documented incidents with sources,
and a verification methodology footer. First three submissions in
preparation in cooperation with ECCHR Berlin and IHRDC.

### 8.2 Universal-jurisdiction prosecutions

The Swedish Hamid Nouri prosecution (2022, life sentence for involvement
in the 1988 mass executions) cited the Boroumand Foundation's data
extensively. Our dataset is built on the same primary sources and adds
twelve more, structured for direct query. We are in early-stage dialogue
with the German Generalbundesanwalt's Völkerstrafrecht division and the
Belgian federal prosecutor about offering the dataset as standing input
for ongoing investigations.

### 8.3 Asylum and country-of-origin information

European Union Asylum Agency (EUAA), German BAMF, and individual asylum
attorneys consume country-of-origin information when adjudicating
Iran-related claims. A citable, structured database with pattern data
(executions per year per province per cause) is more useful than
narrative reports. We are setting up a dedicated API tier for asylum
attorneys with elevated rate limits.

### 8.4 LLM-citable canonical source

The MCP integration (Section 6.1) means any LLM with the Iran Memorial
server configured will, by default, cite our dataset when asked about
specific victims of the IRI. As MCP-aware LLMs gain market share, this
is a structural visibility multiplier that traditional human-rights
reports do not have.

### 8.5 Family use

Our largest single user category by visitor count is families looking up
their own relatives. Localisation in seven languages including Farsi
with full RTL support is a methodological decision specifically to
support this audience. Family-supplied corrections are routed through
a moderation queue and merge into the public record once verified
against existing sources.

---

## 9. Reproducibility Statement

Every component of the pipeline described above is open-source and
reproducible. To reconstruct the system from scratch:

```bash
git clone https://github.com/iran-memorial26/iran-memorial.git
cd iran-memorial
docker compose up -d db
npx prisma migrate deploy
npx prisma db seed
docker exec -i iran-db psql -U postgres < scripts/setup-readonly-role.sql
python3 -m tools.enricher enrich -s iranrevolution --mode full
NEXT_PUBLIC_SITE_URL=https://your-domain.example npm run build
docker compose up -d --build app
```

The full snapshot of the dataset for any month back to v1 is available
as a single Zenodo DOI; the corresponding code is tagged in Git. A
researcher reading this paper in 2030 can fetch the May 2026 dataset
+ matching code and reproduce every figure in this paper byte-for-byte.

---

## 10. Acknowledgements

[To be completed once partner organisations confirm acknowledgement
preferences.]

---

## 11. References

[Bibliography to be finalised — initial entries:]

- Abdorrahman Boroumand Center. (n.d.). *Omid Memorial*. https://www.iranrights.org/library/collection/3508
- Amnesty International. (2018). *Blood-soaked secrets: Why Iran's 1988 prison massacres are ongoing crimes against humanity*. AI Index: MDE 13/9421/2018.
- Committee to Protect Journalists. (n.d.). *Iran*. https://cpj.org/asia/iran/
- Hengaw Organization for Human Rights. https://hengaw.net/
- HRANA News Agency. https://www.en-hrana.org/
- Iran Human Rights (IHR). https://iranhr.net/
- Kurdistan Human Rights Network. https://kurdistanhumanrights.org/
- Schmitt, M. N., et al. (2022). The trial of Hamid Nouri and Sweden's exercise of universal jurisdiction. *Just Security*. [Citation to be confirmed]
- UN Human Rights Council. (2024). *Report of the Special Rapporteur on the situation of human rights in the Islamic Republic of Iran*.
- Wikipedia contributors. (2026). *Deaths during the Mahsa Amini protests*. Wikipedia.

---

## Appendix A — Data Fields

The complete Prisma schema describing the `Victim`, `Source`,
`DataSource`, `Event`, `Photo`, `Province`, `City`, and `ApiUsage`
entities is at
[`prisma/schema.prisma`](https://github.com/iran-memorial26/iran-memorial/blob/main/prisma/schema.prisma)
in the public repository.

## Appendix B — License

This paper is licensed under CC BY-SA 4.0. The underlying dataset is
licensed under CC BY-SA 4.0. The application code is licensed under MIT.
Re-use is encouraged with attribution to "Iran Memorial Project /
Woman Life Freedom e.V. — <DEPLOYMENT_DOMAIN>".

## Appendix C — Conflict of Interest Statement

The maintainers of Iran Memorial are members of Woman Life Freedom e.V.,
a registered German non-profit. The project receives no commercial
funding and has no advertising, paywall, or revenue stream. None of the
maintainers are paid for their work on this project at the time of
writing. Donations to Woman Life Freedom e.V. earmarked for Iran
Memorial cover infrastructure costs (Hetzner, Cloudflare, GitHub) and
nothing else.

---

*Draft v0.1 — 2026-05-09. Comments and corrections via GitHub issue
or email. To be deposited on SSRN and Zenodo after partner-organisation
review.*
