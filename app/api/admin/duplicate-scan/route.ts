import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

// GET — list cached candidates (fast, from table)
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await prisma.duplicateCandidate.findMany({
    where: { status: { not: "dismissed" } },
    orderBy: { similarity: "desc" },
  });

  const lastScanned =
    candidates.length > 0
      ? candidates.reduce((max, c) => (c.scannedAt > max ? c.scannedAt : max), candidates[0].scannedAt)
      : null;

  return NextResponse.json({ candidates, lastScanned, total: candidates.length });
}

// POST — run the similarity scan and repopulate the table
// Runs as a 60s background query — uses pg statement_timeout as safety net
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    // Run scan with 55s timeout — preserve 'confirmed' / 'dismissed' statuses
    const found = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '55000'`;

        const results = await tx.$queryRaw<
          { slug1: string; name1: string; slug2: string; name2: string; similarity: number }[]
        >`
          SELECT
            a.slug AS slug1, a.name_latin AS name1,
            b.slug AS slug2, b.name_latin AS name2,
            ROUND(similarity(a.name_latin, b.name_latin)::numeric, 3)::float AS similarity
          FROM victims a
          JOIN victims b ON a.id < b.id
          WHERE
            a.name_latin IS NOT NULL AND b.name_latin IS NOT NULL
            AND a.name_latin NOT ILIKE 'unknown%'
            AND b.name_latin NOT ILIKE 'unknown%'
            AND length(a.name_latin) > 5
            AND length(b.name_latin) > 5
            AND similarity(a.name_latin, b.name_latin) > 0.85
          ORDER BY similarity DESC
          LIMIT 200
        `;

        // Fetch existing statuses so we can preserve confirmed/dismissed pairs
        const existingStatuses = await tx.duplicateCandidate.findMany({
          select: { slug1: true, slug2: true, status: true },
          where: { status: { in: ["confirmed", "dismissed"] } },
        });
        const statusMap = new Map(
          existingStatuses.map((e) => [`${e.slug1}|${e.slug2}`, e.status])
        );

        // Delete all existing candidates and re-insert
        await tx.duplicateCandidate.deleteMany({});

        if (results.length > 0) {
          await tx.duplicateCandidate.createMany({
            data: results.map((r) => ({
              slug1: r.slug1,
              name1: r.name1,
              slug2: r.slug2,
              name2: r.name2,
              similarity: r.similarity,
              status: statusMap.get(`${r.slug1}|${r.slug2}`) ?? "pending",
              scannedAt: now,
            })),
          });
        }

        return results.length;
      },
      { timeout: 60000 }
    );

    return NextResponse.json({ found, scannedAt: now });
  } catch (err: any) {
    const isTimeout =
      err?.message?.includes("statement timeout") ||
      err?.message?.includes("canceling statement");
    return NextResponse.json(
      {
        error: isTimeout
          ? "Scan timed out. Consider running during off-peak hours."
          : "Scan failed",
        details: err?.message,
      },
      { status: isTimeout ? 408 : 500 }
    );
  }
}

// PATCH — update status of a candidate pair (confirm or dismiss)
export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !["confirmed", "dismissed", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.duplicateCandidate.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ candidate: updated });
}
