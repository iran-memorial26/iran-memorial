/**
 * Public roadmap data — single source of truth for /roadmap page.
 *
 * Maintainers: edit this file when something moves from Next → Now or
 * Now → Done. Each item is rendered into the public page, so write copy
 * a journalist or NGO partner could quote.
 *
 * Status meanings:
 *   - now:     actively in progress this quarter
 *   - next:    committed for the next 1-2 quarters
 *   - later:   on the radar, no committed timeline
 *   - done:    shipped, kept here for ~1 quarter for transparency
 *
 * Dependency tags signal what unblocks an item:
 *   - funding:      needs grant / donation / sponsor
 *   - partners:     needs an NGO / academic / legal partner
 *   - volunteers:   needs maintainer or translator capacity
 *   - tech:         purely engineering, no external dependency
 *   - regulatory:   needs legal review / compliance step
 */

export type RoadmapStatus = "now" | "next" | "later" | "done";
export type RoadmapDependency =
  | "funding"
  | "partners"
  | "volunteers"
  | "tech"
  | "regulatory";

export interface RoadmapItem {
  title: string;
  description: string;
  status: RoadmapStatus;
  dependencies: RoadmapDependency[];
  /** ISO date when this item was last reviewed/updated. */
  updated: string;
  /** Optional link to public discussion or doc. */
  link?: string;
}

export const ROADMAP_LAST_REVIEWED = "2026-05-13";

export const ROADMAP: RoadmapItem[] = [
  // ─── NOW (active this quarter) ─────────────────────────────────────────
  {
    title: "Sanctions submission toolkit",
    description:
      "Generator that turns a court or judge name into a Magnitsky-style submission dossier (PDF) for EU EEAS, OFAC, FCDO, and SEMA. First three submissions co-signed with ECCHR Berlin and IHRDC by end of quarter.",
    status: "now",
    dependencies: ["partners"],
    updated: "2026-05-09",
    link: "https://github.com/iran-memorial26/iran-memorial/blob/main/docs/IMPACT-SANCTIONS-TOOLKIT.md",
  },
  {
    title: "Wikidata systematic linking",
    description:
      "Match every victim profile against Wikidata. Add bidirectional links (our slug ↔ their QID) so Iran Memorial entries surface in Google Knowledge Panels, Siri, and every major LLM by default.",
    status: "now",
    dependencies: ["volunteers", "tech"],
    updated: "2026-05-09",
  },
  {
    title: "MCP registry adoption",
    description:
      "Submit the Iran Memorial MCP server to Anthropic's MCP Registry, Cursor Directory, Cline marketplace, and Awesome-MCP. Each registry that lists us gives any MCP-aware LLM an authoritative citation source for IRI-related questions.",
    status: "now",
    dependencies: ["tech"],
    updated: "2026-05-09",
    link: "https://github.com/iran-memorial26/iran-memorial/blob/main/docs/IMPACT-MCP-LISTING.md",
  },
  {
    title: "Victim profile data parity (form + render)",
    description:
      "The public submit form previously exposed only about half of the victim schema. Migration 20260512210000 closes that gap: occupation, age, gender, ethnicity, religion, and place_of_birth become first-class submit fields, plus 13 new structured columns — 5 education fields (field_of_study, university_name, university_city, degree_level, graduation_year) and 8 online-presence fields (instagram_handle, x_handle, linkedin_url, github_handle, telegram_handle, facebook_url, youtube_channel_url, website_url). Submit form, detail page render, and Person JSON-LD all gain these fields in this milestone.",
    status: "now",
    dependencies: ["tech"],
    updated: "2026-05-12",
  },
  {
    title: "Edge & abuse-resistance hardening",
    description:
      "Tighten the layer between Cloudflare and the application: lock origin ingress to Cloudflare ranges, replace the wildcard image-optimizer allowlist with a vetted source list, switch IP attribution to CF-Connecting-IP, and add Turnstile on community-write endpoints. Defensive maintenance — no public-facing change, but raises the cost of automated abuse and origin-bypass attacks. Internal audit: docs/SECURITY-AUDIT-2026-05-13.md.",
    status: "now",
    dependencies: ["tech"],
    updated: "2026-05-13",
  },
  {
    title: "Schema.org gold-standard compliance",
    description:
      "Expand the Person JSON-LD on every victim page with hasOccupation, alumniOf, sameAs (linking the new social handles), and knowsLanguage. Add WebSite + SearchAction JSON-LD to the root layout so Google can offer a sitelinks search box. Add Dataset JSON-LD to /developers so the archive shows up in Google Dataset Search and is citable as a primary academic source.",
    status: "now",
    dependencies: ["tech"],
    updated: "2026-05-12",
  },

  // ─── NEXT (committed, 1-2 quarters out) ────────────────────────────────
  {
    title: "Telegram channel + bot",
    description:
      "@IranMemorial Telegram channel with daily digest of newly verified victims (Farsi + English). Reaches the Iran-diaspora audience that lives on messaging apps, not on websites.",
    status: "next",
    dependencies: ["volunteers"],
    updated: "2026-05-09",
  },
  {
    title: "Adopt-a-Victim program",
    description:
      "Community members can commit to maintaining a single victim profile — completing missing fields, adding new sources, contacting family with consent. Mod-supervised. Every steward listed publicly with their consent.",
    status: "next",
    dependencies: ["volunteers", "tech"],
    updated: "2026-05-09",
  },
  {
    title: "Methodology pre-print on SSRN",
    description:
      "Formal academic write-up of verification methodology, three-tier credibility model, deduplication algorithm, and source registry. Citable in papers and court filings.",
    status: "next",
    dependencies: ["partners"],
    updated: "2026-05-09",
  },
  {
    title: "Public verification page (/verify)",
    description:
      "One-click in-browser verification of any INTEGRITY-LOG row against a public IPFS gateway. Makes hash-chain manipulation visibly impossible to journalists and academics.",
    status: "next",
    dependencies: ["tech"],
    updated: "2026-05-09",
  },
  {
    title: "Partner badge program",
    description:
      "White-labeled embed widgets for NGO and academic partners. ECCHR site can display 'ECCHR Partner — 37,041 documented' linking back. UTM tracking for impact reporting.",
    status: "next",
    dependencies: ["partners", "tech"],
    updated: "2026-05-09",
  },
  {
    title: "Tier-2 goldstandard fields",
    description:
      "Schema migration for 13 additional structured columns: mother_tongue, prison_name, prison_cell_block, arrest_date, arrest_location, charges_en, charges_fa, lawyer_name, last_words_en, last_words_fa, international_recognition, media_attention, family_member_killed. Brings the per-victim record to forensic-archive depth — the level expected by tribunals and academic citation.",
    status: "next",
    dependencies: ["tech"],
    updated: "2026-05-12",
  },
  {
    title: "Wikidata sync",
    description:
      "Bidirectional sync between verified victim profiles and Wikidata items (Q-numbers). Pushes verified facts upstream so the archive feeds knowledge graphs — Google Knowledge Panel, DBpedia, Wikipedia infoboxes — and pulls cross-source corroboration back. Goes beyond linking by closing the write-back loop.",
    status: "next",
    dependencies: ["tech", "volunteers"],
    updated: "2026-05-12",
  },
  {
    title: "HURIDOCS Events Standard Format export",
    description:
      "Add /api/v1/huridocs/export returning the archive in the human-rights-NGO-standard XML format. Required for zero-glue-code partnership with Amnesty International, FIDH, and OHCHR-style organizations whose case-management systems already speak HURIDOCS.",
    status: "next",
    dependencies: ["tech", "partners"],
    updated: "2026-05-12",
  },

  // ─── LATER (radar, no timeline) ────────────────────────────────────────
  {
    title: "Kurdish locale (Sorani + Kurmanji)",
    description:
      "Largest Iran-affected language community after Farsi — currently uncovered. Needs a translation partner.",
    status: "later",
    dependencies: ["volunteers", "partners"],
    updated: "2026-05-09",
  },
  {
    title: "Dedicated perpetrator schema",
    description:
      "Replace text-based extraction from victims.responsible_forces with a typed perpetrators table (court, judge, period, sanctioned status, victim count). Powers richer accountability + sanctions UX.",
    status: "later",
    dependencies: ["tech"],
    updated: "2026-05-09",
  },
  {
    title: "Photo provenance tracking",
    description:
      "Every photo gets sourceUrl + SHA-256 + verifiedBy fields. Disputes ('that's the wrong person') become resolvable. Defends against IRI manipulation campaigns.",
    status: "later",
    dependencies: ["tech"],
    updated: "2026-05-09",
  },
  {
    title: "Independent foundation",
    description:
      "Move stewardship from Woman Life Freedom e.V. into a dedicated Stiftung or international NGO partnership once the project's reach justifies it. Spreads jurisdictional risk.",
    status: "later",
    dependencies: ["funding", "regulatory"],
    updated: "2026-05-09",
  },
  {
    title: "Multi-jurisdiction mirroring",
    description:
      "Negotiate hosting agreements with NGO partners in 3 continents (DE/EU, US, Asia/Pacific) so the live site has independent failover. Currently mirrors are git-only.",
    status: "later",
    dependencies: ["partners", "funding"],
    updated: "2026-05-09",
  },
  {
    title: "Open Citations & DOI minting via Zenodo",
    description:
      "Assign a persistent DOI to each snapshot of the archive via Zenodo, so academic citations resolve forever and are immune to domain takedown. Makes Iran Memorial a citable primary source in the same class as institutional research datasets.",
    status: "later",
    dependencies: ["partners"],
    updated: "2026-05-12",
  },

  // ─── DONE (shipped, kept ~1 quarter for transparency) ──────────────────
  {
    title: "DB-level read-only enforcement",
    description:
      "Public MCP and dump routes connect via a separate Postgres role with GRANT SELECT only. A buggy commit that slips a write into a public path is rejected at the database layer, not the application layer.",
    status: "done",
    dependencies: [],
    updated: "2026-05-09",
    link: "https://github.com/iran-memorial26/iran-memorial/blob/main/docs/SECURITY-AUDIT-2026-05-09.md",
  },
  {
    title: "Tor hidden service",
    description:
      "Iran Memorial reachable as a v3 .onion. Tor Browser users on the clearnet are auto-redirected via Onion-Location header. Bypasses DNS-level censorship inside Iran.",
    status: "done",
    dependencies: [],
    updated: "2026-05-09",
    link: "https://github.com/iran-memorial26/iran-memorial/blob/main/docs/RESILIENCE-TOR.md",
  },
  {
    title: "MCP server + 5 read-only tools",
    description:
      "search_victims, get_victim, get_executions, get_death_row, get_statistics — usable from Claude Desktop, Cursor, Cline. Public, no auth, app + DB read-only enforcement.",
    status: "done",
    dependencies: [],
    updated: "2026-05-09",
  },
  {
    title: "Open-source readiness",
    description:
      "LICENSE (MIT for code, CC BY-SA 4.0 for data), CONTRIBUTING.md (data-ethics ground rules), SECURITY.md (vulnerability reporting). Repository ready for community handover.",
    status: "done",
    dependencies: [],
    updated: "2026-05-09",
  },
  {
    title: "Press kit page (/press)",
    description:
      "Citable stats, embeddable counter, latest verified profiles, brand & citation block, press contact. Self-service for journalists.",
    status: "done",
    dependencies: [],
    updated: "2026-05-09",
  },
  {
    title: "Slug-redirect infrastructure + dedup-date graduation",
    description:
      "Permanent 308 redirects route old slugs to surviving records after a dedup merge, so external citations and Wikidata QID links never 404. Date-mismatch scoring graduated from a flat -100 penalty to a 30/90/365-day curve, so genuine duplicates with disagreeing death-date estimates (e.g. the Jamshid Sharmahd 1955/2024 pair) are now surfaced at score 35 in the review tier instead of being silently discarded. Sharmahd duplicate merged on production 2026-05-12.",
    status: "done",
    dependencies: [],
    updated: "2026-05-12",
  },
];
