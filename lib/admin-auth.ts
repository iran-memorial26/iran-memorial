import { NextRequest } from "next/server";

const ADMIN_USERS = (process.env.ADMIN_USERS || "admin").split(",").map((u) => u.trim());
const INTERNAL_AUTH_TOKEN = process.env.INTERNAL_AUTH_TOKEN;

/**
 * Returns true if the request comes from a trusted admin.
 *
 * Two-layer check:
 * 1. If INTERNAL_AUTH_TOKEN is configured: verify X-Internal-Token header matches.
 *    This header is injected by nginx — a direct hit to port 3000 won't have it.
 * 2. x-forwarded-user must be in ADMIN_USERS allowlist (set by nginx auth_basic).
 *
 * When INTERNAL_AUTH_TOKEN is not set (local dev), only layer 2 applies.
 */
export function isAdmin(request: NextRequest): boolean {
  if (INTERNAL_AUTH_TOKEN) {
    const token = request.headers.get("x-internal-token");
    if (token !== INTERNAL_AUTH_TOKEN) return false;
  }
  const user = request.headers.get("x-forwarded-user");
  return !!user && ADMIN_USERS.includes(user);
}
