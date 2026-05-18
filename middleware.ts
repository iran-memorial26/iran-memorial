import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function buildCsp(nonce: string, isEmbed: boolean): string {
  if (isEmbed) {
    return [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "frame-ancestors *",
    ].join("; ");
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // Memorial photos come from a wide and growing set of news outlets,
    // human-rights orgs and CDNs. Allow all HTTPS image sources; images
    // cannot execute script so the XSS surface is minimal.
    "img-src 'self' https: data: blob:",
    // *.sentry.io covers all regional ingest endpoints
    // (*.ingest.sentry.io, *.ingest.us.sentry.io, *.ingest.de.sentry.io).
    "connect-src 'self' https://*.basemaps.cartocdn.com https://*.sentry.io",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isEmbed = request.nextUrl.pathname.startsWith("/embed");

  // Forward nonce to the app so layouts can read it via next/headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Run next-intl locale routing on a cloned request with the extra header.
  const intlRequest = new NextRequest(request.url, {
    method: request.method,
    headers: requestHeaders,
    body: request.body,
  });

  const response = intlMiddleware(intlRequest);

  // Attach the nonce-based CSP to every response (overrides any static header).
  const csp = buildCsp(nonce, isEmbed);
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: ["/", "/(fa|en|de|ar)/:path*"],
};
