#!/usr/bin/env node
/**
 * i18n consistency check.
 *
 * Fails (exit 1) when:
 *   - a non-English locale is missing a key the English baseline has
 *   - a non-English locale has an extra key not in English
 *   - a non-English locale value is identical to English for a sentence-like
 *     string AND the key is not allowlisted in scripts/i18n-allowed-english.json
 *
 * Wired into npm test (via __tests__/i18n.test.ts) and CI (test.yml).
 * Run directly: `npm run check:i18n` or `node scripts/check-i18n.mjs`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const BASELINE = "en";
const LOCALES = ["en", "de", "fa", "ar", "fr", "it", "es"];

const allowlistPath = path.join(__dirname, "i18n-allowed-english.json");
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
const allowedKeys = new Set(allowlist.keys || []);
const allowedScoped = new Set(allowlist.scoped || []); // entries like "key@locale"

/** Flatten {a:{b:"x"}} -> {"a.b":"x"} */
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** Heuristic: is this a sentence-like string that should always be translated? */
function isSentenceLike(value) {
  if (typeof value !== "string") return false;
  if (value.length < 6) return false; // very short tokens
  if (!/[A-Za-z]/.test(value)) return false; // numbers / emoji-only
  // Only flag if it contains at least one space — single-word labels like "API"
  // or "Submit" are too noisy and the allowlist handles real cases.
  if (!/\s/.test(value)) return false;
  return true;
}

function loadLocale(locale) {
  const p = path.join(repoRoot, "messages", `${locale}.json`);
  return flatten(JSON.parse(fs.readFileSync(p, "utf8")));
}

function isAllowed(key, locale) {
  if (allowedKeys.has(key)) return true;
  if (allowedScoped.has(`${key}@${locale}`)) return true;
  return false;
}

function check() {
  const baseline = loadLocale(BASELINE);
  const baselineKeys = new Set(Object.keys(baseline));

  const errors = [];
  let placeholderCount = 0;

  for (const locale of LOCALES) {
    if (locale === BASELINE) continue;

    const data = loadLocale(locale);
    const dataKeys = new Set(Object.keys(data));

    // Missing keys (exists in EN, not in locale)
    for (const k of baselineKeys) {
      if (!dataKeys.has(k)) errors.push(`${locale}: MISSING key "${k}"`);
    }
    // Extra keys (exists in locale, not in EN)
    for (const k of dataKeys) {
      if (!baselineKeys.has(k)) errors.push(`${locale}: EXTRA key "${k}" (not in en.json)`);
    }
    // Placeholder strings: locale value identical to English
    for (const k of dataKeys) {
      if (!baselineKeys.has(k)) continue;
      const enVal = baseline[k];
      const locVal = data[k];
      if (typeof enVal !== "string" || typeof locVal !== "string") continue;
      if (locVal !== enVal) continue;
      if (!isSentenceLike(enVal)) continue;
      if (isAllowed(k, locale)) continue;
      errors.push(
        `${locale}: PLACEHOLDER at "${k}" — value still equals English: "${enVal.slice(0, 80)}${enVal.length > 80 ? "…" : ""}"`,
      );
      placeholderCount++;
    }
  }

  if (errors.length === 0) {
    console.log(
      `i18n check OK — ${LOCALES.length} locales, ${baselineKeys.size} keys each, no placeholders.`,
    );
    return 0;
  }

  console.error(`\ni18n check FAILED — ${errors.length} issues across ${LOCALES.length - 1} locales:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error("");
  console.error(
    `If a placeholder is intentional (e.g. a proper noun), add the key to ` +
      `scripts/i18n-allowed-english.json under "keys" (or scope it as ` +
      `"key@locale" under "scoped").`,
  );
  return 1;
}

const exitCode = check();
// Only exit-on-load when run directly. When imported by Vitest, return value.
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(exitCode);
}
export { check };
