# Iran Memorial — Edge & Abuse-Resistance Audit (2026-05-13)

**Scope:** Edge layer (Cloudflare → nginx → Next), HTTP hardening, image-optimizer, build hygiene, IP-handling. Complement to `SECURITY-AUDIT-2026-05-09.md` (which covered DB role + MCP read-only).

**Verdict:** Strong app-level hardening (CSP, HSTS, X-Frame DENY, rate-limit, Tor, read-only DB role done). Weak edge story: nginx-config drift, no Cloudflare-only ingress, image-optimizer SSRF surface, IP-spoofing via XFF first-hop. None are exploited today — all are pre-conditions for an exploitable day.

---

## What's already correct (verified 2026-05-13)

| Area | Finding |
|---|---|
| TLS + Cloudflare | `<DEPLOYMENT_DOMAIN>` resolves to Cloudflare anycast (`188.114.96/97`). `server: cloudflare` in response. |
| Security headers | HSTS (`max-age=31536000; includeSubDomains`), X-Frame DENY, X-Content-Type nosniff, Referrer-Policy strict-origin, Permissions-Policy locked, CSP set. All from `next.config.ts`. |
| CSP differentiation | App = strict; `/embed/*` = intentionally permissive (`frame-ancestors *`) for CC BY-SA embedders. Documented in code. |
| Tor onion | `onion-location:` header on every response. v3 onion (56-char). |
| DB + Meili exposure | `127.0.0.1:5434` and `127.0.0.1:7700` only. No public surface. |
| App exposure | `127.0.0.1:5555:3000` only — proxy is the single ingress point. |
| Rate limiting | `lib/rate-limit.ts` + `lib/mcp-rate-limit.ts` exist; submit/comments/MCP-search all wrapped. |
| Sentry source-maps | `deleteSourcemapsAfterUpload: true` — server stack frames not shipped. |
| ENV-var enforcement | `${POSTGRES_PASSWORD:?...}` + `${MEILI_MASTER_KEY:?...}` — no defaults possible. |
| Standalone Next output | Smaller surface, no dev toolchain in prod image. |

---

## Gaps, ordered by impact

### P0 — `nginx.conf` in repo is a stub (drift risk)

**Finding:** [`nginx.conf`](../nginx.conf) line 3: `server_name memorial.example.com`. No TLS block, no rate limit, no Cloudflare-IP allowlist, no security policy. The real prod config lives only on the server.

**Why it matters:** Same class of incident as the `nginx mgmt config divergence` event — when prod-only configs accumulate operator patches that aren't in git, every redeploy is Russian roulette. For a project with IRI threat model, the proxy is a control-plane and must be reproducible from source.

**Fix:**
1. SSH to `<ORIGIN_IP>`, `cat /etc/nginx/sites-enabled/<DEPLOYMENT_DOMAIN>.conf`
2. Redact secrets, commit to repo as `infra/nginx/<DEPLOYMENT_DOMAIN>.conf`
3. Document deploy as `rsync infra/nginx/ → server` step
4. Delete the stub at `nginx.conf` or replace with a README pointer

---

### P0 — No Cloudflare-only ingress at origin

**Finding:** Origin IPv6 `<ORIGIN_IPv6>` (and Hetzner v4 `<ORIGIN_IP>`) directly reachable on :443 if known.

**Why it matters:** Cloudflare's DDoS / WAF / rate-limit only fire if traffic actually goes through Cloudflare. If `<ORIGIN_IP>` ever appeared in DNS history (it has — pre-CF migration), an attacker resolves the origin and bypasses every CF protection. For IRI-state-aligned actors with botnet access, this turns a "we have Cloudflare" defense into theatre.

**Fix:** In nginx — `allow` only the published [Cloudflare IPv4](https://www.cloudflare.com/ips-v4) + [IPv6](https://www.cloudflare.com/ips-v6) ranges, `deny all`. Update via systemd-timer or cron from CF's published list.

---

### ✅ P1 — `images.remotePatterns` SSRF surface (FIXED 2026-05-13)

**Finding (was):** `next.config.ts` allowed `next/image` to optimize **any** HTTPS URL — classic Next.js SSRF (server-side fetch under attacker control).

**Investigation:** All `<Image>` components except one (`InteractiveTimeline.tsx`) already used `unoptimized={src.startsWith("https://")}`, so external photos already bypassed the optimizer. The wildcard was effectively dead code propping open the SSRF.

**Fix applied:**
1. `components/InteractiveTimeline.tsx` — added `unoptimized={eventPhoto.startsWith("https://")}` to match the project pattern.
2. `next.config.ts` — `remotePatterns: []` with a security comment forbidding restoration of the wildcard.

Any future `<Image>` that needs server-side optimization of an external URL must add an explicit `remotePatterns` entry; the audit pattern (`unoptimized` for externals) should remain the default.

---

### P1 — `x-forwarded-for` first-hop trust

**Finding:** [`lib/api-auth.ts:98`](../lib/api-auth.ts) and [`lib/mcp-rate-limit.ts:34`](../lib/mcp-rate-limit.ts) read `request.headers.get("x-forwarded-for")?.split(",")[0]`.

**Why it matters:** First-hop XFF is **client-controllable**. Anyone who reaches the origin direct (see P0 #2) can send `X-Forwarded-For: 1.1.1.1, 1.1.1.2, ...` and bypass per-IP rate limits — just rotate the spoofed prefix. Even through Cloudflare, attacker can prepend a value before CF's append.

**Fix:** Trust only `CF-Connecting-IP` (Cloudflare-validated). Fallback chain:
```ts
const ip =
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-real-ip") ??              // nginx-set, not client-set
  request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??  // last hop
  "unknown";
```
Combined with P0 #2 (CF-only ingress), this becomes solid.

---

### ⚪ P2 — Build artefacts (rescinded — `.next/` already gitignored)

**Original finding:** `.next/standalone/iran-memorial/*` looked tracked. **Verified 2026-05-13:** files exist on local disk but `.gitignore:15` (`/.next/`) excludes them; `git ls-files .next/` returns empty. False alarm.

---

### P2 — CSP `script-src 'unsafe-inline'`

**Finding:** [`next.config.ts:39`](../next.config.ts) — `'unsafe-inline'` for both script and style.

**Why it matters:** Defeats the main purpose of CSP for XSS. Next.js needs it for hydration script — but solvable with nonces (per-request `<meta>` or middleware-injected `nonce` attribute).

**Fix:** Migrate to nonce-based CSP. Tracked separately as it requires touching every inline-script call site. Acceptable to defer — but document the gap.

---

### ✅ P2 — CSP missing Sentry endpoint in `connect-src` (FIXED 2026-05-13)

**Fix applied:** Added `https://*.sentry.io` to `connect-src` in `next.config.ts`. Wildcard covers all regional ingest endpoints (`*.ingest.sentry.io`, `*.ingest.us.sentry.io`, `*.ingest.de.sentry.io`). Verify after next deploy: open DevTools console on a `/de/...` page, trigger an error, watch for absence of CSP violation report.

---

### P3 — HSTS without `preload`

**Finding:** `Strict-Transport-Security: max-age=31536000; includeSubDomains` — solid, but not in [HSTS Preload List](https://hstspreload.org/).

**Fix:** Append `; preload`, then submit the apex domain to hstspreload.org. Note: this affects ALL subdomains including `<MGMT_DOMAIN>`, `<DEPLOYMENT_DOMAIN>`, `<OTHER_APP>`. Coordinate before submission — preload is hard to undo.

---

### P3 — Missing Cross-Origin isolation headers

**Finding:** No `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Embedder-Policy`.

**Why it matters:** Spectre / side-channel mitigations. Low practical exploit risk for a read-mostly memorial, but free defense-in-depth.

**Fix:** Add to non-`/embed` routes:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin` (or `cross-origin` if photos hot-linked elsewhere)
- Skip COEP unless we want SharedArrayBuffer (we don't).

---

### P3 — Submitter / commenter IP retention policy unclear

**Finding:** `submissions` and `comments` tables exist; rate-limit reads IPs; nothing in repo documents whether IPs are stored, hashed, or dropped.

**Why it matters:** GDPR baseline + **OPSEC for an Iran-memorial**. A leaked DB containing visitor IPs of Iranian commenters = real-world danger. Not a theoretical compliance question.

**Fix:**
1. Audit DB schema: `\d submissions \d comments` — any `ip_address` / `submitter_ip` columns?
2. If yes: hash with daily-rotated salt OR drop after 7 days OR truncate to /24.
3. Document the choice in `docs/SECURITY-AUDIT-2026-05-13.md` + `SECURITY.md`.

---

### P3 — No Turnstile / CAPTCHA on submissions

**Finding:** Rate-limit exists but no proof-of-work / CAPTCHA on `/api/submit` or `/api/comments`.

**Why it matters:** Cloudflare Turnstile is free, invisible, and blocks IRI-aligned bot-spam attempting to drown the moderation queue with disinformation. With 37k+ verified victims, the attack surface for "submit fake counter-narratives" is real.

**Fix:** Cloudflare Turnstile widget on submit + comments forms, server-side verify in the route handler.

---

## Status (2026-05-13 evening)

**Done:**
- ✅ P1 — `remotePatterns: []` + `InteractiveTimeline` `unoptimized` prop
- ✅ P2 — Sentry endpoint added to CSP `connect-src`
- ⚪ P2 — Build-artefacts finding rescinded (already gitignored)

**Ready for server-side apply** (committed to repo, needs ops):
- 🟡 P0 #2 — `infra/nginx/cloudflare-only.conf` snippet + `scripts/refresh-cloudflare-ips.sh` written. The maintainer applies on `<ORIGIN_IP>`: include snippet in vhost, install + cron the script, `nginx -t && systemctl reload nginx`. **Verify with `curl -k https://<ORIGIN_IP>/` → expect 403** before considering done.

**Next sprint:**
- 🔴 P0 #1 — Pull live `/etc/nginx/sites-enabled/<DEPLOYMENT_DOMAIN>.conf` from server, redact, commit to `infra/nginx/` as the canonical config. Delete root `nginx.conf` stub.
- 🟠 P1 #2 — Update `lib/api-auth.ts:98` and `lib/mcp-rate-limit.ts:34` to prefer `cf-connecting-ip`. Only safe AFTER P0 #2 lands (otherwise origin-direct attacker can omit CF header → fallback to spoofable XFF).
- 🟡 P3 #4 — Submitter-IP retention audit (`\d submissions \d comments`). If raw IPs stored: hash with rotated salt OR drop after 7d OR /24-truncate.

**Backlog:**
- P2 — CSP nonce migration (Next.js scope, larger refactor)
- P3 — HSTS preload (apex `<APEX_DOMAIN>` — coordinate with sister-subdomains first)
- P3 — Cloudflare Turnstile on `/api/submit` + `/api/comments`
- P3 — COOP/CORP headers

---

**Audited by:** Claude Code session, 2026-05-13
**Next audit:** After fixes land, or in 2 quarters — whichever first
