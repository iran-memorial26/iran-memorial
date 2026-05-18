import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import type { Locale } from "@/i18n/config";

const VICTIM_COLUMNS = `
  v.id, v.slug, v.name_latin, v.name_farsi, v.aliases,
  v.date_of_birth, v.place_of_birth, v.gender, v.ethnicity, v.religion,
  COALESCE(
    (SELECT ph.url FROM photos ph WHERE ph.victim_id = v.id AND ph.is_primary = true AND ph.is_broken = false ORDER BY ph.sort_order LIMIT 1),
    v.photo_url
  ) AS photo_url,
  v.occupation_en, v.occupation_fa, v.occupation_de, v.education, v.family_info,
  v.dreams_en, v.dreams_fa, v.dreams_de, v.beliefs_en, v.beliefs_fa, v.beliefs_de,
  v.personality_en, v.personality_fa, v.personality_de, v.quotes,
  v.date_of_death, v.age_at_death, v.place_of_death, v.province,
  v.cause_of_death, v.circumstances_en, v.circumstances_fa, v.circumstances_de,
  v.event_id, v.event_context, v.responsible_forces, v.witnesses, v.last_seen,
  v.burial_location, v.burial_date, v.burial_circumstances_en, v.burial_circumstances_fa, v.burial_circumstances_de,
  v.grave_status, v.family_persecution_en, v.family_persecution_fa, v.family_persecution_de,
  v.legal_proceedings, v.tributes,
  v.verification_status, v.data_source, v.notes, v.created_at, v.updated_at,
  c.name_en AS city_name_en, c.name_fa AS city_name_fa, c.name_de AS city_name_de,
  p.name_en AS province_name_en, p.name_fa AS province_name_fa, p.name_de AS province_name_de,
  p.slug AS province_slug
`.trim();

const VICTIM_FROM = `FROM victims v LEFT JOIN cities c ON v.city_id = c.id LEFT JOIN provinces p ON c.province_id = p.id`;

export async function getVictimBySlug(slug: string, client = prisma) {
  const victim = await client.victim.findUnique({
    where: { slug },
    include: {
      event: true,
      sources: { include: { dataSource: true } },
      photos: { where: { isBroken: false }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      city: { include: { province: true } },
    },
  });
  if (!victim) return null;
  // Dedupe photos by served URL — after content-hash mirror, multiple DB rows
  // can rewrite to the same /photos/<id> file. Keep the first occurrence
  // (which by orderBy is the primary one) so the gallery never repeats the
  // same image. Also dedupe by content_hash where present, in case two
  // pre-mirror external URLs hash-collide but the URLs still differ.
  const seen = new Set<string>();
  victim.photos = victim.photos.filter((p) => {
    const key = p.contentHash || p.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return victim;
}

/**
 * Look up a permanent slug redirect. Returns the surviving victim's current
 * slug, or null if `fromSlug` has no redirect entry.
 *
 * Populated when two victim records are merged (dedup) or when a slug is
 * renamed. Consumed by /victims/[slug] on slug miss so external links
 * (Twitter, NGO reports, press citations) keep landing on the survivor.
 */
export async function getSlugRedirect(
  fromSlug: string,
  client = prisma
): Promise<{ toSlug: string } | null> {
  const row = await client.victimSlugRedirect.findUnique({
    where: { fromSlug },
    select: { toVictim: { select: { slug: true } } },
  });
  if (!row?.toVictim?.slug) return null;
  return { toSlug: row.toVictim.slug };
}

export async function getEventBySlug(slug: string, page = 1, pageSize = 50) {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      victims: {
        select: {
          slug: true,
          nameLatin: true,
          nameFarsi: true,
          dateOfDeath: true,
          placeOfDeath: true,
          causeOfDeath: true,
          photoUrl: true,
          city: { select: { nameEn: true, nameFa: true, nameDe: true } },
        },
        orderBy: { dateOfDeath: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      },
      sources: true,
      photos: { where: { isBroken: false }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      _count: { select: { victims: true } },
    },
  });
  if (!event) return null;
  const totalVictims = event._count.victims;
  return {
    ...event,
    totalVictims,
    totalPages: Math.ceil(totalVictims / pageSize),
    page,
  };
}

export async function getAllEvents() {
  return prisma.event.findMany({
    orderBy: { dateStart: "asc" },
    include: {
      _count: {
        select: { victims: true },
      },
      photos: { where: { isPrimary: true, isBroken: false }, take: 1 },
    },
  });
}

export async function getFilterOptions(locale: Locale) {
  const nameCol = locale === "fa" ? "p.name_fa" : locale === "de" ? "p.name_de" : "p.name_en";
  const [provinceRows, yearRange, caseTypeRows, unknownRows, eventRows] = await Promise.all([
    prisma.$queryRaw<{ slug: string; name: string }[]>`
      SELECT p.slug, ${Prisma.raw(nameCol)} AS name
      FROM provinces p
      WHERE EXISTS (
        SELECT 1 FROM cities ci
        JOIN victims vi ON vi.city_id = ci.id
        WHERE ci.province_id = p.id
      )
      ORDER BY name
    `,
    prisma.$queryRaw<{ min_year: number; max_year: number }[]>`
      SELECT
        EXTRACT(YEAR FROM MIN(date_of_death))::int AS min_year,
        EXTRACT(YEAR FROM MAX(date_of_death))::int AS max_year
      FROM victims
      WHERE date_of_death IS NOT NULL
    `,
    // Counts per case-type chip. Filters mirror the buildFilterFragment
    // case-type clauses so chip labels match what each filter actually shows.
    // 'name_latin != Unknown' excludes the 3.3k anonymous mass-execution
    // records — same default as the main /victims grid.
    prisma.$queryRaw<{ total: bigint; execution: bigint; imprisoned: bigint; death_in_custody: bigint; killed: bigint }[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE v.date_of_death IS NOT NULL AND v.cause_of_death ILIKE '%execution%') AS execution,
        COUNT(*) FILTER (WHERE v.date_of_death IS NULL) AS imprisoned,
        COUNT(*) FILTER (WHERE v.date_of_death IS NOT NULL AND v.cause_of_death ILIKE '%custody%') AS death_in_custody,
        COUNT(*) FILTER (WHERE v.date_of_death IS NOT NULL AND (v.cause_of_death ILIKE '%shooting%' OR v.cause_of_death ILIKE '%shot%' OR v.cause_of_death ILIKE '%bullet%')) AS killed
      FROM victims v
      WHERE v.name_latin != 'Unknown'
    `,
    // Unidentified victims count — surfaces the ~3.3k Boroumand mass-execution
    // records that are otherwise hidden by the default name_latin != 'Unknown'
    // filter. Used as a facet chip ?identified=false on /victims so the records
    // are reachable without forcing users to know the /anonymous-victims URL.
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM victims WHERE name_latin = 'Unknown'
    `,
    // Event list for the FilterBar dropdown. Only events that actually have
    // victims attached are surfaced — empty events would filter to nothing.
    // Title localized to current locale (with English fallback).
    prisma.$queryRaw<{ slug: string; title_en: string; title_fa: string | null; title_de: string | null }[]>`
      SELECT e.slug, e.title_en, e.title_fa, e.title_de
      FROM events e
      WHERE EXISTS (SELECT 1 FROM victims v WHERE v.event_id = e.id)
      ORDER BY e.date_start ASC
    `,
  ]);

  const minYear = Number(yearRange[0]?.min_year) || 1988;
  const maxYear = Number(yearRange[0]?.max_year) || new Date().getFullYear();

  const c = caseTypeRows[0] ?? ({} as Record<string, bigint | undefined>);
  const caseTypeCounts = {
    "": Number(c.total ?? 0),
    execution: Number(c.execution ?? 0),
    imprisoned: Number(c.imprisoned ?? 0),
    death_in_custody: Number(c.death_in_custody ?? 0),
    killed: Number(c.killed ?? 0),
  };

  const unknownCount = Number(unknownRows[0]?.count ?? 0);

  // Pick locale-correct title from the raw event rows. titleCol in the SQL
  // already does the COALESCE; mapping here keeps the public shape stable
  // ({ slug, title }) for the FilterBar dropdown regardless of locale.
  const events = eventRows.map((r) => ({
    slug: r.slug,
    title:
      (locale === "fa" ? r.title_fa : locale === "de" ? r.title_de : null) ||
      r.title_en,
  }));

  return {
    provinces: provinceRows,
    minYear,
    maxYear,
    caseTypeCounts,
    unknownCount,
    events,
  };
}

export async function getVictimsList(params: {
  page?: number;
  pageSize?: number;
  province?: string;
  year?: number;
  gender?: string;
  search?: string;
  verified?: boolean;
  caseType?: string;
  /** Filter to victims tied to a single event (slug). Enables /events
   *  curation pivots — "show me every PS752 victim" from the main grid. */
  event?: string;
  /** Set true to include the ~3,300 anonymous mass-execution records
   *  with name_latin = 'Unknown'. Default is false: they have their
   *  own /anonymous-victims page and would otherwise crowd the main
   *  /victims grid with unnamed placeholder cards. */
  includeUnknown?: boolean;
}) {
  const { page = 1, pageSize = 24, province, year, gender, search, verified, caseType, event, includeUnknown = false } = params;

  // If we have a search query, use raw SQL for tsvector + trigram
  if (search && search.trim()) {
    return searchVictimsList({ page, pageSize, province, year, gender, search: search.trim(), verified, caseType, event, includeUnknown });
  }

  // Use raw SQL to sort photos-first
  const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 24)));
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeOffset = (safePage - 1) * safePageSize;
  const filterFrag = buildFilterFragment({ province, year, gender, verified, caseType, event, includeUnknown });
  const columns = Prisma.raw(VICTIM_COLUMNS);
  const from = Prisma.raw(VICTIM_FROM);

  const [victims, countResult] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT ${columns}
      ${from}
      WHERE 1=1 ${filterFrag}
      ORDER BY (v.photo_url IS NOT NULL OR EXISTS(SELECT 1 FROM photos ph WHERE ph.victim_id = v.id AND ph.is_primary = true AND ph.is_broken = false)) DESC, v.date_of_death DESC NULLS LAST
      LIMIT ${safePageSize} OFFSET ${safeOffset}
    `,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total ${from} WHERE 1=1 ${filterFrag}
    `,
  ]);

  const total = Number(countResult[0]?.total) || 0;
  return { victims: mapRawVictims(victims), total, page: safePage, pageSize: safePageSize, totalPages: Math.ceil(total / safePageSize) };
}

/** Build safe parameterized filter fragment for raw SQL */
function buildFilterFragment(params: {
  province?: string;
  year?: number;
  gender?: string;
  verified?: boolean;
  caseType?: string;
  event?: string;
  includeUnknown?: boolean;
}): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];

  // Hide anonymous mass-execution records by default (they're shown on
  // /anonymous-victims). Override with ?includeUnknown=true.
  if (!params.includeUnknown) {
    clauses.push(Prisma.sql`v.name_latin != 'Unknown'`);
  }

  if (params.province && typeof params.province === "string") {
    clauses.push(Prisma.sql`p.slug = ${params.province}`);
  }
  if (params.event && typeof params.event === "string") {
    // Subquery so the user-supplied slug is fully parameterized.
    clauses.push(Prisma.sql`v.event_id = (SELECT id FROM events WHERE slug = ${params.event})`);
  }
  if (params.gender && typeof params.gender === "string") {
    const valid = ["male", "female", "unknown"];
    if (valid.includes(params.gender.toLowerCase())) {
      clauses.push(Prisma.sql`v.gender = ${params.gender}`);
    }
  }
  if (params.year && Number.isInteger(params.year) && params.year >= 1900 && params.year <= 2100) {
    const yearStart = `${params.year}-01-01`;
    const yearEnd = `${params.year}-12-31`;
    clauses.push(Prisma.sql`v.date_of_death >= ${yearStart}::date AND v.date_of_death <= ${yearEnd}::date`);
  }
  if (params.verified === true) {
    clauses.push(Prisma.sql`v.verification_status = 'verified'`);
  }
  if (params.caseType && typeof params.caseType === "string") {
    if (params.caseType === "imprisoned") {
      clauses.push(Prisma.sql`v.date_of_death IS NULL`);
    } else if (params.caseType === "execution") {
      clauses.push(Prisma.sql`v.date_of_death IS NOT NULL AND v.cause_of_death ILIKE '%execution%'`);
    } else if (params.caseType === "death_in_custody") {
      clauses.push(Prisma.sql`v.date_of_death IS NOT NULL AND v.cause_of_death ILIKE '%custody%'`);
    } else if (params.caseType === "killed") {
      clauses.push(Prisma.sql`v.date_of_death IS NOT NULL AND (v.cause_of_death ILIKE '%shooting%' OR v.cause_of_death ILIKE '%shot%' OR v.cause_of_death ILIKE '%bullet%')`);
    }
  }

  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(clauses, " AND ")}`;
}

async function searchVictimsList(params: {
  page: number;
  pageSize: number;
  province?: string;
  year?: number;
  gender?: string;
  search: string;
  verified?: boolean;
  caseType?: string;
  event?: string;
  includeUnknown?: boolean;
}) {
  const { page, province, year, gender, search, verified, caseType, event, includeUnknown } = params;
  // Sanitize pagination
  const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(params.pageSize) || 24)));
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeOffset = (safePage - 1) * safePageSize;
  const MIN_TSVECTOR_RESULTS = 5;

  // Sanitize search: limit length, strip control characters
  const cleanSearch = search.slice(0, 200).replace(/[^\p{L}\p{N}\s\-'.]/gu, "");
  if (!cleanSearch.trim()) return { victims: [], total: 0, page: safePage, pageSize: safePageSize, totalPages: 0 };

  // Build tsquery: split words, join with &, add prefix matching
  const tsQuery = cleanSearch
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w}:*`)
    .join(" & ");

  const filterFrag = buildFilterFragment({ province, year, gender, verified, caseType, event, includeUnknown });
  const columns = Prisma.raw(VICTIM_COLUMNS);
  const from = Prisma.raw(VICTIM_FROM);

  // Step 1: Fast tsvector search (uses GIN index, ~1ms)
  const tsResults = await prisma.$queryRaw<any[]>`
    SELECT ${columns},
      ts_rank(v.search_vector, to_tsquery('simple_unaccent', unaccent(${tsQuery}))) AS ts_score
    ${from}
    WHERE v.search_vector @@ to_tsquery('simple_unaccent', unaccent(${tsQuery}))
    ${filterFrag}
    ORDER BY ts_score DESC
    LIMIT ${safePageSize} OFFSET ${safeOffset}
  `;

  const tsCount = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total ${from}
    WHERE v.search_vector @@ to_tsquery('simple_unaccent', unaccent(${tsQuery})) ${filterFrag}
  `;

  const tsTotal = Number(tsCount[0]?.total) || 0;

  // Step 2: If tsvector found enough results, return them
  if (tsTotal >= MIN_TSVECTOR_RESULTS) {
    return {
      victims: mapRawVictims(tsResults),
      total: tsTotal,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(tsTotal / safePageSize),
    };
  }

  // Step 3: Trigram fallback for fuzzy/typo matches (slower, ~50ms)
  const [victims, countResult] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT ${columns},
        ts_rank(v.search_vector, to_tsquery('simple_unaccent', unaccent(${tsQuery}))) AS ts_score,
        GREATEST(
          similarity(v.name_latin, ${cleanSearch}),
          similarity(coalesce(v.name_farsi, ''), ${cleanSearch})
        ) AS trgm_score
      ${from}
      WHERE v.search_vector @@ to_tsquery('simple_unaccent', unaccent(${tsQuery}))
        OR similarity(v.name_latin, ${cleanSearch}) > 0.15
        OR similarity(coalesce(v.name_farsi, ''), ${cleanSearch}) > 0.15
      ${filterFrag}
      ORDER BY ts_score DESC, trgm_score DESC
      LIMIT ${safePageSize} OFFSET ${safeOffset}
    `,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total ${from}
      WHERE v.search_vector @@ to_tsquery('simple_unaccent', unaccent(${tsQuery}))
        OR similarity(v.name_latin, ${cleanSearch}) > 0.15
        OR similarity(coalesce(v.name_farsi, ''), ${cleanSearch}) > 0.15
      ${filterFrag}
    `,
  ]);

  const total = Number(countResult[0]?.total) || 0;

  return {
    victims: mapRawVictims(victims),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  };
}

export async function searchVictims(query: string, limit = 20, client = prisma) {
  // Local alias keeps the existing `prisma.$queryRaw` calls below valid
  // while routing through whichever client (read-only or default) the caller
  // chose. Defense-in-depth: public MCP routes pass the readonly client.
  const prisma = client;

  // Sanitize: limit length, strip control characters
  const trimmed = query.trim().slice(0, 200).replace(/[^\p{L}\p{N}\s\-'.]/gu, "");
  if (!trimmed) return [];

  const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)));
  const MIN_TSVECTOR_RESULTS = 5;
  const columns = Prisma.raw(VICTIM_COLUMNS);
  const from = Prisma.raw(VICTIM_FROM);

  // Build tsquery with prefix matching
  const tsQuery = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w}:*`)
    .join(" & ");

  // Step 1: Fast tsvector search (~1ms with GIN index)
  const tsResults = await prisma.$queryRaw<any[]>`
    SELECT ${columns},
      ts_rank(v.search_vector, to_tsquery('simple_unaccent', unaccent(${tsQuery}))) AS ts_score
    ${from}
    WHERE v.search_vector @@ to_tsquery('simple_unaccent', unaccent(${tsQuery}))
    ORDER BY ts_score DESC
    LIMIT ${safeLimit}
  `;

  if (tsResults.length >= MIN_TSVECTOR_RESULTS) {
    return mapRawVictims(tsResults);
  }

  // Step 2: Trigram fallback for fuzzy/typo matches
  const results = await prisma.$queryRaw<any[]>`
    SELECT ${columns},
      ts_rank(v.search_vector, to_tsquery('simple_unaccent', unaccent(${tsQuery}))) AS ts_score,
      GREATEST(
        similarity(v.name_latin, ${trimmed}),
        similarity(coalesce(v.name_farsi, ''), ${trimmed})
      ) AS trgm_score
    ${from}
    WHERE v.search_vector @@ to_tsquery('simple_unaccent', unaccent(${tsQuery}))
      OR similarity(v.name_latin, ${trimmed}) > 0.15
      OR similarity(coalesce(v.name_farsi, ''), ${trimmed}) > 0.15
    ORDER BY ts_score DESC, trgm_score DESC
    LIMIT ${safeLimit}
  `;

  return mapRawVictims(results);
}

/** Map snake_case raw SQL rows to camelCase Prisma-style objects */
export function mapRawVictims(rows: any[]) {
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nameLatin: r.name_latin,
    nameFarsi: r.name_farsi,
    aliases: r.aliases,
    dateOfBirth: r.date_of_birth,
    placeOfBirth: r.place_of_birth,
    gender: r.gender,
    ethnicity: r.ethnicity,
    religion: r.religion,
    photoUrl: r.photo_url,
    occupationEn: r.occupation_en,
    occupationFa: r.occupation_fa,
    occupationDe: r.occupation_de,
    education: r.education,
    familyInfo: r.family_info,
    dreamsEn: r.dreams_en,
    dreamsFa: r.dreams_fa,
    dreamsDe: r.dreams_de,
    beliefsEn: r.beliefs_en,
    beliefsFa: r.beliefs_fa,
    beliefsDe: r.beliefs_de,
    personalityEn: r.personality_en,
    personalityFa: r.personality_fa,
    personalityDe: r.personality_de,
    quotes: r.quotes,
    dateOfDeath: r.date_of_death,
    ageAtDeath: r.age_at_death,
    placeOfDeath: r.place_of_death,
    province: r.province,
    cityNameEn: r.city_name_en || null,
    cityNameFa: r.city_name_fa || null,
    cityNameDe: r.city_name_de || null,
    provinceNameEn: r.province_name_en || null,
    provinceNameFa: r.province_name_fa || null,
    provinceNameDe: r.province_name_de || null,
    provinceSlug: r.province_slug || null,
    causeOfDeath: r.cause_of_death,
    circumstancesEn: r.circumstances_en,
    circumstancesFa: r.circumstances_fa,
    circumstancesDe: r.circumstances_de,
    eventId: r.event_id,
    eventContext: r.event_context,
    responsibleForces: r.responsible_forces,
    witnesses: r.witnesses,
    lastSeen: r.last_seen,
    burialLocation: r.burial_location,
    burialDate: r.burial_date,
    burialCircumstancesEn: r.burial_circumstances_en,
    burialCircumstancesFa: r.burial_circumstances_fa,
    burialCircumstancesDe: r.burial_circumstances_de,
    graveStatus: r.grave_status,
    familyPersecutionEn: r.family_persecution_en,
    familyPersecutionFa: r.family_persecution_fa,
    familyPersecutionDe: r.family_persecution_de,
    legalProceedings: r.legal_proceedings,
    tributes: r.tributes,
    verificationStatus: r.verification_status,
    dataSource: r.data_source,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getStats(client = prisma) {
  const prisma = client;
  // 2026 protest executions: protesters executed since March 2026 in
  // connection with the Dec-2025 / Jan-2026 uprising. Drives the
  // homepage urgency banner; updates live as new cases come in.
  const protestExecutionsSince = new Date("2026-03-01");
  const [
    victimCount,
    eventCount,
    sourceCount,
    recentProtestExecutions,
    deathRowCount,
    verifiedCount,
    photoCount,
    dataSourceCount,
  ] = await Promise.all([
    prisma.victim.count(),
    prisma.event.count(),
    prisma.source.count(),
    prisma.victim.count({
      where: {
        dateOfDeath: { gte: protestExecutionsSince },
        causeOfDeath: { contains: "Execution", mode: "insensitive" },
        verificationStatus: "verified",
      },
    }),
    prisma.victim.count({
      where: {
        dateOfDeath: null,
        causeOfDeath: { contains: "sentenced", mode: "insensitive" },
      },
    }),
    prisma.victim.count({ where: { verificationStatus: "verified" } }),
    prisma.photo.count({ where: { isBroken: false } }),
    prisma.dataSource.count(),
  ]);

  return {
    victimCount,
    eventCount,
    sourceCount,
    yearsOfRepression: new Date().getFullYear() - 1979,
    recentProtestExecutions,
    deathRowCount,
    verifiedCount,
    photoCount,
    dataSourceCount,
  };
}

export async function getRecentVictims(limit = 6) {
  return prisma.victim.findMany({
    select: {
      slug: true,
      nameLatin: true,
      nameFarsi: true,
      dateOfDeath: true,
      placeOfDeath: true,
      causeOfDeath: true,
      photoUrl: true,
      city: {
        select: {
          nameEn: true,
          nameFa: true,
          nameDe: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getHeroMosaicPhotos(limit = 60) {
  // Verified victims with at least one healthy photo, ordered by date so the
  // mosaic mixes recent + historical faces. Only hits primary photos (1 per
  // victim) to avoid duplicates.
  const rows = await prisma.victim.findMany({
    where: {
      verificationStatus: "verified",
      photos: { some: { isBroken: false, isPrimary: true } },
    },
    select: {
      slug: true,
      nameLatin: true,
      nameFarsi: true,
      photos: {
        where: { isBroken: false, isPrimary: true },
        select: { url: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows
    .filter((r) => r.photos[0]?.url)
    .map((r) => ({ slug: r.slug, name: r.nameLatin, nameFa: r.nameFarsi, url: r.photos[0]!.url }));
}

export async function getRelatedVictims(eventId: string, excludeSlug: string, limit = 6) {
  return prisma.victim.findMany({
    where: { eventId, NOT: { slug: excludeSlug } },
    select: {
      slug: true,
      nameLatin: true,
      nameFarsi: true,
      dateOfDeath: true,
      photoUrl: true,
      causeOfDeath: true,
    },
    orderBy: { dateOfDeath: "asc" },
    take: limit,
  });
}

/**
 * Pivot counts for the "Explore" section on a victim detail page. Turns an
 * isolated profile into an investigation surface — "this victim, plus 213
 * others in Tehran, plus 89 other 2022 executions." Counts exclude the
 * current victim and skip pivots that would only yield the same person.
 *
 * Returns null fields when no meaningful pivot exists (no city, no death
 * date, single-victim event).
 */
export async function getVictimPivots(victim: {
  id: string;
  cityId?: string | null;
  city?: { slug?: string | null; provinceId?: string | null; province?: { slug?: string | null; nameEn?: string | null; nameFa?: string | null; nameDe?: string | null } | null; nameEn?: string | null; nameFa?: string | null; nameDe?: string | null } | null;
  dateOfDeath?: Date | string | null;
  causeOfDeath?: string | null;
}) {
  const tasks: Array<Promise<unknown>> = [];

  // 1) Same province pivot (broader than city since most victims have province
  // via city.provinceId; cities themselves are too granular for a default chip).
  const provinceSlug = victim.city?.province?.slug ?? null;
  if (provinceSlug) {
    tasks.push(
      prisma.victim.count({
        where: {
          NOT: { id: victim.id },
          nameLatin: { not: "Unknown" },
          city: { province: { slug: provinceSlug } },
        },
      })
    );
  } else {
    tasks.push(Promise.resolve(0));
  }

  // 2) Same year-of-death pivot.
  const year = victim.dateOfDeath
    ? new Date(victim.dateOfDeath).getUTCFullYear()
    : null;
  if (year && Number.isInteger(year) && year >= 1900 && year <= 2100) {
    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year + 1}-01-01`);
    tasks.push(
      prisma.victim.count({
        where: {
          NOT: { id: victim.id },
          nameLatin: { not: "Unknown" },
          dateOfDeath: { gte: yearStart, lt: yearEnd },
        },
      })
    );
  } else {
    tasks.push(Promise.resolve(0));
  }

  // 3) Same year + same case-type pivot. Refines #2 for executions specifically.
  // Mirrors buildFilterFragment's caseType clauses so the chip's count equals
  // what /victims?year=Y&caseType=X actually returns.
  const cause = (victim.causeOfDeath || "").toLowerCase();
  let caseType: string | null = null;
  if (cause.includes("execution") || cause.includes("hanging")) caseType = "execution";
  else if (cause.includes("custody")) caseType = "death_in_custody";
  else if (
    cause.includes("shooting") ||
    cause.includes("shot") ||
    cause.includes("bullet")
  )
    caseType = "killed";

  if (year && caseType) {
    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year + 1}-01-01`);
    const causeFilter =
      caseType === "execution"
        ? { contains: "execution", mode: "insensitive" as const }
        : caseType === "death_in_custody"
        ? { contains: "custody", mode: "insensitive" as const }
        : { contains: "shooting", mode: "insensitive" as const };
    tasks.push(
      prisma.victim.count({
        where: {
          NOT: { id: victim.id },
          nameLatin: { not: "Unknown" },
          dateOfDeath: { gte: yearStart, lt: yearEnd },
          causeOfDeath: causeFilter,
        },
      })
    );
  } else {
    tasks.push(Promise.resolve(0));
  }

  const [provinceCount, yearCount, yearCaseTypeCount] = (await Promise.all(
    tasks
  )) as number[];

  return {
    province:
      provinceSlug && provinceCount > 0
        ? {
            slug: provinceSlug,
            nameEn: victim.city?.province?.nameEn ?? null,
            nameFa: victim.city?.province?.nameFa ?? null,
            nameDe: victim.city?.province?.nameDe ?? null,
            count: provinceCount,
          }
        : null,
    year:
      year && yearCount > 0
        ? {
            year,
            count: yearCount,
          }
        : null,
    yearCaseType:
      year && caseType && yearCaseTypeCount > 0
        ? {
            year,
            caseType,
            count: yearCaseTypeCount,
          }
        : null,
  };
}

export async function getAccountabilityAggregates() {
  // Extract specific courts and judges from victims.responsible_forces
  // for the /accountability page. Generic phrases like "Islamic Republic
  // security forces" are skipped — only named courts (Branch X / Court of
  // City) and named judges contribute to the accountability picture.
  const [courts, judges] = await Promise.all([
    prisma.$queryRaw<{ court: string; count: number }[]>`
      WITH matches AS (
        SELECT DISTINCT v.id,
          CASE
            -- "Branch 15 of Tehran Revolutionary Court" → keep "of" so the
            -- canonical name matches the source string in subsequent
            -- contains-queries.
            WHEN responsible_forces ~* 'Branch [0-9]+ (of )?[A-Z][a-zA-Z\\- ]+? Revolutionary Court'
              THEN SUBSTRING(responsible_forces FROM 'Branch [0-9]+ (?:of )?[A-Z][a-zA-Z\\- ]+? Revolutionary Court')
            WHEN responsible_forces ~* '(Islamic )?Revolutionary Court of [A-Z][a-zA-Z\\- ]+'
              THEN SUBSTRING(responsible_forces FROM '(?:Islamic )?Revolutionary Court of [A-Z][a-zA-Z\\- ]+')
            ELSE NULL
          END AS court
        FROM victims v
        WHERE responsible_forces IS NOT NULL AND responsible_forces != ''
      )
      SELECT TRIM(court) AS court, COUNT(*)::int AS count
      FROM matches WHERE court IS NOT NULL
      GROUP BY TRIM(court)
      HAVING COUNT(*) >= 1
      ORDER BY count DESC, court
    `,
    prisma.$queryRaw<{ judge: string; count: number }[]>`
      WITH matches AS (
        SELECT DISTINCT v.id,
          SUBSTRING(responsible_forces FROM 'Judge ([A-Z][a-zA-Z\\- ]+?)(?:\\)|;|,|$)') AS judge
        FROM victims v
        WHERE responsible_forces ~* 'Judge [A-Z]'
      )
      SELECT TRIM(judge) AS judge, COUNT(*)::int AS count
      FROM matches WHERE judge IS NOT NULL AND TRIM(judge) != ''
      GROUP BY TRIM(judge)
      ORDER BY count DESC, judge
    `,
  ]);

  // Merge judge spelling variants by surname (last token).
  // "Abolghasem Salavati" + "Abolqasem Salavati" + "Salavati" all
  // resolve to one canonical key by surname; longest spelled form
  // becomes the display label.
  const judgesBySurname = new Map<string, { name: string; count: number }>();
  for (const j of judges) {
    const tokens = j.judge.trim().split(/\s+/);
    const surname = tokens[tokens.length - 1].toLowerCase();
    const existing = judgesBySurname.get(surname);
    if (!existing) {
      judgesBySurname.set(surname, { name: j.judge.trim(), count: Number(j.count) });
    } else {
      existing.count += Number(j.count);
      if (j.judge.trim().length > existing.name.length) existing.name = j.judge.trim();
    }
  }

  return {
    courts: courts.map((c) => ({ name: c.court, count: Number(c.count) })),
    judges: Array.from(judgesBySurname.values()).sort((a, b) => b.count - a.count),
  };
}

export async function getVictimsByResponsibleParty(query: string, page = 1, pageSize = 30) {
  // Find all victims whose responsible_forces contains the given string.
  // Used by /accountability/[slug] drill-down.
  const skip = (page - 1) * pageSize;
  const where = {
    responsibleForces: { contains: query, mode: "insensitive" as const },
  };
  const [victims, total] = await Promise.all([
    prisma.victim.findMany({
      where,
      select: {
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        dateOfDeath: true,
        placeOfDeath: true,
        causeOfDeath: true,
        verificationStatus: true,
        photoUrl: true,
      },
      orderBy: [{ dateOfDeath: { sort: "desc", nulls: "last" } }, { slug: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.victim.count({ where }),
  ]);
  return { victims, total, page, totalPages: Math.ceil(total / pageSize) };
}

export async function getAnonymousVictims(page = 1, pageSize = 30) {
  // Records imported from Boroumand 1980s mass-execution archive where
  // the name was never recorded or has been lost. We surface them on a
  // dedicated /anonymous-victims page (separate from the main /victims
  // grid where they would crowd out named profiles).
  const skip = (page - 1) * pageSize;
  const where = { nameLatin: "Unknown" as const };
  const [victims, total] = await Promise.all([
    prisma.victim.findMany({
      where,
      select: {
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        dateOfDeath: true,
        placeOfDeath: true,
        causeOfDeath: true,
        province: true,
        verificationStatus: true,
        photoUrl: true,
      },
      orderBy: [{ dateOfDeath: { sort: "asc", nulls: "last" } }, { slug: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.victim.count({ where }),
  ]);
  return { victims, total, page, totalPages: Math.ceil(total / pageSize) };
}

export async function getDeathRowVictims(page = 1, pageSize = 50, client = prisma) {
  const prisma = client;
  // People currently sentenced to death and awaiting execution.
  // Distinct from /imprisoned (general detention) and /executions
  // (already-killed). Drives advocacy CTA — these are the people
  // letters can still save.
  const skip = (page - 1) * pageSize;
  const where = {
    dateOfDeath: null,
    causeOfDeath: { contains: "sentenced", mode: "insensitive" as const },
  };
  const [victims, total] = await Promise.all([
    prisma.victim.findMany({
      where,
      select: {
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        causeOfDeath: true,
        placeOfDeath: true,
        dateOfBirth: true,
        verificationStatus: true,
        photoUrl: true,
        circumstancesEn: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.victim.count({ where }),
  ]);
  return { victims, total, page, totalPages: Math.ceil(total / pageSize) };
}

export async function getImprisonedVictims(page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize;
  // Living + cause set, but exclude execution-cause records (those are
  // 1980s-era mass-execution victims with no recorded date — they
  // belong on /executions, not /imprisoned).
  const where = {
    dateOfDeath: null,
    causeOfDeath: { not: null },
    NOT: [
      { causeOfDeath: { contains: "execution", mode: "insensitive" as const } },
      { causeOfDeath: { contains: "executed", mode: "insensitive" as const } },
      { causeOfDeath: { contains: "hanging", mode: "insensitive" as const } },
      { causeOfDeath: { contains: "hanged", mode: "insensitive" as const } },
    ],
  };
  const [victims, total] = await Promise.all([
    prisma.victim.findMany({
      where,
      select: {
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        causeOfDeath: true,
        placeOfDeath: true,
        dateOfBirth: true,
        verificationStatus: true,
        photoUrl: true,
        dataSource: true,
        circumstancesEn: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.victim.count({ where }),
  ]);
  return { victims, total, page, totalPages: Math.ceil(total / pageSize) };
}

export type ExecutionMethod = "hanging" | "shooting" | "stoning" | "custody" | "other";

const METHOD_PATTERNS: Record<ExecutionMethod, string[]> = {
  hanging: ["hang"], // matches "Hanging", "hanged"
  shooting: ["shooting", "firing squad"],
  stoning: ["stoning", "stoned"],
  custody: ["custody", "in custody"],
  other: [],
};

export async function getExecutedVictims(
  page = 1,
  pageSize = 50,
  filters: {
    method?: ExecutionMethod;
    year?: number;
    province?: string;
    court?: string;
    verifiedOnly?: boolean;
  } = {},
  client = prisma,
) {
  const prisma = client;
  const skip = (page - 1) * pageSize;
  // Cause-only filter (no dateOfDeath gate) — ~1,400 1980s mass-execution
  // entries from Boroumand have execution cause but no recorded date and
  // were silently excluded before. They are still executed; they just
  // lack a precise date. Exclude only the *living* sentenced-to-death
  // category (their cause is "Sentenced to death (imprisoned)" — no
  // overlap with the patterns below).
  type WhereType = {
    OR?: { causeOfDeath: { contains: string; mode: "insensitive" } }[];
    AND?: WhereType[];
    NOT?: WhereType;
    causeOfDeath?: { contains: string; mode: "insensitive" };
    dateOfDeath?: { gte: Date; lte: Date };
    province?: string;
    responsibleForces?: { contains: string; mode: "insensitive" };
    verificationStatus?: string;
  };

  const where: WhereType = {
    OR: [
      { causeOfDeath: { contains: "execution", mode: "insensitive" } },
      { causeOfDeath: { contains: "executed", mode: "insensitive" } },
      { causeOfDeath: { contains: "hanging", mode: "insensitive" } },
      { causeOfDeath: { contains: "hanged", mode: "insensitive" } },
      { causeOfDeath: { contains: "firing squad", mode: "insensitive" } },
      { causeOfDeath: { contains: "اعدام", mode: "insensitive" } },
      { causeOfDeath: { contains: "Hinrichtung", mode: "insensitive" } },
      { causeOfDeath: { contains: "hingerichtet", mode: "insensitive" } },
    ],
    NOT: {
      causeOfDeath: { contains: "Sentenced", mode: "insensitive" },
    },
  };

  const andClauses: WhereType[] = [];

  // Method filter — substring match on cause_of_death
  if (filters.method && filters.method !== "other") {
    const patterns = METHOD_PATTERNS[filters.method];
    andClauses.push({
      OR: patterns.map((p) => ({
        causeOfDeath: { contains: p, mode: "insensitive" as const },
      })),
    });
  } else if (filters.method === "other") {
    // Records that match the executions filter but NONE of the known methods
    const knownPatterns = [
      ...METHOD_PATTERNS.hanging,
      ...METHOD_PATTERNS.shooting,
      ...METHOD_PATTERNS.stoning,
      ...METHOD_PATTERNS.custody,
    ];
    for (const p of knownPatterns) {
      andClauses.push({
        NOT: { causeOfDeath: { contains: p, mode: "insensitive" as const } },
      });
    }
  }

  // Year filter
  if (filters.year && filters.year >= 1979 && filters.year <= 2100) {
    andClauses.push({
      dateOfDeath: {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31`),
      },
    });
  }

  // Province filter — exact match on victims.province (post-normalization
  // there's a stable canonical set: Tehran, Esfahan, Khuzestan, etc.).
  if (filters.province) {
    andClauses.push({ province: filters.province } as WhereType);
  }

  // Court / Judge filter — substring match on responsible_forces. The
  // /accountability page passes the canonical name including "of".
  if (filters.court) {
    andClauses.push({
      responsibleForces: { contains: filters.court, mode: "insensitive" },
    });
  }

  // Verified-only toggle
  if (filters.verifiedOnly) {
    andClauses.push({ verificationStatus: "verified" } as WhereType);
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }
  const [victims, total] = await Promise.all([
    prisma.victim.findMany({
      where,
      select: {
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        causeOfDeath: true,
        placeOfDeath: true,
        dateOfDeath: true,
        dateOfBirth: true,
        verificationStatus: true,
        photoUrl: true,
        dataSource: true,
        circumstancesEn: true,
        responsibleForces: true,
        createdAt: true,
      },
      // Records without dateOfDeath sort to the bottom (NULLS LAST).
      orderBy: [{ dateOfDeath: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.victim.count({ where }),
  ]);
  return { victims, total, page, totalPages: Math.ceil(total / pageSize) };
}

export async function getExecutionFacets() {
  // Drives filter UI on /executions: list of years, methods, provinces,
  // and courts that have at least one execution. Counts are computed
  // against the same execution scope used by getExecutedVictims so the
  // filter dropdowns match what the listing actually contains.
  const [yearRows, methodCounts, provinceRows, courtRows, verifiedCount] = await Promise.all([
    prisma.$queryRaw<{ year: number; count: number }[]>`
      SELECT EXTRACT(YEAR FROM date_of_death)::int AS year,
             COUNT(*)::int AS count
      FROM victims
      WHERE date_of_death IS NOT NULL
        AND cause_of_death ILIKE '%execution%'
        AND cause_of_death NOT ILIKE '%sentenced%'
      GROUP BY year ORDER BY year DESC
    `,
    prisma.$queryRaw<{ method: string; count: number }[]>`
      SELECT
        CASE
          WHEN cause_of_death ILIKE '%hang%' THEN 'hanging'
          WHEN cause_of_death ILIKE '%shooting%' OR cause_of_death ILIKE '%firing squad%' THEN 'shooting'
          WHEN cause_of_death ILIKE '%stoning%' OR cause_of_death ILIKE '%stoned%' THEN 'stoning'
          WHEN cause_of_death ILIKE '%custody%' THEN 'custody'
          ELSE 'other'
        END AS method,
        COUNT(*)::int AS count
      FROM victims
      WHERE cause_of_death ILIKE '%execution%'
        AND cause_of_death NOT ILIKE '%sentenced%'
      GROUP BY method
    `,
    prisma.$queryRaw<{ province: string; count: number }[]>`
      SELECT province, COUNT(*)::int AS count
      FROM victims
      WHERE cause_of_death ILIKE '%execution%'
        AND cause_of_death NOT ILIKE '%sentenced%'
        AND province IS NOT NULL AND province != ''
      GROUP BY province ORDER BY count DESC, province
    `,
    prisma.$queryRaw<{ court: string; count: number }[]>`
      WITH matches AS (
        SELECT DISTINCT id,
          CASE
            WHEN responsible_forces ~* 'Branch [0-9]+ (of )?[A-Z][a-zA-Z\\- ]+? Revolutionary Court'
              THEN SUBSTRING(responsible_forces FROM 'Branch [0-9]+ (?:of )?[A-Z][a-zA-Z\\- ]+? Revolutionary Court')
            WHEN responsible_forces ~* '(Islamic )?Revolutionary Court of [A-Z][a-zA-Z\\- ]+'
              THEN SUBSTRING(responsible_forces FROM '(?:Islamic )?Revolutionary Court of [A-Z][a-zA-Z\\- ]+')
            ELSE NULL
          END AS court
        FROM victims
        WHERE cause_of_death ILIKE '%execution%'
          AND cause_of_death NOT ILIKE '%sentenced%'
          AND responsible_forces IS NOT NULL
      )
      SELECT TRIM(court) AS court, COUNT(*)::int AS count
      FROM matches WHERE court IS NOT NULL
      GROUP BY TRIM(court) ORDER BY count DESC, court
    `,
    prisma.victim.count({
      where: {
        verificationStatus: "verified",
        OR: [
          { causeOfDeath: { contains: "execution", mode: "insensitive" } },
          { causeOfDeath: { contains: "executed", mode: "insensitive" } },
          { causeOfDeath: { contains: "hanging", mode: "insensitive" } },
        ],
        NOT: { causeOfDeath: { contains: "sentenced", mode: "insensitive" } },
      },
    }),
  ]);

  return {
    years: yearRows.map((r) => ({ year: r.year, count: Number(r.count) })),
    methods: Object.fromEntries(methodCounts.map((r) => [r.method, Number(r.count)])),
    provinces: provinceRows.map((r) => ({ name: r.province, count: Number(r.count) })),
    courts: courtRows.map((r) => ({ name: r.court, count: Number(r.count) })),
    verifiedCount,
  };
}

export async function getStatistics(locale: Locale = "en") {
  const nameCol = locale === "fa" ? "p.name_fa" : locale === "de" ? "p.name_de" : "p.name_en";
  const [
    totalVictims,
    deathsByYear,
    deathsByProvince,
    deathsByCause,
    ageDistribution,
    genderBreakdown,
    dataSources,
    verifiedCount,
    tierDistribution,
    sourcesPerVictim,
  ] = await Promise.all([
    prisma.victim.count(),

    prisma.$queryRaw<{ year: number; count: number }[]>`
      SELECT EXTRACT(YEAR FROM date_of_death)::int AS year, COUNT(*)::int AS count
      FROM victims WHERE date_of_death IS NOT NULL
      GROUP BY year ORDER BY year
    `,

    prisma.$queryRaw<{ province: string; count: number }[]>`
      SELECT ${Prisma.raw(nameCol)} AS province, COUNT(*)::int AS count
      FROM victims v
      JOIN cities c ON v.city_id = c.id
      JOIN provinces p ON c.province_id = p.id
      GROUP BY p.id, ${Prisma.raw(nameCol)}
      ORDER BY count DESC LIMIT 15
    `,

    prisma.$queryRaw<{ cause: string; count: number }[]>`
      SELECT cause_of_death AS cause, COUNT(*)::int AS count
      FROM victims WHERE cause_of_death IS NOT NULL AND cause_of_death != ''
      GROUP BY cause_of_death ORDER BY count DESC LIMIT 10
    `,

    prisma.$queryRaw<{ bucket: string; count: number }[]>`
      SELECT
        CASE
          WHEN age_at_death < 18 THEN 'Under 18'
          WHEN age_at_death BETWEEN 18 AND 25 THEN '18-25'
          WHEN age_at_death BETWEEN 26 AND 35 THEN '26-35'
          WHEN age_at_death BETWEEN 36 AND 50 THEN '36-50'
          WHEN age_at_death > 50 THEN 'Over 50'
        END AS bucket, COUNT(*)::int AS count
      FROM victims WHERE age_at_death IS NOT NULL
      GROUP BY bucket ORDER BY MIN(age_at_death)
    `,

    prisma.$queryRaw<{ gender: string; count: number }[]>`
      SELECT COALESCE(gender, 'unknown') AS gender, COUNT(*)::int AS count
      FROM victims GROUP BY gender ORDER BY count DESC
    `,

    prisma.$queryRaw<{ source: string; count: number }[]>`
      WITH normalized AS (
        SELECT
          -- Strip per-record id suffixes "iranvictims.com (#6914)" → "iranvictims.com"
          -- and take the primary source from comma-lists.
          LOWER(TRIM(REGEXP_REPLACE(
            SPLIT_PART(data_source, ',', 1),
            '\\s*\\(#?\\d+\\)\\s*$', ''
          ))) AS raw_key
        FROM victims
        WHERE data_source IS NOT NULL AND data_source != ''
      )
      SELECT
        -- Map internal import-script names + spelling variants to a single
        -- canonical, user-friendly source name.
        CASE
          WHEN raw_key LIKE 'boroumand%' OR raw_key = 'iranrights.org' THEN 'Abdorrahman Boroumand Center'
          WHEN raw_key LIKE 'iranvictims%' THEN 'iranvictims.com'
          WHEN raw_key LIKE 'iranrevolution%' THEN 'iranrevolution.online'
          WHEN raw_key LIKE 'witness%' OR raw_key = 'witness.report' THEN 'witness.report'
          WHEN raw_key LIKE 'hrana%' OR raw_key LIKE '%82day%' THEN 'HRANA (Human Rights Activists)'
          WHEN raw_key LIKE 'telegram%rtn%' OR raw_key LIKE '%remembertheirnames%' THEN '@RememberTheirNames (Telegram)'
          WHEN raw_key LIKE 'telegram%vahid%' OR raw_key LIKE '%vahidonline%' THEN '@VahidOnline (Telegram)'
          WHEN raw_key LIKE 'wikipedia%' OR raw_key LIKE 'wiki%' THEN 'Wikipedia'
          WHEN raw_key LIKE 'iranmonitor%' OR raw_key LIKE 'iran monitor%' THEN 'Iran Monitor'
          WHEN raw_key LIKE 'iranintl%' OR raw_key = 'iran-international' OR raw_key = 'iran international' THEN 'Iran International'
          WHEN raw_key LIKE 'iranhr%' OR raw_key LIKE 'ihr%' OR raw_key LIKE '%suspicious-deaths%' THEN 'Iran Human Rights (IHR)'
          WHEN raw_key LIKE 'amnesty%' THEN 'Amnesty International'
          WHEN raw_key = 'hengaw' OR raw_key LIKE 'hengaw%' THEN 'Hengaw'
          WHEN raw_key = 'cpj' OR raw_key LIKE 'cpj%' OR raw_key LIKE '%journalist%' THEN 'Committee to Protect Journalists (CPJ)'
          WHEN raw_key = 'khrn' OR raw_key LIKE 'khrn%' OR raw_key LIKE 'kurdistan%' THEN 'Kurdistan Human Rights Network'
          WHEN raw_key = 'ncri' OR raw_key LIKE 'ncri%' THEN 'NCRI'
          WHEN raw_key = 'ohchr' OR raw_key LIKE '%un%' OR raw_key = 'un' THEN 'OHCHR (UN)'
          WHEN raw_key = 'igfm' THEN 'IGFM'
          WHEN raw_key LIKE 'iran-memorial%' OR raw_key LIKE 'iran memorial%' THEN 'Iran Memorial Project (own research)'
          ELSE INITCAP(raw_key)
        END AS source,
        COUNT(*)::int AS count
      FROM normalized
      GROUP BY 1
      ORDER BY count DESC
    `,

    prisma.victim.count({ where: { verificationStatus: "verified" } }),

    // Tier distribution: highest credibility tier present per victim.
    prisma.$queryRaw<{ tier: string; count: number }[]>`
      WITH per_victim AS (
        SELECT
          v.id,
          MAX(CASE
            WHEN ds.credibility = 'HIGH' THEN 4
            WHEN ds.credibility = 'MEDIUM' THEN 3
            WHEN ds.credibility = 'LOW' THEN 2
            WHEN ds.credibility = 'UNVERIFIED' THEN 1
            ELSE 0
          END) AS top_tier
        FROM victims v
        LEFT JOIN sources s ON s.victim_id = v.id
        LEFT JOIN data_sources ds ON ds.id = s.data_source_id
        GROUP BY v.id
      )
      SELECT
        CASE top_tier
          WHEN 4 THEN 'high'
          WHEN 3 THEN 'reputable'
          WHEN 2 THEN 'community'
          WHEN 1 THEN 'community'
          ELSE 'unsourced'
        END AS tier,
        COUNT(*)::int AS count
      FROM per_victim
      GROUP BY tier
      ORDER BY tier
    `,

    // Sources-per-victim histogram.
    prisma.$queryRaw<{ bucket: string; count: number }[]>`
      WITH per_victim AS (
        SELECT v.id, COUNT(s.id) AS src_count
        FROM victims v LEFT JOIN sources s ON s.victim_id = v.id
        GROUP BY v.id
      )
      SELECT
        CASE
          WHEN src_count = 0 THEN '0'
          WHEN src_count = 1 THEN '1'
          WHEN src_count = 2 THEN '2'
          WHEN src_count BETWEEN 3 AND 5 THEN '3-5'
          WHEN src_count BETWEEN 6 AND 10 THEN '6-10'
          ELSE '11+'
        END AS bucket,
        COUNT(*)::int AS count
      FROM per_victim
      GROUP BY bucket
      ORDER BY MIN(src_count)
    `,
  ]);

  const yearMap = new Map(deathsByYear.map((r) => [Number(r.year), Number(r.count)]));
  const years = [...yearMap.keys()].filter(Boolean);
  const minYear = years.length > 0 ? Math.min(...years) : 0;
  const maxYear = years.length > 0 ? Math.max(...years) : 0;
  const fullYears: { year: number; count: number }[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    fullYears.push({ year: y, count: yearMap.get(y) || 0 });
  }
  const provinceCount = new Set(
    deathsByProvince.map((r) => r.province)
  ).size;

  return {
    totalVictims,
    deathsByYear: fullYears,
    deathsByProvince: deathsByProvince.map((r) => ({ label: r.province, count: Number(r.count) })),
    deathsByCause: deathsByCause.map((r) => ({ label: r.cause, count: Number(r.count) })),
    ageDistribution: ageDistribution.map((r) => ({ label: r.bucket, count: Number(r.count) })),
    genderBreakdown: genderBreakdown.map((r) => ({ label: r.gender, count: Number(r.count) })),
    dataSources: dataSources.map((r) => ({ label: r.source, count: Number(r.count) })),
    verifiedCount,
    tierDistribution: tierDistribution.map((r) => ({ label: r.tier, count: Number(r.count) })),
    sourcesPerVictim: sourcesPerVictim.map((r) => ({ label: r.bucket, count: Number(r.count) })),
    yearsCovered: years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : "–",
    provincesAffected: provinceCount,
  };
}

export async function getDeathsByYearAndEvent(): Promise<{ year: number; eventSlug: string | null; eventTitle: string | null; count: number }[]> {
  const rows = await prisma.$queryRaw<{ year: number; event_slug: string | null; event_title: string | null; count: number }[]>`
    SELECT
      EXTRACT(YEAR FROM v.date_of_death)::int AS year,
      e.slug AS event_slug,
      e.title_en AS event_title,
      COUNT(*)::int AS count
    FROM victims v
    LEFT JOIN events e ON v.event_id = e.id
    WHERE v.date_of_death IS NOT NULL
    GROUP BY year, e.slug, e.title_en
    ORDER BY year, count DESC
  `;
  return rows.map(r => ({
    year: Number(r.year),
    eventSlug: r.event_slug,
    eventTitle: r.event_title,
    count: Number(r.count),
  }));
}

export type Statistics = Awaited<ReturnType<typeof getStatistics>>;

export type EventStatistics = {
  totalVictims: number;
  verifiedCount: number;
  provincesAffected: number;
  deathsByProvince: { label: string; count: number }[];
  deathsByCause: { label: string; count: number }[];
  ageDistribution: { label: string; count: number }[];
  genderBreakdown: { label: string; count: number }[];
};

export async function getEventStatistics(
  eventId: string,
  locale: Locale = "en"
): Promise<EventStatistics> {
  const nameCol =
    locale === "fa" ? "p.name_fa" : locale === "de" ? "p.name_de" : "p.name_en";

  const [
    totalResult,
    deathsByProvince,
    deathsByCause,
    ageDistribution,
    genderBreakdown,
    verifiedResult,
    provinceCountResult,
  ] = await Promise.all([
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM victims WHERE event_id = ${eventId}::uuid
    `,

    prisma.$queryRaw<{ province: string; count: number }[]>`
      SELECT ${Prisma.raw(nameCol)} AS province, COUNT(*)::int AS count
      FROM victims v
      JOIN cities c ON v.city_id = c.id
      JOIN provinces p ON c.province_id = p.id
      WHERE v.event_id = ${eventId}::uuid
      GROUP BY p.id, ${Prisma.raw(nameCol)}
      ORDER BY count DESC LIMIT 15
    `,

    prisma.$queryRaw<{ cause: string; count: number }[]>`
      SELECT cause_of_death AS cause, COUNT(*)::int AS count
      FROM victims
      WHERE event_id = ${eventId}::uuid
        AND cause_of_death IS NOT NULL AND cause_of_death != ''
      GROUP BY cause_of_death ORDER BY count DESC LIMIT 10
    `,

    prisma.$queryRaw<{ bucket: string; count: number }[]>`
      SELECT
        CASE
          WHEN age_at_death < 18 THEN 'Under 18'
          WHEN age_at_death BETWEEN 18 AND 25 THEN '18-25'
          WHEN age_at_death BETWEEN 26 AND 35 THEN '26-35'
          WHEN age_at_death BETWEEN 36 AND 50 THEN '36-50'
          WHEN age_at_death > 50 THEN 'Over 50'
        END AS bucket, COUNT(*)::int AS count
      FROM victims
      WHERE event_id = ${eventId}::uuid AND age_at_death IS NOT NULL
      GROUP BY bucket ORDER BY MIN(age_at_death)
    `,

    prisma.$queryRaw<{ gender: string; count: number }[]>`
      SELECT COALESCE(gender, 'unknown') AS gender, COUNT(*)::int AS count
      FROM victims
      WHERE event_id = ${eventId}::uuid
      GROUP BY gender ORDER BY count DESC
    `,

    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM victims
      WHERE event_id = ${eventId}::uuid AND verification_status = 'verified'
    `,

    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT p.id)::int AS count
      FROM victims v
      JOIN cities c ON v.city_id = c.id
      JOIN provinces p ON c.province_id = p.id
      WHERE v.event_id = ${eventId}::uuid
    `,
  ]);

  return {
    totalVictims: Number(totalResult[0]?.count) || 0,
    verifiedCount: Number(verifiedResult[0]?.count) || 0,
    provincesAffected: Number(provinceCountResult[0]?.count) || 0,
    deathsByProvince: deathsByProvince.map((r) => ({
      label: r.province,
      count: Number(r.count),
    })),
    deathsByCause: deathsByCause.map((r) => ({
      label: r.cause,
      count: Number(r.count),
    })),
    ageDistribution: ageDistribution.map((r) => ({
      label: r.bucket,
      count: Number(r.count),
    })),
    genderBreakdown: genderBreakdown.map((r) => ({
      label: r.gender,
      count: Number(r.count),
    })),
  };
}
export type PartnerStats = {
  apiKeyId: string;
  name: string;
  totalRequests: number;
  requestsLast7Days: number;
  requestsLast30Days: number;
  lastUsedAt: Date | null;
  endpoints: { endpoint: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
};

export async function getPartnerStatistics(apiKeyId?: string): Promise<PartnerStats[]> {
  // For queries with "au" alias (Query 1 with JOIN)
  const whereConditionWithAlias = apiKeyId ? Prisma.sql`au.api_key_id = ${apiKeyId}` : Prisma.empty;
  const whereClauseWithAlias = apiKeyId ? Prisma.sql`WHERE ${whereConditionWithAlias}` : Prisma.empty;

  // For queries without alias (Query 2, 3, 4, 5 - standalone api_usage table)
  const whereCondition = apiKeyId ? Prisma.sql`api_key_id = ${apiKeyId}` : Prisma.empty;
  const whereClause = apiKeyId ? Prisma.sql`WHERE ${whereCondition}` : Prisma.empty;

  // Query 1: Total requests per API key (uses "au" alias)
  const totals = await prisma.$queryRaw<
    { api_key_id: string; name: string; total: number; last_used: Date | null }[]
  >`
    SELECT
      ak.id AS api_key_id,
      ak.name,
      COUNT(au.id)::int AS total,
      MAX(au.created_at) AS last_used
    FROM api_keys ak
    LEFT JOIN api_usage au ON ak.id = au.api_key_id
    ${whereClauseWithAlias}
    GROUP BY ak.id, ak.name
    ORDER BY total DESC
  `;

  // Query 2: Requests in last 7 days
  const last7Days = await prisma.$queryRaw<{ api_key_id: string; count: number }[]>`
    SELECT
      api_key_id,
      COUNT(*)::int AS count
    FROM api_usage
    WHERE created_at >= NOW() - INTERVAL '7 days'
    ${apiKeyId ? Prisma.sql`AND ${whereCondition}` : Prisma.empty}
    GROUP BY api_key_id
  `;

  // Query 3: Requests in last 30 days
  const last30Days = await prisma.$queryRaw<{ api_key_id: string; count: number }[]>`
    SELECT
      api_key_id,
      COUNT(*)::int AS count
    FROM api_usage
    WHERE created_at >= NOW() - INTERVAL '30 days'
    ${apiKeyId ? Prisma.sql`AND ${whereCondition}` : Prisma.empty}
    GROUP BY api_key_id
  `;

  // Query 4: Endpoint breakdown
  const endpoints = await prisma.$queryRaw<
    { api_key_id: string; endpoint: string; count: number }[]
  >`
    SELECT
      api_key_id,
      endpoint,
      COUNT(*)::int AS count
    FROM api_usage
    ${whereClause}
    GROUP BY api_key_id, endpoint
    ORDER BY count DESC
  `;

  // Query 5: Daily usage (last 30 days)
  const dailyUsage = await prisma.$queryRaw<
    { api_key_id: string; date: string; count: number }[]
  >`
    SELECT
      api_key_id,
      DATE(created_at) AS date,
      COUNT(*)::int AS count
    FROM api_usage
    WHERE created_at >= NOW() - INTERVAL '30 days'
    ${apiKeyId ? Prisma.sql`AND ${whereCondition}` : Prisma.empty}
    GROUP BY api_key_id, DATE(created_at)
    ORDER BY date ASC
  `;

  // Combine results
  return totals.map((t) => ({
    apiKeyId: t.api_key_id,
    name: t.name,
    totalRequests: t.total,
    requestsLast7Days: last7Days.find((d) => d.api_key_id === t.api_key_id)?.count || 0,
    requestsLast30Days: last30Days.find((d) => d.api_key_id === t.api_key_id)?.count || 0,
    lastUsedAt: t.last_used,
    endpoints: endpoints.filter((e) => e.api_key_id === t.api_key_id),
    dailyUsage: dailyUsage
      .filter((d) => d.api_key_id === t.api_key_id)
      .map((d) => ({ date: d.date, count: d.count })),
  }));
}

export type VictimDetail = NonNullable<Awaited<ReturnType<typeof getVictimBySlug>>>;
export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>;
export type EventWithCount = Awaited<ReturnType<typeof getAllEvents>>[number];
export type VictimListItem = Awaited<ReturnType<typeof getRecentVictims>>[number];
export type PhotoItem = VictimDetail["photos"][number];
export type StatsResult = Awaited<ReturnType<typeof getStats>>;

// Helper to get localized field
export function localized<T extends Record<string, any>>(
  item: T,
  field: string,
  locale: Locale
): string | null {
  // DB columns currently exist only for the original 7 locales (e.g. nameEn,
  // nameFa, nameDe, nameAr, nameFr, nameIt, nameEs). The 9 newer locales added
  // 2026-05-11 (he, ru, tr, ckb, hi, ur, sv, nl, zh) read English content for
  // localized DB fields (event titles, city names, etc.). UI strings come from
  // messages/{locale}.json and are fully translated in all 16 languages.
  const suffixMap: Record<Locale, string> = {
    en: "En", fa: "Fa", de: "De", ar: "Ar", fr: "Fr", it: "It", es: "Es",
    he: "En", ru: "En", tr: "En", ckb: "En", hi: "En", ur: "En", sv: "En", nl: "En", zh: "En",
  };
  const localizedKey = `${field}${suffixMap[locale]}`;
  const fallbackKey = `${field}En`;

  return (item[localizedKey] as string) || (item[fallbackKey] as string) || null;
}
