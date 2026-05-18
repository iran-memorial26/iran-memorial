# Security Policy

## Reporting a vulnerability

**Please don't open public GitHub issues for security bugs.**

Email `<CONTACT_EMAIL>` with:

1. A description of the issue
2. Steps to reproduce
3. Affected version / commit hash
4. Any proof-of-concept (a `curl` command or short script is ideal)

We aim to acknowledge within 48 hours and ship a fix within 7 days for
critical issues. Coordinated disclosure is welcome — name us in your write-up
once the fix is live.

## Scope

In scope:
- The Next.js application, all `/api/*` routes, the public website, the
  embed widget, the MCP server (`tools/mcp/`).
- The Python enricher pipeline (`tools/enricher/`) and its plugins.
- The Postgres database design (privilege escalation paths, injection).

Out of scope:
- Issues in upstream dependencies (file with the upstream project, not us,
  unless we have failed to update for >30 days after a public CVE).
- Cosmetic / UX issues.
- "Found your domain in a leaked database from 2019" style notifications.

## Posture summary

The platform follows a **defense-in-depth read-only model** for everything
public:

| Layer | Control |
|---|---|
| Edge | Cloudflare proxy + nginx allowlist of CF IP ranges (origin returns 403 to direct hits). |
| App (write paths) | All write/admin routes gated by nginx basic auth + `x-forwarded-user` allowlist. Submit/comment/upload have per-IP rate limits. |
| App (public read paths) | `/api/mcp/*` and `/api/v1/public/dump` are unauthenticated but app-rate-limited (30–120 req/min/IP). 429s and successful requests are logged to `api_usage`. |
| App (REST API) | `/api/v1/*` requires `Authorization: Bearer iran_mem_…`. Rate limit 1000/h per key. |
| Data | Public read paths use a **separate Postgres role (`memorial_readonly`)** with `GRANT SELECT` only. A buggy commit that calls `prisma.X.update()` from a public route is rejected with `permission denied for table …`. |
| Transport | HSTS, CSP, X-Frame-Options DENY (except `/embed/*`), Referrer-Policy strict, Permissions-Policy. |
| Logs | `next-intl` translation misses are surfaced in container logs. No secrets in git history. `.env.example` carries only placeholders. |

Full audit: [`docs/SECURITY-AUDIT-2026-05-09.md`](docs/SECURITY-AUDIT-2026-05-09.md).

## What's not bulletproof

- **In-memory rate limiter.** Restarting the container resets counters. Fine
  for the current scale; would need Redis or similar at >100 req/sec sustained.
- **Cloudflare allowlist refresh.** Updated weekly via cron. If Cloudflare
  adds a new edge range mid-week, requests from those IPs would 403 for up
  to 7 days. The script is idempotent and can be triggered manually.
- **No formal pentest.** The audit was internal. Independent review welcome.

## What we will and won't pay for

This is a non-commercial, donor-funded memorial project. We can't offer cash
bounties. We can offer:

- Public credit in the security audit document.
- A line-item in the project's CHANGELOG.
- A standing invitation to the contributor list.

For meaningful disclosures we'll send a hand-written thank-you and (where
appropriate) coordinate with the press.
