#!/usr/bin/env node
/**
 * roadmap-bump — sprint-end ritual helper for data/roadmap.ts
 *
 * One command at the end of every sprint:
 *
 *   node scripts/roadmap-bump.mjs review
 *
 * What it does:
 *   1. Updates ROADMAP_LAST_REVIEWED to today (UTC).
 *   2. Validates that every item has the required fields and a
 *      plausible `updated` date (within the last 12 months).
 *   3. Lists items whose `updated` is more than 90 days old —
 *      candidates for "should this still be on the roadmap?".
 *   4. Prints item counts by status so you see the shape of the
 *      roadmap at a glance.
 *
 * Other modes:
 *
 *   node scripts/roadmap-bump.mjs lint      — check only, no writes
 *   node scripts/roadmap-bump.mjs touch X   — bump item X's `updated` to today
 *
 * Designed to be run by hand at the end of each sprint, not in CI.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROADMAP_PATH = resolve(here, "..", "data", "roadmap.ts");

function today() {
  return new Date().toISOString().split("T")[0];
}

function loadFile() {
  return readFileSync(ROADMAP_PATH, "utf8");
}

function saveFile(s) {
  writeFileSync(ROADMAP_PATH, s, "utf8");
}

// We don't try to parse TypeScript — we work on the source string.
// The roadmap file is tightly conventionalised, so regex is sufficient.

function bumpReviewedDate(src) {
  const t = today();
  const next = src.replace(
    /export const ROADMAP_LAST_REVIEWED = "[^"]+";/,
    `export const ROADMAP_LAST_REVIEWED = "${t}";`,
  );
  return { next, changed: next !== src, today: t };
}

/** Parse out a flat list of items. Tolerant of whitespace, expects each
 *  item to be `{ … }` literal containing `title:`, `status:`, `updated:`. */
function extractItems(src) {
  // Match the array, not the date constant whose name also starts with ROADMAP.
  const start = src.indexOf("export const ROADMAP:");
  if (start < 0) return [];
  const region = src.slice(start);

  const items = [];
  // The first `[` would be inside `RoadmapItem[]` — find the array opener
  // after the `=` sign instead.
  const eqIdx = region.indexOf("=");
  if (eqIdx < 0) return [];
  const arrStart = region.indexOf("[", eqIdx);
  if (arrStart < 0) return [];
  let i = arrStart + 1;
  let depth = 0;
  let itemStart = -1;
  while (i < region.length) {
    const c = region[i];
    if (depth === 0 && c === "{") {
      depth = 1;
      itemStart = i;
    } else if (depth > 0) {
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          items.push(region.slice(itemStart, i + 1));
        }
      }
    } else if (depth === 0 && c === "]") {
      break;
    }
    i++;
  }

  return items.map((raw) => {
    const m = (re) => raw.match(re);
    return {
      raw,
      title: m(/title:\s*"([^"]*)"/)?.[1] ?? "(no title)",
      status: m(/status:\s*"([^"]*)"/)?.[1] ?? "(no status)",
      updated: m(/updated:\s*"([^"]*)"/)?.[1] ?? null,
      hasDescription: /description:\s*"/.test(raw),
      depsRaw: m(/dependencies:\s*\[([^\]]*)\]/)?.[1] ?? "",
    };
  });
}

function lint(items) {
  const issues = [];
  const ageDaysCut = 90;
  const now = Date.now();
  const t = today();

  const counts = { now: 0, next: 0, later: 0, done: 0, unknown: 0 };
  for (const it of items) {
    counts[it.status] = (counts[it.status] ?? 0) + 1;

    if (!it.title || it.title === "(no title)")
      issues.push(`✗ item missing title: ${it.raw.slice(0, 60)}…`);
    if (!["now", "next", "later", "done"].includes(it.status))
      issues.push(`✗ "${it.title}" — bad status "${it.status}"`);
    if (!it.updated)
      issues.push(`✗ "${it.title}" — missing updated date`);
    if (!it.hasDescription)
      issues.push(`✗ "${it.title}" — missing description`);

    if (it.updated && /^\d{4}-\d{2}-\d{2}$/.test(it.updated)) {
      const age = (now - new Date(it.updated).getTime()) / 86_400_000;
      if (age > ageDaysCut && it.status !== "done")
        issues.push(
          `↻ "${it.title}" (status=${it.status}) updated ${Math.round(age)} days ago — re-evaluate or bump`,
        );
      if (age < 0)
        issues.push(`✗ "${it.title}" — updated date is in the future`);
    } else if (it.updated) {
      issues.push(`✗ "${it.title}" — updated "${it.updated}" not YYYY-MM-DD`);
    }
  }

  return { issues, counts, today: t };
}

function touchItem(src, needle) {
  const t = today();
  const items = extractItems(src);
  const target = items.find(
    (i) => i.title.toLowerCase().includes(needle.toLowerCase()),
  );
  if (!target) {
    return { next: src, changed: false, error: `no item matched "${needle}"` };
  }
  // Replace just this item's `updated` with today.
  const replaced = target.raw.replace(
    /updated:\s*"[^"]*"/,
    `updated: "${t}"`,
  );
  if (replaced === target.raw) {
    return { next: src, changed: false, error: "item has no updated field?" };
  }
  return {
    next: src.replace(target.raw, replaced),
    changed: true,
    title: target.title,
    today: t,
  };
}

function main() {
  const cmd = process.argv[2] || "review";
  const src = loadFile();
  const items = extractItems(src);

  if (cmd === "lint") {
    const { issues, counts, today: t } = lint(items);
    console.log(`Roadmap lint @ ${t}`);
    console.log(`  now=${counts.now} next=${counts.next} later=${counts.later} done=${counts.done}`);
    if (issues.length === 0) {
      console.log("  ✓ no issues");
      process.exit(0);
    }
    for (const i of issues) console.log("  " + i);
    // Don't fail on advisory ↻ items; only fail on hard ✗.
    if (issues.some((s) => s.startsWith("✗"))) process.exit(1);
    process.exit(0);
  }

  if (cmd === "touch") {
    const needle = process.argv[3];
    if (!needle) {
      console.error("usage: roadmap-bump.mjs touch <substring of item title>");
      process.exit(2);
    }
    const r = touchItem(src, needle);
    if (!r.changed) {
      console.error(`✗ ${r.error}`);
      process.exit(1);
    }
    saveFile(r.next);
    console.log(`✓ touched "${r.title}" → updated=${r.today}`);
    process.exit(0);
  }

  if (cmd === "review") {
    const { next, changed, today: t } = bumpReviewedDate(src);
    if (changed) saveFile(next);
    console.log(`Roadmap reviewed at ${t}${changed ? " (date bumped)" : " (already today)"}`);
    const { issues, counts } = lint(extractItems(next));
    console.log(`  now=${counts.now} next=${counts.next} later=${counts.later} done=${counts.done}`);
    if (issues.length === 0) {
      console.log("  ✓ no issues");
      return;
    }
    console.log("");
    console.log("Findings (review and decide):");
    for (const i of issues) console.log("  " + i);
    return;
  }

  console.error(`unknown command "${cmd}"`);
  console.error("usage: roadmap-bump.mjs [review|lint|touch <substring>]");
  process.exit(2);
}

main();
