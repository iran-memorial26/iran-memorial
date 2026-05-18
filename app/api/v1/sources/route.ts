import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const endpoint = "/api/v1/sources";

  const { context, error } = await verifyApiKey(request);
  if (error || !context) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, remaining, resetAt } = await checkApiKeyRateLimit(context.apiKeyId, endpoint, context.rateLimit);
  if (!success) {
    logApiUsage(context.apiKeyId, endpoint, "GET", 429, request);
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const sources = await prisma.dataSource.findMany({
      orderBy: { name: "asc" },
      select: {
        slug: true,
        name: true,
        nameEn: true,
        nameFa: true,
        nameDe: true,
        url: true,
        descriptionEn: true,
        descriptionFa: true,
        descriptionDe: true,
        credibility: true,
        sourceType: true,
        isActive: true,
        _count: { select: { sources: true } },
      },
    });

    logApiUsage(context.apiKeyId, endpoint, "GET", 200, request);
    return NextResponse.json({ data: sources }, {
      headers: {
        "X-RateLimit-Limit": String(context.rateLimit),
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  } catch (err) {
    logApiUsage(context.apiKeyId, endpoint, "GET", 500, request);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
