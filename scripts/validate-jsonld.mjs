#!/usr/bin/env node
/**
 * validate-jsonld.mjs — Fetches the live iran-memorial pages, extracts every
 * <script type="application/ld+json"> block, and validates each block against
 * Google's Schema.org Validator API.
 *
 * Pages checked:
 *   - $NEXT_PUBLIC_SITE_URL/             (WebSite + SearchAction + Organization)
 *   - $NEXT_PUBLIC_SITE_URL/en/developers (Dataset)
 *
 * Output: PASS / FAIL per block, keyed by @type. Exits non-zero if any block fails.
 *
 * No npm dependencies — Node 20+ built-in fetch only.
 *
 * Usage:
 *   node scripts/validate-jsonld.mjs
 *   node scripts/validate-jsonld.mjs --help
 *   node scripts/validate-jsonld.mjs --url https://localhost:3000/
 */

const HELP = `validate-jsonld.mjs — Validate JSON-LD blocks on iran-memorial pages

Usage:
  node scripts/validate-jsonld.mjs [options]

Options:
  --help            Show this help and exit
  --url <url>      Override a single page URL (repeatable)
  --no-network    Skip network calls (parse only, no validator API)

Default pages:
  $NEXT_PUBLIC_SITE_URL/
  $NEXT_PUBLIC_SITE_URL/en/developers

Validator endpoint:
  https://validator.schema.org/validate (Google's Schema Markup Validator API)

Exit codes:
  0  all blocks PASS
  1  one or more blocks FAIL
  2  fatal error (validator unreachable -> manual-check URLs printed)
`;

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const DEFAULT_PAGES = [
  `${BASE}/`,
  `${BASE}/en/developers`,
];

const VALIDATOR_ENDPOINT = "https://validator.schema.org/validate";
const VALIDATOR_UI = "https://validator.schema.org/#url=";

function parseArgs(argv) {
  const out = { pages: [], help: false, network: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--no-network") out.network = false;
    else if (a === "--url") out.pages.push(argv[++i]);
  }
  if (out.pages.length === 0) out.pages = DEFAULT_PAGES;
  return out;
}

/** Extract every <script type="application/ld+json"> ... </script> block from HTML. */
function extractJsonLdBlocks(html) {
  const blocks = [];
  const re =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push({ raw, json: JSON.parse(raw) });
    } catch (err) {
      blocks.push({ raw, json: null, parseError: err.message });
    }
  }
  return blocks;
}

/** Pull a stable label out of a JSON-LD block (handles @graph + arrays). */
function labelOf(json) {
  if (!json) return "<unparseable>";
  if (Array.isArray(json)) return json.map(labelOf).join("+");
  if (json["@graph"] && Array.isArray(json["@graph"])) {
    return json["@graph"].map((n) => n["@type"] || "?").join("+");
  }
  return json["@type"] || json.name || "<no-@type>";
}

/** Validate one block against the Schema.org Validator. */
async function validateBlock(block, pageUrl) {
  if (!block.json) {
    return { ok: false, label: "<unparseable>", reason: block.parseError };
  }
  const label = labelOf(block.json);
  try {
    const res = await fetch(VALIDATOR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "iran-memorial-validator/1.0",
      },
      body: new URLSearchParams({ code: block.raw }),
    });
    if (!res.ok) {
      return {
        ok: false,
        label,
        reason: `validator HTTP ${res.status}`,
        manual: VALIDATOR_UI + encodeURIComponent(pageUrl),
      };
    }
    const text = await res.text();
    // The endpoint prefixes its JSON with `)]}'` for XSSI protection — strip it.
    const cleaned = text.replace(/^\)\]\}'?\s*/, "");
    let payload;
    try {
      payload = JSON.parse(cleaned);
    } catch {
      return {
        ok: !/error/i.test(text),
        label,
        reason: "validator returned non-JSON",
        manual: VALIDATOR_UI + encodeURIComponent(pageUrl),
      };
    }
    const errors =
      payload?.errors ||
      payload?.tripleGroups?.flatMap?.((g) => g.errors || []) ||
      [];
    return {
      ok: errors.length === 0,
      label,
      errorCount: errors.length,
      errors: errors.slice(0, 3),
    };
  } catch (err) {
    return {
      ok: false,
      label,
      reason: `network: ${err.message}`,
      manual: VALIDATOR_UI + encodeURIComponent(pageUrl),
    };
  }
}

async function checkPage(url, useNetwork) {
  process.stdout.write(`\n=== ${url} ===\n`);
  if (!useNetwork) {
    console.log("  SKIP  --no-network mode (no fetch performed)");
    return { failures: 0, total: 0 };
  }
  let html;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "iran-memorial-validator/1.0" },
    });
    if (!res.ok) {
      console.error(`  FAIL  page fetch -> HTTP ${res.status}`);
      return { failures: 1, total: 1 };
    }
    html = await res.text();
  } catch (err) {
    console.error(`  FAIL  page fetch -> ${err.message}`);
    console.error(`        manual:  ${VALIDATOR_UI + encodeURIComponent(url)}`);
    return { failures: 1, total: 1 };
  }

  const blocks = extractJsonLdBlocks(html);
  if (blocks.length === 0) {
    console.error("  FAIL  no JSON-LD blocks found on page");
    return { failures: 1, total: 1 };
  }

  let failures = 0;
  for (const block of blocks) {
    const result = await validateBlock(block, url);
    const status = result.ok ? "PASS" : "FAIL";
    if (!result.ok) failures++;
    const detail = result.reason
      ? ` (${result.reason})`
      : result.errorCount
        ? ` (${result.errorCount} errors)`
        : "";
    console.log(`  ${status}  ${result.label}${detail}`);
    if (result.errors?.length) {
      for (const e of result.errors) {
        console.log(`         - ${e.errorType || e.code || ""} ${e.errorDescription || e.message || ""}`);
      }
    }
    if (!result.ok && result.manual) {
      console.log(`         manual: ${result.manual}`);
    }
  }
  return { failures, total: blocks.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }

  let failures = 0;
  let total = 0;
  for (const url of args.pages) {
    const r = await checkPage(url, args.network);
    failures += r.failures;
    total += r.total;
  }

  console.log(`\n--- summary: ${total - failures}/${total} blocks PASS ---`);
  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("fatal:", err);
    process.exit(2);
  });
