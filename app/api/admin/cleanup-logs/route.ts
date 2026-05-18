import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let olderThanDays = 90;

  try {
    const body = await request.json();
    if (body?.olderThanDays !== undefined) {
      const parsed = Number(body.olderThanDays);
      if (!Number.isInteger(parsed) || parsed < 7 || parsed > 365) {
        return NextResponse.json(
          { error: "olderThanDays must be an integer between 7 and 365" },
          { status: 400 }
        );
      }
      olderThanDays = parsed;
    }
  } catch {
    // empty body is fine — use default
  }

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const { count: deleted } = await prisma.apiUsage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted, olderThanDays });
}
