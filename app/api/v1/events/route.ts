import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const endpoint = "/api/v1/events";

  const { context, error } = await verifyApiKey(request);
  if (error || !context) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, remaining, resetAt } = await checkApiKeyRateLimit(context.apiKeyId, endpoint, context.rateLimit);
  if (!success) {
    logApiUsage(context.apiKeyId, endpoint, "GET", 429, request);
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const events = await prisma.event.findMany({
      orderBy: { dateStart: "asc" },
      include: {
        _count: { select: { victims: true } },
        photos: { where: { isPrimary: true, isBroken: false }, take: 1 },
      },
    });

    logApiUsage(context.apiKeyId, endpoint, "GET", 200, request);
    return NextResponse.json({ data: events }, {
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
