import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const endpoint = "/api/v1/victims/[slug]";
  const { slug } = await params;

  const { context, error } = await verifyApiKey(request);
  if (error || !context) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, remaining, resetAt } = await checkApiKeyRateLimit(context.apiKeyId, endpoint, context.rateLimit);
  if (!success) {
    logApiUsage(context.apiKeyId, endpoint, "GET", 429, request);
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const victim = await prisma.victim.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        aliases: true,
        dateOfBirth: true,
        placeOfBirth: true,
        gender: true,
        photoUrl: true,
        occupationEn: true,
        occupationFa: true,
        dateOfDeath: true,
        ageAtDeath: true,
        placeOfDeath: true,
        province: true,
        causeOfDeath: true,
        circumstancesEn: true,
        circumstancesFa: true,
        verificationStatus: true,
        event: { select: { slug: true, titleEn: true, titleFa: true, titleDe: true } },
        city: { include: { province: true } },
        sources: { select: { url: true, name: true, sourceType: true, dataSource: { select: { name: true, credibility: true } } } },
        photos: { where: { isBroken: false }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { url: true, captionEn: true, captionFa: true, isPrimary: true } },
        // Intentionally excluded: notes (internal), dataSource (pipeline tracking), createdAt/updatedAt
      },
    });

    if (!victim) {
      logApiUsage(context.apiKeyId, endpoint, "GET", 404, request);
      return NextResponse.json({ error: "Victim not found" }, { status: 404 });
    }

    logApiUsage(context.apiKeyId, endpoint, "GET", 200, request);
    return NextResponse.json(victim, {
      headers: {
        "X-RateLimit-Limit": String(context.rateLimit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
      },
    });
  } catch (err) {
    logApiUsage(context.apiKeyId, endpoint, "GET", 500, request);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
