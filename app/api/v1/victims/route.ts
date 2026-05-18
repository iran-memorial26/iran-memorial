import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

const VICTIM_FIELDS = `
  v.id, v.slug, v.name_latin, v.name_farsi, v.aliases,
  v.date_of_birth, v.date_of_death, v.age_at_death, v.place_of_death, v.province,
  v.gender, v.cause_of_death, v.photo_url, v.verification_status, v.data_source,
  c.name_en AS city_name_en, c.name_fa AS city_name_fa, c.name_de AS city_name_de,
  p.name_en AS province_name_en, p.name_fa AS province_name_fa, p.name_de AS province_name_de,
  e.slug AS event_slug, e.title_en AS event_title_en, e.title_fa AS event_title_fa
`.trim();

const VICTIM_FROM = `FROM victims v
  LEFT JOIN cities c ON v.city_id = c.id
  LEFT JOIN provinces p ON c.province_id = p.id
  LEFT JOIN events e ON v.event_id = e.id`;

export async function GET(request: NextRequest) {
  const endpoint = "/api/v1/victims";

  // Verify API key
  const { context, error } = await verifyApiKey(request);
  if (error || !context) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check (use key-specific limit)
  const { success, remaining, resetAt } = await checkApiKeyRateLimit(
    context.apiKeyId,
    endpoint,
    context.rateLimit
  );

  if (!success) {
    logApiUsage(context.apiKeyId, endpoint, "GET", 429, request);
    return NextResponse.json(
      { error: "Rate limit exceeded", retry_after: Math.ceil((resetAt - Date.now()) / 1000) },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(context.rateLimit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
        },
      }
    );
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  // Filters
  const eventSlug = searchParams.get("event");
  const provinceSlug = searchParams.get("province");
  const yearStart = searchParams.get("year_start");
  const yearEnd = searchParams.get("year_end");
  const gender = searchParams.get("gender");
  const verified = searchParams.get("verified"); // "true" | "false"

  // Build filter conditions
  const filters: Prisma.Sql[] = [];

  if (eventSlug) filters.push(Prisma.sql`e.slug = ${eventSlug}`);
  if (provinceSlug) filters.push(Prisma.sql`p.slug = ${provinceSlug}`);
  if (gender && ["male", "female", "unknown"].includes(gender.toLowerCase())) {
    filters.push(Prisma.sql`v.gender = ${gender}`);
  }
  if (verified === "true") {
    filters.push(Prisma.sql`v.verification_status = 'verified'`);
  }
  if (yearStart && /^\d{4}$/.test(yearStart)) {
    filters.push(Prisma.sql`v.date_of_death >= ${yearStart + "-01-01"}::date`);
  }
  if (yearEnd && /^\d{4}$/.test(yearEnd)) {
    filters.push(Prisma.sql`v.date_of_death <= ${yearEnd + "-12-31"}::date`);
  }

  const whereClause = filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;
  const fields = Prisma.raw(VICTIM_FIELDS);
  const from = Prisma.raw(VICTIM_FROM);

  try {
    const [victims, countResult] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT ${fields} ${from} ${whereClause}
        ORDER BY v.date_of_death DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total ${from} ${whereClause}
      `,
    ]);

    const total = Number(countResult[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit);

    const mapped = victims.map((v) => ({
      id: v.id,
      slug: v.slug,
      name_latin: v.name_latin,
      name_farsi: v.name_farsi,
      aliases: v.aliases || [],
      date_of_birth: v.date_of_birth,
      date_of_death: v.date_of_death,
      age_at_death: v.age_at_death,
      place_of_death: v.place_of_death,
      province: v.province,
      city_name_en: v.city_name_en,
      city_name_fa: v.city_name_fa,
      city_name_de: v.city_name_de,
      province_name_en: v.province_name_en,
      province_name_fa: v.province_name_fa,
      province_name_de: v.province_name_de,
      gender: v.gender,
      cause_of_death: v.cause_of_death,
      photo_url: v.photo_url,
      verification_status: v.verification_status,
      data_source: v.data_source,
      event: v.event_slug
        ? {
            slug: v.event_slug,
            title_en: v.event_title_en,
            title_fa: v.event_title_fa,
          }
        : null,
    }));

    logApiUsage(context.apiKeyId, endpoint, "GET", 200, request);

    return NextResponse.json(
      {
        data: mapped,
        meta: {
          page,
          limit,
          total,
          total_pages: totalPages,
        },
      },
      {
        headers: {
          "X-RateLimit-Limit": String(context.rateLimit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
        },
      }
    );
  } catch (err) {
    logApiUsage(context.apiKeyId, endpoint, "GET", 500, request);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
