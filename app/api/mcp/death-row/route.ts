import { NextResponse } from "next/server";
import { getDeathRowVictims } from "@/lib/queries";
import { prismaReadOnly } from "@/lib/db-readonly";
import { checkMcpRateLimit } from "@/lib/mcp-rate-limit";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Currently sentenced to death and awaiting execution.
 *  Drives the activism CTA — these are the people letters can still save.
 *  30/min/IP. */
export async function GET(req: Request) {
  const limited = await checkMcpRateLimit(req, "mcp_death_row");
  if (limited) return limited;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  const result = await getDeathRowVictims(page, limit, prismaReadOnly);
  return NextResponse.json(
    {
      page: result.page,
      pageSize: limit,
      totalPages: result.totalPages,
      totalMatching: result.total,
      results: result.victims.map((v) => ({
        slug: v.slug,
        nameLatin: v.nameLatin,
        nameFarsi: v.nameFarsi,
        placeOfDeath: v.placeOfDeath,
        causeOfDeath: v.causeOfDeath,
        verificationStatus: v.verificationStatus,
        url: `${SITE_URL}/en/victims/${v.slug}`,
      })),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
