import Redis from "ioredis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory fallback store
const memStore = new Map<string, RateLimitEntry>();
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of memStore) if (now > e.resetAt) memStore.delete(k);
}, 5 * 60 * 1000).unref();

// Redis client (lazy init, only if REDIS_URL is set)
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redis.on("error", (e) => console.error("[RateLimit] Redis error:", e.message));
  }
  return redis;
}

async function rateLimitRedis(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ count: number; resetAt: number }> {
  const r = getRedis()!;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const resetAt = now + windowMs;

  // Atomic increment + expiry using pipeline
  const pipeline = r.pipeline();
  pipeline.incr(key);
  pipeline.pttl(key);
  const [[, count], [, pttl]] = (await pipeline.exec()) as [[null, number], [null, number]];

  if (pttl < 0) {
    // New key — set expiry
    await r.pexpire(key, windowMs);
    return { count, resetAt };
  }
  return { count, resetAt: now + pttl };
}

export async function rateLimit(
  ip: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const key = `rl:${endpoint}:${ip}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const r = getRedis();
  if (r) {
    try {
      const { count, resetAt } = await rateLimitRedis(key, maxRequests, windowSeconds);
      const remaining = Math.max(0, maxRequests - count);
      return { success: count <= maxRequests, remaining, resetAt };
    } catch (e) {
      console.error("[RateLimit] Redis failed, falling back to memory:", e);
    }
  }

  // In-memory fallback
  const entry = memStore.get(key);
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
