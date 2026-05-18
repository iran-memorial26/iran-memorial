import { NextResponse } from "next/server";
import { getVictimBySlug } from "@/lib/queries";
import { prismaReadOnly } from "@/lib/db-readonly";
import { checkMcpRateLimit } from "@/lib/mcp-rate-limit";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Full victim profile by slug. Public, no auth. 120/min/IP. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = await checkMcpRateLimit(req, "mcp_victim");
  if (limited) return limited;
  const { slug } = await params;
  const v = await getVictimBySlug(slug, prismaReadOnly);
  if (!v) {
    return NextResponse.json({ error: "Victim not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      slug: v.slug,
      nameLatin: v.nameLatin,
      nameFarsi: v.nameFarsi,
      aliases: v.aliases,
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
      url: `${SITE_URL}/en/victims/${v.slug}`,
      sources: (v.sources || []).map((s) => ({ name: s.name, url: s.url })),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
