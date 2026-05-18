import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    // SECURITY: All <Image> components that receive external https URLs set
    // unoptimized={src.startsWith("https://")}, so the next/image optimizer
    // never fetches external URLs server-side. An empty remotePatterns
    // closes the SSRF surface that a wildcard ("**") would re-open — see
    // docs/SECURITY-AUDIT-2026-05-13.md (P1). Any future external optimizer
    // pass MUST add explicit entries; do NOT restore the wildcard.
    remotePatterns: [],
  },
  headers: async () => [
    {
      // Strict headers for everything *except* /embed routes, which must be
      // iframable from any origin so activist sites can embed the live counter.
      // Negative-lookahead in the regex source.
      source: "/:path((?!embed).*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "geolocation=(), microphone=(), camera=(), payment=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        // Content-Security-Policy is set dynamically per-request in
        // middleware.ts with a per-request nonce. Do not add it here.
      ],
    },
    {
      // /embed/* — iframe-friendly. CC BY-SA 4.0 means anyone may embed.
      // CSP (frame-ancestors *) is injected by middleware.ts.
      source: "/embed/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ],
    },
    {
      // Bare /embed (no trailing path) — same permissive set.
      // CSP (frame-ancestors *) is injected by middleware.ts.
      source: "/embed",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ],
    },
  ],
};

// Sentry wraps last so source maps see the final compiled output.
// Skipped entirely when SENTRY_DSN is unset (e.g. local dev).
const withIntl = withNextIntl(nextConfig);

export default process.env.SENTRY_DSN
  ? withSentryConfig(withIntl, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      disableLogger: true,
      widenClientFileUpload: true,
      sourcemaps: {
        // Don't ship source maps to the client — Memorial is sensitive,
        // we don't want server-side stack frames exposed.
        deleteSourcemapsAfterUpload: true,
      },
    })
  : withIntl;
