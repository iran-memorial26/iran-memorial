import { NextResponse } from "next/server";
import { getStats } from "@/lib/queries";
import { prismaReadOnly } from "@/lib/db-readonly";
import { checkMcpRateLimit } from "@/lib/mcp-rate-limit";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = await checkMcpRateLimit(req, "mcp_statistics");
  if (limited) return limited;
  const stats = await getStats(prismaReadOnly);
  return NextResponse.json(
    {
      victimsDocumented: stats.victimCount,
      eventsDocumented: stats.eventCount,
      sourcesDocumented: stats.sourceCount,
      yearsOfRepression: stats.yearsOfRepression,
      protestExecutionsSince2026March: stats.recentProtestExecutions,
      deathRowCount: stats.deathRowCount,
      site: SITE_URL,
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
