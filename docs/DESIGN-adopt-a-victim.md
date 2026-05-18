# Adopt-a-Victim — Design Document

**Status:** Design draft, not yet implemented
**Owner:** Iran Memorial maintainers
**Inspiration:** Yad Vashem's "Pages of Testimony", Arolsen Archives'
"#everynamecounts" volunteer-stewardship model
**Last updated:** 2026-05-09

---

## Why this exists

Currently, all victim profile maintenance falls on the central maintainer
team. This does not scale: 37,000+ profiles cannot be hand-curated by 2-3
people, and many profiles are sparse (a name and a date and one source).

Adopt-a-Victim moves profile completion into the community in a structured
way that preserves data integrity. A volunteer "adopts" a single profile,
commits to enriching it (adding sources, photos, family-supplied details
where consented, translations), and is publicly credited for that work
unless they opt out.

The goal is **distributed deepening** of the dataset, not breadth. Breadth
is the enricher pipeline's job; depth is human work that scales linearly
with volunteers.

---

## Outcome metrics

| Metric | Why |
|---|---|
| Number of active stewards (logged in within last 90 days) | Health of the program |
| Profiles with ≥ 1 steward-added source in the last quarter | Real value added |
| Median sources-per-profile for stewarded profiles vs. baseline | Quantifies the deepening effect |
| Stewards who pass moderation 95%+ of the time | Signal that stewards are good citizens, not vandals |
| Translation completeness (% of stewarded profiles with EN/FA/DE filled) | Multilingual completeness, the second-biggest data quality issue |

---

## Non-goals

- **Not anonymous editing.** Wikipedia-style anonymous edits are
  inappropriate for this dataset given the political stakes.
- **Not unmoderated.** Every steward edit goes through review before
  going live. We do not trade integrity for throughput.
- **Not "first come first served."** Some profiles (e.g. a Persian
  household name like Mahsa Amini) will have many candidate stewards.
  Editorial team picks one.
- **Not gamified.** No badges, no leaderboards, no points. The reward
  is the work.

---

## User journeys

### Journey 1: Family member adopts their relative's profile

Sara, the daughter of someone executed in 1988, finds her father's
profile via search. The profile has only a name, year of death, and one
HRANA citation. She wants to add: a photo from the family album, his
birth date, his profession, the name of the prison where he was held.

Today: she emails the maintainer team. Sometimes responsive, sometimes
not. The relationship is one-shot.

With Adopt-a-Victim:

1. Profile page shows "Help complete this profile" button.
2. Sara clicks → onboarding flow asks: are you a family member /
   researcher / journalist / community volunteer? She selects family.
3. We ask: do you want public credit, anonymous credit, or no credit?
4. She submits an "adoption application" with a brief note ("I'm his
   daughter; I'd like to add his photo and biography").
5. Maintainer reviews within 5 days. Approves.
6. Sara now has a steward dashboard for that single profile. She can
   submit edits. Each edit goes through moderation.
7. Approved edits go live with attribution: "Last updated by family
   steward." Or "Last updated anonymously," depending on her choice.

### Journey 2: Researcher adopts a 1988 cohort

A historian working on the 1988 mass executions wants to deepen 50
profiles from a specific prison cohort.

1. Researcher applies via a single form, supplies academic affiliation
   and a brief explanation of scope.
2. Editorial review of the application (we want to confirm scholarly
   intent and avoid concentrating sensitive cases under one outsider).
3. If approved, the researcher gets steward role for those 50 specific
   profiles.
4. Their attribution appears on each: "Last updated by researcher steward
   [name], [affiliation]."

### Journey 3: Translator adopts FA-only profiles

A Farsi/English bilingual translator wants to add English circumstances
to profiles that have only Farsi.

1. Applies for translator-steward role.
2. Sees a queue of profiles with `circumstancesFa` populated but
   `circumstancesEn` null.
3. Submits translations one by one. Each goes through moderation.
4. Public credit on each profile they translate.

---

## Editorial responsibilities the program does not change

The maintainer team retains:

- **Source addition** — only maintainers can mark a source as HIGH-tier
  credibility, because tier assignment requires editorial judgment about
  source organisations, not individual records.
- **Verification status** — a steward edit cannot toggle a profile from
  unverified to verified. That's a function of the auto-verification
  predicates (Section 4 of the methodology paper).
- **Removal requests** — only maintainers process family take-down
  requests, which often involve sensitive judgment (whether to remove vs
  redact specific fields).
- **Banning stewards** — a steward who repeatedly submits low-quality or
  contested edits is removed from the program.

---

## Schema sketch (minimal MVP)

```prisma
model VictimSteward {
  id           String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  victimId     String       @map("victim_id") @db.Uuid
  victim       Victim       @relation(fields: [victimId], references: [id], onDelete: Cascade)
  userId       String       @map("user_id") @db.Uuid    // links to Auth.js user
  role         StewardRole                                // family | researcher | journalist | translator | community
  status       StewardStatus @default(pending)            // pending | active | paused | revoked
  attribution  AttributionPreference @default(publicWithName) // publicWithName | publicAnonymous | none
  scopeNote    String?      @map("scope_note") @db.Text  // free-text from application
  approvedBy   String?      @map("approved_by")          // maintainer username
  approvedAt   DateTime?    @map("approved_at") @db.Timestamptz()
  createdAt    DateTime     @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt    DateTime     @updatedAt @map("updated_at") @db.Timestamptz()

  edits        StewardEdit[]

  @@unique([victimId, userId])
  @@index([userId])
  @@index([status])
  @@map("victim_stewards")
}

model StewardEdit {
  id            String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  stewardshipId String       @map("stewardship_id") @db.Uuid
  stewardship   VictimSteward @relation(fields: [stewardshipId], references: [id], onDelete: Cascade)
  field         String                                  // canonical column name in victims
  oldValue      String?      @map("old_value") @db.Text
  newValue      String?      @map("new_value") @db.Text
  reasonNote    String?      @map("reason_note") @db.Text
  status        EditStatus   @default(pending)          // pending | approved | rejected | superseded
  reviewedBy    String?      @map("reviewed_by")        // maintainer username
  reviewedAt    DateTime?    @map("reviewed_at") @db.Timestamptz()
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz()

  @@index([stewardshipId])
  @@index([status])
  @@index([createdAt])
  @@map("steward_edits")
}

enum StewardRole {
  family
  researcher
  journalist
  translator
  community
}

enum StewardStatus {
  pending
  active
  paused
  revoked
}

enum AttributionPreference {
  publicWithName
  publicAnonymous
  none
}

enum EditStatus {
  pending
  approved
  rejected
  superseded
}
```

Key design choices:

- **`VictimSteward` is per-victim.** A user can be a steward of multiple
  victims, but each (user, victim) pairing is a separate record with its
  own approval state. Prevents one approval from cascading.
- **`StewardEdit` is field-level.** Edits are diffs against the existing
  Victim row, not blobs. Easier to review, easier to revert.
- **No bulk-approve endpoint.** Every edit is reviewed individually, by
  design. We can build review-batching UX without changing the schema.
- **Read-only enforcement still holds.** The new tables are owned by
  `memorial`, not by `memorial_readonly`. Public surfaces never see
  steward records. The admin moderation UI uses the writable role.

---

## Implementation phases

### Phase 1 (MVP, ~1 week of work)

- Prisma schema migration for `VictimSteward` + `StewardEdit` + enums
- Auth.js v5 user table (we already have NextAuth scaffolding from v0.1)
- Application form at `/victims/[slug]/adopt` (consented disclosure of
  identity to maintainer team only)
- Admin queue at `/admin/stewardship` — approve/reject applications, then
  approve/reject individual edits
- Steward dashboard at `/me/stewardships` showing all profiles you steward
- Per-profile "Last updated by [steward name / anonymous family steward]"
  attribution line on `/victims/[slug]`

### Phase 2 (~2 weeks)

- Translator-specific queue: profiles where `circumstancesFa` is filled
  but `circumstancesEn` (or any other locale) is null
- Researcher batch application: apply for N profiles matching a query
  (e.g. "all 1988 victims at Evin prison")
- Family-specific signup with light identity verification (we send a
  reply to a family-confirmed email or vouch from a known NGO)

### Phase 3 (later, when scale demands)

- Public stewardship registry (opt-in: stewards who chose
  `publicWithName` listed on `/stewards` with the profiles they maintain)
- Steward-to-steward messaging via the platform (encrypted, no email
  exposure)
- "Adopt the next unstewarded 1988 victim" one-click flow for translators
  and researchers who want to be assigned work rather than browse

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Steward adds wrong source (typo, fake) | Every edit moderated; bad pattern → revoke status |
| IRI-aligned actor poses as steward to sabotage | Application review + opt-in identity disclosure to maintainers; small revoke radius (per-victim) limits damage |
| Family member adds personal details that endanger living relatives | Reviewer flags any field referencing living people; stewards are explicitly told not to add such details |
| Steward burnout / abandoned profiles | Status tracking (active vs paused); inactive >180 days → status auto-paused |
| Maintainer review queue blows up | Per-steward edit-rate limit + per-day moderation throughput target; if backlogged, the bottleneck is moderation capacity (an org issue), not the program design |
| Public-with-name attribution puts steward at risk | `publicAnonymous` and `none` options; default for family stewards is `publicAnonymous` (we still credit the work, just not the name) |
| Edits race against enricher pipeline | Enricher merges newer fields; steward edit may overwrite — we resolve by taking the most-recent edit by default and surface conflicts in the moderation queue |

---

## Privacy model

- Steward identity is shared with maintainers at application time.
- Public attribution is per the steward's preference.
- Steward email and identity are never exposed via API or public page.
- The `VictimSteward` table is in the writable schema, never accessible
  via `memorial_readonly`. MCP and dump endpoints have no view of it.
- Steward edit history is internal to the moderation system. Public
  audit log shows "edited" timestamps and approved-attribution string,
  not the underlying user record.

---

## Open questions

1. **Should we allow family stewards to manage multiple relatives?** A
   sister of two executed brothers should not have to apply twice. But
   "I have ten relatives in the database" claims need verification.
   Tentative: allow up to 3 family-tier adoptions on initial
   application; further requests reviewed case-by-case.

2. **Do we expose steward identity in the integrity log + git history?**
   No — git history is public, and we want family stewards to be able to
   choose anonymity in publicly-visible places. Stewardship records live
   in the DB only.

3. **Translator edits at scale — moderation bottleneck?** A bilingual
   speaker can produce 50 high-quality translations a week. With one
   maintainer reviewing those is still tractable. With ten translators,
   we need a "trusted translator" tier with sample-based audit instead
   of every-edit review. Phase 2 problem.

4. **Should stewards be able to dispute auto-verification predicates?**
   E.g., a steward who sees "this profile is `unverified` because we
   only have one HIGH-tier source" should be able to flag "I have
   another source, please re-verify". Yes — that's just an edit that
   adds a source, which triggers the auto-verify cron on next run.

5. **Bot detection?** Adoption applications from suspicious user-agent
   patterns or burst-rate signups get held for manual review. Not in
   MVP.

---

## Notes

This document is a starting point, not a contract. Once the MVP ships,
we expect the steward role definitions and the edit-review UX to evolve
based on real usage. The schema is intentionally simple to keep that
evolution cheap.

The biggest unknown is **moderation throughput at scale**. We will not
launch the program publicly until at least three maintainers can commit
to a weekly moderation rhythm — otherwise the queue grows indefinitely
and the program collapses. Better to delay a clean launch than to ship
a broken one.
