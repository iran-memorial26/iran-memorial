import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [total, fieldStats, verificationBreakdown, byDataSource] = await Promise.all([
    prisma.victim.count(),

    prisma.$queryRaw<{ field: string; missing: number; total: number; pct: number }[]>`
      SELECT
        field,
        SUM(CASE WHEN missing THEN 1 ELSE 0 END)::int AS missing,
        COUNT(*)::int AS total,
        ROUND(100.0 * SUM(CASE WHEN missing THEN 1 ELSE 0 END) / COUNT(*), 1)::float AS pct
      FROM (
        SELECT 'photo_url'::text AS field, (photo_url IS NULL OR photo_url = '') AS missing FROM victims
        UNION ALL SELECT 'date_of_death', date_of_death IS NULL FROM victims
        UNION ALL SELECT 'date_of_birth', date_of_birth IS NULL FROM victims
        UNION ALL SELECT 'cause_of_death', (cause_of_death IS NULL OR cause_of_death = '') FROM victims
        UNION ALL SELECT 'place_of_death', (place_of_death IS NULL OR place_of_death = '') FROM victims
        UNION ALL SELECT 'age_at_death', age_at_death IS NULL FROM victims
        UNION ALL SELECT 'circumstances_en', (circumstances_en IS NULL OR circumstances_en = '') FROM victims
        UNION ALL SELECT 'name_farsi', (name_farsi IS NULL OR name_farsi = '') FROM victims
        UNION ALL SELECT 'occupation_en', (occupation_en IS NULL OR occupation_en = '') FROM victims
      ) t
      GROUP BY field
      ORDER BY pct DESC
    `,

    prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT verification_status AS status, COUNT(*)::int AS count
      FROM victims GROUP BY verification_status ORDER BY count DESC
    `,

    prisma.$queryRaw<{ source: string; count: number; verified: number }[]>`
      SELECT
        data_source AS source,
        COUNT(*)::int AS count,
        SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END)::int AS verified
      FROM victims
      GROUP BY data_source
      ORDER BY count DESC
      LIMIT 15
    `,
  ]);

  return NextResponse.json({ total, fieldStats, verificationBreakdown, byDataSource });
}
