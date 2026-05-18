import { NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";
import { prisma } from "./db";

// IP-keyed rate limit shared by every public /api/mcp/* route. Cloudflare
// already filters most abuse upstream, but a determined attacker who finds
// the origin IP can bypass the CDN entirely — without this app-level limit
// the only protection at the origin is the Postgres readonly grant. This
// closes the gap and gives us back-pressure even when CF is offline or
// proxied off.
//
// Limits are deliberately generous: legitimate LLM agents fan out to a few
// queries per user prompt; abuse looks like bursts of hundreds.

export type McpEndpointKey =
  | "mcp_search"
  | "mcp_victim"
  | "mcp_executions"
  | "mcp_death_row"
  | "mcp_statistics";

const LIMITS: Record<McpEndpointKey, { max: number; windowSec: number }> = {
  mcp_search: { max: 60, windowSec: 60 }, // 1/sec sustained, bursts allowed
  mcp_victim: { max: 120, windowSec: 60 }, // profile pages, cacheable
  mcp_executions: { max: 30, windowSec: 60 }, // paginated, heavier
  mcp_death_row: { max: 30, windowSec: 60 },
  mcp_statistics: { max: 30, windowSec: 60 }, // light to compute, but no need to spam
};

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Fire-and-forget access logging for public MCP routes. Writes one row per
 * request to api_usage with apiKeyId=NULL — same table the /api/v1/* paths
 * use, just keyed by IP+endpoint instead of API key. Lets us run the same
 * abuse-detection queries (rate of 4xx, top IPs, traffic by endpoint) over
 * the public surface.
 */
export function logMcpUsage(
  request: Request,
  endpoint: McpEndpointKey,
  statusCode: number,
) {
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  prisma.apiUsage
    .create({
      data: { apiKeyId: null, endpoint, method: "GET", statusCode, ip, userAgent },
    })
    .catch(() => {}); // never block the response on logging
}

/**
 * Check rate limit by client IP for a given MCP endpoint. Returns null if
 * allowed; returns a 429 NextResponse with rate-limit headers if blocked.
 * Also writes a 429 row to api_usage so abuse spikes show up in metrics.
 */
export async function checkMcpRateLimit(
  request: Request,
  endpoint: McpEndpointKey,
): Promise<NextResponse | undefined> {
  const ip = clientIp(request);
  const { max, windowSec } = LIMITS[endpoint];
  const result = await rateLimit(ip, endpoint, max, windowSec);

  if (result.success) return undefined;

  logMcpUsage(request, endpoint, 429);

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(max),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
