/**
 * Blocks SSRF-prone webhook URLs.
 * Called at registration time (route.ts) AND at dispatch time (webhooks.ts)
 * to prevent DNS-rebinding attacks where a URL passes validation but later
 * resolves to an internal address.
 */
export function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return true;
    const host = parsed.hostname.toLowerCase();

    // Loopback / unspecified
    if (host === "localhost") return true;
    if (host === "127.0.0.1") return true;
    if (host === "::1") return true;
    if (host === "0.0.0.0") return true;   // unspecified IPv4
    if (host === "::") return true;         // unspecified IPv6

    // Octal / hex IPv4 encoding (e.g. 0177.0.0.1 = 127.0.0.1)
    if (/^0[0-9]/.test(host)) return true;
    if (/^0x[0-9a-f]/i.test(host)) return true;

    // RFC 1918 private ranges
    if (/^10\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;

    // Link-local (AWS metadata, Azure IMDS, GCP metadata)
    if (/^169\.254\./.test(host)) return true;
    if (/^fe80:/i.test(host)) return true;

    // IPv6 unique-local
    if (/^fc[0-9a-f]{2}:/i.test(host)) return true;
    if (/^fd[0-9a-f]{2}:/i.test(host)) return true;

    return false;
  } catch {
    return true; // Unparseable URL → block
  }
}
