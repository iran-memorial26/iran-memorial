# Iran Memorial — Security Audit (2026-05-09)

**Scope:** Read-only / MCP exposure review. Goal = confirm public MCP surface cannot write to the database under any code path, deliberate or accidental.

**Verdict:** Application-level read-only is sound. **One critical gap at the DB layer**: every public route still uses a Prisma client connected as `memorial`, a role with full DML on all 14 tables. A single buggy commit could turn a public GET into a write — only application code stops it today.

---

## What's already correct

| Area | Finding |
|---|---|
| Route segregation | `/api/mcp/*` = public, GET-only, no auth. `/api/v1/*` = Bearer (`iran_mem_…`) + per-key rate limit + audit log (`api_usage`). |
| MCP handlers | All five (`search`, `victims/[slug]`, `executions`, `death-row`, `statistics`) export only `GET`. Each calls a typed `lib/queries.ts` function — no raw SQL, no parameter passthrough. |
| MCP stdio server (`tools/mcp/index.ts`) | Only does `fetch()` against the public HTTP endpoints. No DB driver, no env credentials. Sandboxed by design. |
| Admin endpoints | All gated by `x-forwarded-user` from nginx auth. `ADMIN_USERS` allowlist. |
| Write routes (`/api/submit`, `/api/comments`, `/api/upload`) | All have per-IP rate limits via `lib/rate-limit.ts`. Submissions go to `submissions` (pending moderation), not directly to `victims`. |
| Public bulk dump (`/api/v1/public/dump`) | `Cache-Control: public, max-age=3600, s-maxage=3600` — Cloudflare absorbs traffic, DB hit hourly max. |
| HTTP hardening | CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Permissions-Policy all set in `next.config.ts`. `/embed/*` carved out for activist iframe embedding (intentional). |
| Curl smoke tests | `/api/mcp/search?q=test` → 200. `/api/v1/victims` → 401 without Bearer. Confirms split. |

---

## Gaps, ordered by impact

### P0 — DB role still has full DML on every public-facing query path

**Finding:** `lib/db.ts` exports a single `prisma` client. Both write routes (admin, submit, enricher) and read-only routes (MCP, public dump) import the same instance. The connection authenticates as `memorial`, which owns all 14 tables in `iran_memorial`.

```sql
-- Current state on prod:
SELECT rolname FROM pg_roles WHERE rolcanlogin;
-- accountability, experts, memorial, postgres
-- memorial = full DML on victims, sources, photos, comments, submissions, …
```

**Why it matters:** The user's stated goal — *"man soll aus sicherheitsgründen für die datenbank keine schreibrechte haben"* — is achieved at the application layer only. A future commit could:
- Accidentally introduce `prisma.victim.update()` inside an MCP handler.
- Pass an unsanitised string to `$executeRaw` somewhere.
- Misuse `prisma.$transaction` with a write inside a read path.

None of those would be blocked by Postgres today.

**Fix (recommended, P0):**

1. Add a `memorial_readonly` Postgres role:
   ```sql
   CREATE ROLE memorial_readonly LOGIN PASSWORD '<random 32 bytes>';
   GRANT CONNECT ON DATABASE iran_memorial TO memorial_readonly;
   GRANT USAGE ON SCHEMA public TO memorial_readonly;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO memorial_readonly;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO memorial_readonly;
   ```
2. Add `DATABASE_URL_READONLY` to prod `.env`.
3. New `lib/db-readonly.ts`:
   ```ts
   export const prismaReadOnly = new PrismaClient({
     datasources: { db: { url: process.env.DATABASE_URL_READONLY! } },
   });
   ```
4. Update the **6 read-only public routes** to import `prismaReadOnly`:
   - `app/api/mcp/search/route.ts`
   - `app/api/mcp/victims/[slug]/route.ts`
   - `app/api/mcp/executions/route.ts`
   - `app/api/mcp/death-row/route.ts`
   - `app/api/mcp/statistics/route.ts`
   - `app/api/v1/public/dump/route.ts`
5. (Bonus) Reroute the bulk of `lib/queries.ts` read functions through `prismaReadOnly` too — write functions stay on `prisma`.

After this, even if a future bug ships a write call inside an MCP handler, Postgres returns `ERROR: permission denied for table victims` and the attempt is logged.

### P1 — No app-level rate limit on `/api/mcp/*`

**Finding:** `app/api/mcp/search/route.ts` comment: *"CORS-enabled; rate-limit by IP via Cloudflare (no app-level limit)."*

If Cloudflare is bypassed (origin IP exposed → direct hit on nginx :443), there is no second-line defence. `lib/rate-limit.ts` is in-memory and already used on `/api/submit` (5/h) and `/api/comments` (10/h).

**Fix:** ~10 lines per route — add `rateLimit(ip, "mcp_search", 60, 60)` style call. Tunable.

### P2 — Origin firewall inactive

```
$ ufw status
Status: inactive
```

Hetzner box at `<HETZNER_IP>` accepts traffic on :443 from anywhere; Cloudflare's protection is opt-in, not enforced. Three Docker apps bind to `127.0.0.1:5555/5556/5557` (good, not externally reachable), but nginx :443 is open to the world.

**Fix options:**
- (lighter) Restrict nginx :443 to Cloudflare IP ranges via nginx `allow`/`deny`. Reduces DDoS and CF-bypass attacks.
- (heavier) `ufw enable` + allow 22 (SSH), 443 from CF only. Closes everything else.

### P3 — `api_usage` not populated for `/api/mcp/*`

`/api/v1/*` writes per-request rows to `api_usage` (key, endpoint, status, IP). MCP routes don't, so abuse detection is harder. Worth extending the same logger to MCP — IP keyed instead of api-key keyed.

### P4 — Production log noise

`docker compose logs memorial-app` is full of `MISSING_MESSAGE: loading (en)` from `next-intl`. Not a security issue, but it drowns useful signals if you grep for errors. One missing translation key.

---

## Status — 2026-05-09 follow-up

| Priority | Status | Commit / artefact |
|---|---|---|
| **P0** DB-level read-only role | **Shipped + verified** | `42bd38b80`, `b24cbfd00`. INSERT as `memorial_readonly` → `permission denied for table victims` ✓ |
| **P1** App rate-limit on `/api/mcp/*` | **Shipped + verified** | `9c1a04a4f` (+ `lib/mcp-rate-limit.ts`). Burst 65×/min on statistics → 30× 200 then 35× 429 ✓ |
| **P2** Origin CF-IP allowlist | **Shipped + verified** | `/etc/nginx/cloudflare-ips.conf` + weekly cron `refresh-cloudflare-ips.sh`. Direct localhost hit → HTTP 403 ✓ |
| **P3** `api_usage` for MCP | **Shipped + verified** | `723328874`. Migration `20260509020000_api_usage_nullable_key` applied. 429 burst → 5 rows in api_usage with apiKeyId NULL ✓ |
| **P4** `next-intl` MISSING_MESSAGE noise | **Shipped + verified** | `723328874`. CommentSection redirected to `common.loading` / `common.submit`. Log scan: 0 MISSING_MESSAGE entries in last 50 lines ✓ |

---

## Recommendation

Ship P0 in one PR (DB role + readonly Prisma client + 6 route imports + migration step on prod). Touches:

- `prisma/migrations/<timestamp>_add_readonly_role/migration.sql` (raw SQL, since Prisma manages schema not roles)
- `lib/db-readonly.ts` (new)
- `lib/db.ts` (unchanged)
- 6 route files (1-line import swap each)
- `.env.example` (document new var)
- Server-side: add `DATABASE_URL_READONLY` to `/opt/iran-stack/iran-memorial/.env`, restart `memorial-app` container.

P1+P3 are an easy follow-up. P2 is an ops-only change. P4 is a translation file fix.

The P0 change is reversible: drop the role, remove the env var, swap imports back. No data risk.
