# Partners — Tracking & Outreach

> Internal tracking document. Lives in the public repo because partners
> appreciate seeing they are taken seriously, not buried in a private
> spreadsheet. **Personal contact details belong in the private CRM, not
> here.** This file lists organisations and the public-facing relationship.

**Last reviewed:** 2026-05-09

## Active partners

_None yet — this section gets populated as the first formal partnerships
land. Expected first entries (Q3 2026): ECCHR Berlin, IHRDC, ECCHR-
adjacent academic reviewer of the methodology pre-print._

| Partner | Type | Since | Public role | Status |
|---|---|---|---|---|
| _(none yet)_ | — | — | — | — |

When a partner is added, the row should look like:

```
| ECCHR (Berlin)    | NGO         | 2026-Q3 | Sanctions co-signatory | active |
| Stanford Iran 2040 | Academic    | 2026-Q3 | Methodology review     | active |
| IHRDC             | NGO         | 2026-Q3 | US-side dissemination  | active |
```

Status values:
- `active` — current ongoing relationship, public collaboration is OK to mention
- `dormant` — no current activity but no breakup; relationship is open
- `historical` — partnership ended cleanly; archived for transparency
- `private` — relationship exists but partner asked us not to publicly name them

## Outreach pipeline

Where each prospective partner is in the funnel.

| Org | Type | Goal | Stage | Last contact | Next step |
|---|---|---|---|---|---|
| SOAS — Centre for Iranian Studies | Academic | Pre-print review | identified | — | Send Template A (see [`OUTREACH-preprint.md`](OUTREACH-preprint.md)) |
| University of Bonn | Academic | Pre-print review + DE/EU legal-framework review | identified | — | Identify specific researcher with iran-studies + GDPR / Universal-Jurisdiction interest |
| Stanford Iran 2040 | Academic | Pre-print review + US-side advocacy network | identified | — | Identify Iran-specific working-group member |
| ECCHR (Berlin) | NGO | Sanctions submission co-signatory | identified | — | Direct email to `info@ecchr.eu` with sanctions toolkit demo |
| IHRDC (US) | NGO | US-side documentation / advocacy network | identified | — | Direct email referencing sanctions toolkit + bulk-data API |
| Iran Human Rights (IHR) | NGO | Data exchange + co-citation | identified | — | Light-touch intro, then API-key offer |
| HRANA | NGO | Source partnership (we already ingest their data via plugin) | identified | — | Email pulling rank — formalise as partnership rather than scrape |
| Hengaw | NGO | Source partnership | identified | — | Same pattern as HRANA |
| Boroumand Foundation | NGO | Source partnership (we ingest their archive) | identified | — | Email + acknowledgement of their primacy |
| BAMF Forschungszentrum Migration | Government | Asylum COI consumer | identified | — | Pitch dedicated API tier for asylum lawyers |
| ECCC / Pro Asyl / ECRE | NGO | Asylum-attorney distribution channel | identified | — | After BAMF foothold — pitch as derived-use case |

Stages:
1. `identified` — on the list, not contacted
2. `outreach` — email sent, awaiting reply
3. `engaged` — reply received, conversation in progress
4. `committed` — verbal/email commitment to specific cooperation
5. `active` — moves to the "Active partners" table above
6. `declined` — they said no; archive after 6 months unless re-approachable
7. `dormant` — no reply after 21 days; reset every quarter and try again

## Outreach templates

See [`OUTREACH-preprint.md`](OUTREACH-preprint.md) for the academic
pre-print outreach. Other partner-types use the templates below.

### Template — NGO partnership pitch (cold)

Subject: `Iran Memorial — proposing a working partnership`

> Dear [NAME],
>
> Iran Memorial (<DEPLOYMENT_DOMAIN>) is a public, open-data archive
> of victims of the Islamic Republic of Iran since 1979 — currently
> 37,000+ records aggregated from twelve sources, CC BY-SA 4.0.
>
> We already ingest [ORG]'s public data via [our scraping plugin / our
> API client]. We are writing to propose formalising the relationship:
>
> - On our side: prominent attribution, a dedicated API key with
>   elevated rate limits for [ORG]'s researchers, and access to our
>   /partners page.
> - On your side: a one-line acknowledgement of Iran Memorial as a
>   data partner, where appropriate in your own publications.
> - On both sides: a contact point for case corrections, methodology
>   feedback, and joint outreach when the work is mutually relevant
>   (sanctions submissions, asylum procedures, university adoption).
>
> Maintained by Woman Life Freedom e.V., based in Germany. We have no
> commercial agenda, no ads, no paywall.
>
> If this is interesting, I am happy to schedule a 30-minute call.
>
> Best,
> [YOUR NAME]
> Iran Memorial Project
> <CONTACT_EMAIL>

### Template — sanctions co-signatory (ECCHR / IHRDC / equivalent)

Subject: `Sanctions submission dossier — methodology + data offer`

> Dear [NAME],
>
> Iran Memorial has built an automated dossier generator for
> Magnitsky-style submissions: a single command produces an
> EU/OFAC/FCDO-formatted PDF for any named perpetrator (judge, court,
> security force) with statistical pattern of conduct, top-N
> documented incidents, and source citations.
>
> Sample dossier attached: Judge Salavati, generated from our 37,000-
> victim dataset. The methodology and source registry are public; full
> data is queryable via API.
>
> We have not submitted any of these to sanctions bodies yet — by
> design. The first dossier should be co-signed by an organisation
> with established standing in this work, which is why we are writing
> to you.
>
> Would [ECCHR / IHRDC] consider co-signing the first 1-3 submissions?
> The data and the technical work are ours; the legal craft and
> distribution channel is yours.
>
> Happy to discuss by call.
>
> Best,
> [YOUR NAME]

### Template — government / asylum-system pitch (BAMF, EUAA)

Subject: `Iran country-of-origin information — open dataset`

> Dear [DEPARTMENT],
>
> Asylum proceedings concerning Iran rely on country-of-origin
> information. Iran Memorial provides a structured, citable dataset of
> 37,000+ documented victims of the Islamic Republic since 1979,
> sourced from twelve verified human-rights organisations and updated
> weekly.
>
> The dataset is queryable via REST API and a public bulk dump
> (~30 MB JSON). It supports specifically the kinds of pattern queries
> that asylum cases turn on — execution rates by year, by province, by
> cause; current death-row populations; conviction patterns by
> specific courts and judges.
>
> We are offering [BAMF / EUAA] dedicated API access with elevated
> rate limits for case-officer use, with no commercial obligation.
> Methodology is published; data is CC BY-SA 4.0.
>
> Iran Memorial is maintained by Woman Life Freedom e.V., a registered
> German non-profit.
>
> Happy to demo by call.
>
> Best,
> [YOUR NAME]

## Conversion-rate expectations

Honest baseline:

- Cold-outreach emails to NGOs in this space: 30-50% reply rate
  (these orgs *are* responsive, the work is theirs too)
- Cold-outreach emails to academic researchers: 10-25% reply rate
  (slower, more variable, depends heavily on sabbatical timing)
- Government / institutional asylum agencies: 5-15% reply rate
  (slow, formal, often routed through wrong department first)

Plan for 5-10 emails per goal, not 1-2.

## Logging cadence

Update this file after every outreach send and after every reply.
Replies don't need verbatim transcription — one-line summary is
enough ("offered to review, deadline 4 weeks", "redirected to
colleague X", "polite decline, retry Q4").

If outreach is moving fast and updating this file becomes noise, drop
to weekly batch updates instead. The file's purpose is shared
visibility, not real-time.

## Privacy note

Personal email addresses, phone numbers, and individuals' affiliations
that they have not made public themselves do **not** belong in this
file. Use a private spreadsheet or a CRM (Notion / Airtable / similar)
for those, and link only the institutional public-facing relationship
here.
