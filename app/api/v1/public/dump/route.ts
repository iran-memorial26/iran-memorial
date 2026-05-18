import { NextRequest, NextResponse } from "next/server";
import { prismaReadOnly as prisma } from "@/lib/db-readonly";
import { rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/site-url";

// Force dynamic: Prisma can't connect at build time. Cloudflare's
// edge respects the Cache-Control header below, so repeat requests
// still hit the CDN cache, not our DB.
export const dynamic = "force-dynamic";

/**
 * Public bulk-export of the full victim dataset for academic / journalistic
 * use under CC BY-SA 4.0. ~30 MB JSON, ~38K records.
 *
 * No auth required. Output is sorted by date_of_death descending so
 * incremental fetchers can detect new entries by checking the first row.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const { success } = await rateLimit(ip, "public-dump", 3, 3600);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. The dataset is cached — try again in 1 hour." }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  const victims = await prisma.victim.findMany({
    select: {
      slug: true,
      nameLatin: true,
      nameFarsi: true,
      dateOfBirth: true,
      placeOfBirth: true,
      gender: true,
      ethnicity: true,
      religion: true,
      occupationEn: true,
      dateOfDeath: true,
      ageAtDeath: true,
      placeOfDeath: true,
      province: true,
      causeOfDeath: true,
      circumstancesEn: true,
      responsibleForces: true,
      legalProceedings: true,
      verificationStatus: true,
      photoUrl: true,
      updatedAt: true,
    },
    orderBy: [{ dateOfDeath: { sort: "desc", nulls: "last" } }, { slug: "asc" }],
  });

  return NextResponse.json(
    {
      meta: {
        site: SITE_URL,
        license: "CC BY-SA 4.0",
        attribution: `Iran Memorial Project — ${SITE_URL.replace(/^https?:\/\//, "")}`,
        generatedAt: new Date().toISOString(),
        totalVictims: victims.length,
        format: "Each entry has slug, names, dates, place, cause, circumstances. Photo and source URLs available via /api/mcp/victims/{slug}.",
        permittedUse: "Open data for journalism, research, advocacy. Attribution required. Re-publication of derived datasets must be CC BY-SA 4.0.",
      },
      victims: victims.map((v) => ({
        slug: v.slug,
        url: `${SITE_URL}/en/victims/${v.slug}`,
        nameLatin: v.nameLatin,
        nameFarsi: v.nameFarsi,
        dateOfBirth: v.dateOfBirth,
        placeOfBirth: v.placeOfBirth,
        gender: v.gender,
        ethnicity: v.ethnicity,
        religion: v.religion,
        occupation: v.occupationEn,
        dateOfDeath: v.dateOfDeath,
        ageAtDeath: v.ageAtDeath,
        placeOfDeath: v.placeOfDeath,
        province: v.province,
        causeOfDeath: v.causeOfDeath,
        circumstances: v.circumstancesEn,
        responsibleForces: v.responsibleForces,
        legalProceedings: v.legalProceedings,
        verificationStatus: v.verificationStatus,
        photoUrl: v.photoUrl,
        updatedAt: v.updatedAt,
      })),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Content-Disposition": 'inline; filename="iran-memorial-dump.json"',
      },
    },
  );
}
