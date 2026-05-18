import { NextResponse } from "next/server";
import { searchVictims } from "@/lib/queries";
import { prismaReadOnly } from "@/lib/db-readonly";
import { checkMcpRateLimit } from "@/lib/mcp-rate-limit";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Public read-only search for MCP/agent use. No Bearer token required.
 *  CORS-enabled; per-IP rate limit at the app layer (60/min) plus
 *  whatever Cloudflare adds upstream. */
export async function GET(req: Request) {
  const limited = await checkMcpRateLimit(req, "mcp_search");
  if (limited) return limited;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query parameter 'q' must be ≥ 2 characters" }, { status: 400 });
  }
  const results = await searchVictims(q, limit, prismaReadOnly);
  return NextResponse.json(
    {
      query: q,
      count: results.length,
      results: results.map((v) => ({
        slug: v.slug,
        nameLatin: v.nameLatin,
        nameFarsi: v.nameFarsi,
        dateOfDeath: v.dateOfDeath,
        placeOfDeath: v.placeOfDeath,
        causeOfDeath: v.causeOfDeath,
        url: `${SITE_URL}/en/victims/${v.slug}`,
      })),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
