import { NextResponse } from "next/server";
import { getExecutedVictims, type ExecutionMethod } from "@/lib/queries";
import { prismaReadOnly } from "@/lib/db-readonly";
import { checkMcpRateLimit } from "@/lib/mcp-rate-limit";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const METHODS: ExecutionMethod[] = ["hanging", "shooting", "stoning", "custody", "other"];

export async function GET(req: Request) {
  const limited = await checkMcpRateLimit(req, "mcp_executions");
  if (limited) return limited;
  const url = new URL(req.url);
  const methodRaw = url.searchParams.get("method") || "";
  const yearRaw = url.searchParams.get("year") || "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));

  const method = METHODS.includes(methodRaw as ExecutionMethod)
    ? (methodRaw as ExecutionMethod)
    : undefined;
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;

  const result = await getExecutedVictims(page, limit, { method, year }, prismaReadOnly);

  return NextResponse.json(
    {
      filters: { method, year },
      page: result.page,
      pageSize: limit,
      totalPages: result.totalPages,
      totalMatching: result.total,
      results: result.victims.map((v) => ({
        slug: v.slug,
        nameLatin: v.nameLatin,
        nameFarsi: v.nameFarsi,
        dateOfDeath: v.dateOfDeath,
        placeOfDeath: v.placeOfDeath,
        causeOfDeath: v.causeOfDeath,
        verificationStatus: v.verificationStatus,
        url: `${SITE_URL}/en/victims/${v.slug}`,
      })),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
