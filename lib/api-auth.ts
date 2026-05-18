import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "./db";
import { rateLimit } from "./rate-limit";

export type ApiKeyContext = {
  apiKeyId: string;
  name: string;
  rateLimit: number;
};

/**
 * Verify API key from Authorization header: "Bearer iran_mem_..."
 * Returns null if invalid/missing, ApiKeyContext if valid
 */
export async function verifyApiKey(
  request: NextRequest
): Promise<{ context: ApiKeyContext | null; error?: NextResponse }> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      context: null,
      error: NextResponse.json(
        { error: "Missing or invalid Authorization header. Use: Bearer iran_mem_..." },
        { status: 401 }
      ),
    };
  }

  const key = authHeader.slice(7); // Remove "Bearer "

  if (!key.startsWith("iran_mem_")) {
    return {
      context: null,
      error: NextResponse.json({ error: "Invalid API key format" }, { status: 401 }),
    };
  }

  const keyHash = createHash("sha256").update(key).digest("hex");

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        OR: [
          { keyHash },                   // Hash-Lookup (new keys after migration)
          { keyHash: null, key },        // Fallback for not-yet-migrated keys
        ],
      },
      select: { id: true, name: true, isActive: true, rateLimit: true, expiresAt: true },
    });

    if (!apiKey || !apiKey.isActive) {
      return {
        context: null,
        error: NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 }),
      };
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return {
        context: null,
        error: NextResponse.json({ error: "API key expired" }, { status: 401 }),
      };
    }

    // Update last used timestamp (fire and forget)
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    return {
      context: {
        apiKeyId: apiKey.id,
        name: apiKey.name,
        rateLimit: apiKey.rateLimit,
      },
    };
  } catch (err) {
    return {
      context: null,
      error: NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    };
  }
}

/**
 * Check rate limit for authenticated API key
 */
export async function checkApiKeyRateLimit(
  apiKeyId: string,
  endpoint: string,
  limit: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  return rateLimit(`api_key:${apiKeyId}`, endpoint, limit, 3600);
}

/**
 * Log API usage (fire and forget)
 */
export function logApiUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  request: NextRequest
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent")?.slice(0, 500);

  prisma.apiUsage
    .create({
      data: { apiKeyId, endpoint, method, statusCode, ip, userAgent },
    })
    .catch(() => {}); // Silent fail, usage logging is non-critical
}
