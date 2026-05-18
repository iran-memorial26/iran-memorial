/**
 * Single source of truth for the public site URL.
 *
 * Set NEXT_PUBLIC_SITE_URL in production; falls back to the current
 * deployment domain for local dev so nothing breaks when the env var
 * isn't exported.
 *
 * NEXT_PUBLIC_ prefix is required: this constant is referenced from
 * both server and client components, and Next.js only inlines the
 * latter when the var carries that prefix.
 *
 * Note: a few touchpoints still need a manual edit on domain change
 * because they aren't TypeScript runtime code:
 *   - public/openapi.yaml (servers.url)
 *   - messages/*.json (localized prose mentioning the URL)
 *   - tools/mcp/README.md, tools/mcp/package.json (docs)
 *   - tools/mcp/index.ts already uses its own IRAN_MEMORIAL_BASE_URL env var.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
