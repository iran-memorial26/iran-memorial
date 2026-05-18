import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { rateLimit } from "@/lib/rate-limit";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { isAdmin } from "@/lib/admin-auth";

const EXPORT_FIELDS = `
  v.id, v.slug, v.name_latin, v.name_farsi, v.aliases,
  v.date_of_birth, v.place_of_birth, v.gender, v.ethnicity, v.religion, v.photo_url,
  v.occupation_en, v.occupation_fa, v.occupation_de, v.education,
  v.date_of_death, v.age_at_death, v.place_of_death, v.province,
  v.cause_of_death, v.circumstances_en, v.circumstances_fa, v.circumstances_de,
  v.event_context, v.responsible_forces,
  v.burial_location, v.verification_status, v.data_source,
  v.created_at, v.updated_at,
  c.name_en AS city_name_en, c.name_fa AS city_name_fa,
  p.name_en AS province_name_en, p.name_fa AS province_name_fa
`.trim();

function formatDate(d: unknown): string | null {
  if (!d) return null;
  return new Date(d as string).toISOString().split("T")[0];
}

function escapeForJsonLd(value: string | null | undefined): string {
  return value || "";
}

function victimToJsonLd(r: Record<string, unknown>): Record<string, unknown> {
  const slug = r.slug as string;
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": `${BASE_URL}/en/victims/${slug}`,
    name: r.name_latin,
    url: `${BASE_URL}/en/victims/${slug}`,
  };

  if (r.name_farsi) person.alternateName = r.name_farsi;
  if (r.date_of_birth) person.birthDate = formatDate(r.date_of_birth);
  if (r.place_of_birth) {
    person.birthPlace = { "@type": "Place", name: r.place_of_birth };
  }
  if (r.gender) person.gender = r.gender;
  if (r.occupation_en) person.jobTitle = r.occupation_en;
  if (r.photo_url) person.image = r.photo_url;
  if (r.date_of_death) person.deathDate = formatDate(r.date_of_death);

  const cityName = escapeForJsonLd(r.city_name_en as string | null);
  const provinceName = escapeForJsonLd(r.province_name_en as string | null);
  if (cityName || provinceName || r.place_of_death) {
    const placeParts = [cityName, provinceName].filter(Boolean);
    person.deathPlace = {
      "@type": "Place",
      name: placeParts.length > 0 ? placeParts.join(", ") : r.place_of_death,
    };
  }

  if (r.cause_of_death) person["schema:causeOfDeath"] = r.cause_of_death;
  if (r.circumstances_en) person.description = r.circumstances_en;
  if (r.age_at_death != null) person["schema:ageAtDeath"] = r.age_at_death;

  return person;
}

export async function GET(request: NextRequest) {
  // Admin-only access
  if (!isAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 401 }
    );
  }

  // Rate limiting: 10 requests per hour
  const ip =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const { success } = await rateLimit(ip, "archive", 10, 3600);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // Fetch all victims with city/province joins
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`SELECT ${Prisma.raw(EXPORT_FIELDS)}
     FROM victims v
     LEFT JOIN cities c ON v.city_id = c.id
     LEFT JOIN provinces p ON c.province_id = p.id
     ORDER BY v.date_of_death DESC NULLS LAST`
  );

  const [victimCount, sourceCount] = await Promise.all([
    prisma.victim.count(),
    prisma.source.count(),
  ]);

  const now = new Date().toISOString();

  const dataset = {
    "@context": {
      "@vocab": "https://schema.org/",
      schema: "https://schema.org/",
      dcterms: "http://purl.org/dc/terms/",
    },
    "@type": "Dataset",
    "@id": `${BASE_URL}/api/archive`,
    name: "Iran Memorial — Victims of the Islamic Republic of Iran (1979-present)",
    description:
      "A comprehensive dataset documenting victims of the Islamic Republic of Iran since 1979. " +
      "Includes biographical information, circumstances of death, geographic data, and source documentation.",
    url: BASE_URL,
    license: "https://creativecommons.org/licenses/by-sa/4.0/",
    "dcterms:rights": "CC BY-SA 4.0",
    creator: {
      "@type": "Organization",
      name: "Woman, Life, Freedom e.V. (WLF e.V.)",
      url: process.env.NEXT_PUBLIC_ORG_URL ?? "",
    },
    publisher: {
      "@type": "Organization",
      name: "Iran Memorial Project",
      url: BASE_URL,
    },
    datePublished: now.split("T")[0],
    dateModified: now,
    temporalCoverage: "1979/..",
    spatialCoverage: {
      "@type": "Place",
      name: "Iran",
    },
    inLanguage: ["en", "fa", "de"],
    variableMeasured: [
      { "@type": "PropertyValue", name: "Total Victims", value: victimCount },
      { "@type": "PropertyValue", name: "Total Sources", value: sourceCount },
    ],
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: victimToJsonLd(r),
      })),
    },
  };

  const dateStr = now.split("T")[0];

  return new NextResponse(JSON.stringify(dataset, null, 2), {
    headers: {
      "Content-Type": "application/ld+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="iran-memorial-archive-${dateStr}.jsonld"`,
      "Cache-Control": "no-store",
    },
  });
}
