/**
 * dedup-round5.ts — Final cleanup of remaining duplicates
 *
 * Handles two categories:
 * 1. Same Farsi name + NULL death date (107 groups, 114 removable)
 * 2. Same Latin name + death date with Farsi character variants (ZWNJ, ئی/یی, ک/ك, etc.)
 *
 * Usage:
 *   npx tsx tools/dedup-round5.ts --dry-run    # Preview
 *   npx tsx tools/dedup-round5.ts              # Execute
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse, stringify } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();
const DATA_DIR = join(__dirname, "..", "data", "victims");
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Farsi normalization
// ---------------------------------------------------------------------------

function normalizeFarsi(s: string | null): string {
  if (!s) return "";
  return s
    .replace(/\u200C/g, "") // Remove ZWNJ
    .replace(/ /g, "")      // Remove spaces
    .replace(/ك/g, "ک")     // Arabic kaf → Persian kaf
    .replace(/ي/g, "ی")     // Arabic yeh → Persian yeh
    .replace(/ة/g, "ه")     // Arabic ta marbuta → heh
    .replace(/ە/g, "ه")     // Kurdish heh → Persian heh
    .replace(/ئ/g, "ی")     // Hamza on yeh → yeh
    .replace(/ؤ/g, "و")     // Hamza on waw → waw
    .replace(/أ/g, "ا")     // Hamza on alef → alef
    .replace(/إ/g, "ا")     // Hamza below alef → alef
    .replace(/آ/g, "ا")     // Alef madda → alef (for normalization only)
    .replace(/[\u064B-\u065F]/g, "") // Remove all Arabic diacritics (fathatan through hamza)
    .replace(/[\u0610-\u061A]/g, "") // Remove additional Arabic marks
    .replace(/\u0651/g, "")  // Remove shadda
    .replace(/\u0654/g, "")  // Remove hamza above
    .replace(/\u0655/g, ""); // Remove hamza below
}

// ---------------------------------------------------------------------------
// Scoring (same as dedup-db.ts)
// ---------------------------------------------------------------------------

function scoreVictim(v: any): number {
  let score = 0;
  const fields = [
    "nameLatin", "nameFarsi", "placeOfBirth", "gender", "ethnicity", "religion",
    "photoUrl", "occupationEn", "education", "placeOfDeath", "province",
    "causeOfDeath", "circumstancesEn", "eventContext", "responsibleForces",
  ];
  for (const f of fields) {
    if (v[f] != null && v[f] !== "" && v[f] !== "unknown") score += 1;
  }
  if (v.photoUrl) score += 10;
  if (v.circumstancesEn) score += Math.min(v.circumstancesEn.length / 100, 10);
  if (v.eventId) score += 5;
  if (v.ageAtDeath) score += 2;
  if (v.dateOfDeath) score += 5; // Bonus for having a death date
  if (v._count?.sources) score += Math.min(v._count.sources, 5);
  if (v.dataSource && !v.dataSource.includes("boroumand")) score += 3;
  return score;
}

// ---------------------------------------------------------------------------
// YAML file map
// ---------------------------------------------------------------------------

function buildSlugFileMap(): Map<string, string> {
  const map = new Map<string, string>();
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".yaml") && !entry.startsWith("_")) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const data = parse(content);
          if (data?.id) map.set(String(data.id), fullPath);
        } catch { /* skip */ }
      }
    }
  }
  walk(DATA_DIR);
  return map;
}

// ---------------------------------------------------------------------------
// Merge + Delete
// ---------------------------------------------------------------------------

async function mergeAndDelete(
  keeper: any,
  losers: any[],
  slugFileMap: Map<string, string>,
  stats: { deleted: number; yamlDeleted: number; sourcesMoved: number; fieldsMerged: number }
) {
  // Merge fields from losers into keeper
  const mergeableFields = [
    "nameLatin", "nameFarsi", "placeOfBirth", "gender", "ethnicity", "religion",
    "photoUrl", "occupationEn", "occupationFa", "education", "familyInfo",
    "dreamsEn", "beliefsEn", "personalityEn", "dateOfBirth", "ageAtDeath",
    "placeOfDeath", "province", "causeOfDeath", "circumstancesEn", "circumstancesFa",
    "eventId", "eventContext", "responsibleForces", "lastSeen", "burialLocation",
    "burialCircumstancesEn", "graveStatus", "familyPersecutionEn", "legalProceedings",
  ];
  const updateData: any = {};
  for (const loser of losers) {
    for (const f of mergeableFields) {
      const kVal = keeper[f] ?? updateData[f];
      const lVal = loser[f];
      if ((kVal == null || kVal === "" || kVal === "unknown") && lVal != null && lVal !== "" && lVal !== "unknown") {
        updateData[f] = lVal;
        stats.fieldsMerged++;
      }
    }
    // Take longer circumstancesEn
    const kCirc = keeper.circumstancesEn ?? updateData.circumstancesEn ?? "";
    const lCirc = loser.circumstancesEn ?? "";
    if (lCirc.length > kCirc.length * 1.5) {
      updateData.circumstancesEn = lCirc;
      stats.fieldsMerged++;
    }
  }

  if (Object.keys(updateData).length > 0 && !DRY_RUN) {
    await prisma.victim.update({ where: { id: keeper.id }, data: updateData });
  }

  // Move unique sources
  const keeperSourceKeys = new Set(keeper.sources.map((s: any) => `${s.url || ""}|||${s.name}`));
  for (const loser of losers) {
    for (const source of loser.sources) {
      const key = `${source.url || ""}|||${source.name}`;
      if (!keeperSourceKeys.has(key)) {
        if (!DRY_RUN) {
          await prisma.source.update({ where: { id: source.id }, data: { victimId: keeper.id } });
        }
        keeperSourceKeys.add(key);
        stats.sourcesMoved++;
      }
    }
  }

  // Delete losers
  for (const loser of losers) {
    if (!DRY_RUN) {
      await prisma.victim.delete({ where: { id: loser.id } });
    }
    stats.deleted++;

    const yamlPath = slugFileMap.get(loser.slug);
    if (yamlPath && existsSync(yamlPath) && !DRY_RUN) {
      unlinkSync(yamlPath);
      stats.yamlDeleted++;
    } else if (yamlPath && existsSync(yamlPath)) {
      stats.yamlDeleted++; // count for dry run
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== dedup-round5.ts ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  const slugFileMap = buildSlugFileMap();
  console.log(`${slugFileMap.size} YAML files indexed.\n`);

  const stats = { deleted: 0, yamlDeleted: 0, sourcesMoved: 0, fieldsMerged: 0 };

  // =========================================================================
  // Category 1: Same Farsi name + NULL death date
  // =========================================================================
  console.log("=== Category 1: Same Farsi name, NULL death date ===\n");

  const nullDateGroups: { name_farsi: string; cnt: bigint }[] = await prisma.$queryRaw`
    SELECT name_farsi, COUNT(*) as cnt
    FROM victims
    WHERE name_farsi IS NOT NULL AND name_farsi != ''
      AND name_farsi != 'ناشناس'
      AND name_latin NOT IN ('Unknown', 'Unnamed')
      AND date_of_death IS NULL
    GROUP BY name_farsi
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  console.log(`  ${nullDateGroups.length} groups found.\n`);

  let cat1Merged = 0;
  for (const g of nullDateGroups) {
    const victims = await prisma.victim.findMany({
      where: { nameFarsi: g.name_farsi, dateOfDeath: null },
      include: { sources: true, _count: { select: { sources: true } } },
    });
    if (victims.length <= 1) continue;

    const scored = victims.map(v => ({ ...v, score: scoreVictim(v) }));
    scored.sort((a, b) => b.score - a.score);

    if (DRY_RUN && cat1Merged < 10) {
      console.log(`  [${victims.length}x] ${g.name_farsi}: ${victims.map(v => v.slug).join(", ")}`);
    }

    await mergeAndDelete(scored[0], scored.slice(1), slugFileMap, stats);
    cat1Merged++;
  }
  console.log(`  Cat 1: ${cat1Merged} groups, ${stats.deleted} deleted.\n`);

  // =========================================================================
  // Category 2: Same Latin name + date, Farsi character variants
  // =========================================================================
  console.log("=== Category 2: Same Latin name + date, Farsi normalization ===\n");

  const latinDatePairs: { id1: string; id2: string; latin: string; date: Date; farsi1: string; farsi2: string }[] = await prisma.$queryRaw`
    SELECT v1.id as id1, v2.id as id2,
      LOWER(v1.name_latin) as latin, v1.date_of_death as date,
      v1.name_farsi as farsi1, v2.name_farsi as farsi2
    FROM victims v1
    INNER JOIN victims v2 ON LOWER(v1.name_latin) = LOWER(v2.name_latin)
      AND v1.date_of_death = v2.date_of_death
      AND v1.id < v2.id
    WHERE v1.name_latin NOT IN ('Unknown', 'Unnamed')
      AND LOWER(v1.name_latin) NOT IN ('unknown', 'unnamed', 'unknwon')
      AND v1.date_of_death IS NOT NULL
  `;

  console.log(`  ${latinDatePairs.length} pairs found.`);

  // Group by (latin, date) to handle groups of 3+
  const groupMap = new Map<string, Set<string>>();
  for (const p of latinDatePairs) {
    const key = `${p.latin}|||${p.date.toISOString()}`;
    if (!groupMap.has(key)) groupMap.set(key, new Set());
    groupMap.get(key)!.add(p.id1);
    groupMap.get(key)!.add(p.id2);
  }

  let cat2Merged = 0, cat2Skipped = 0;
  const processedIds = new Set<string>();

  for (const [key, idSet] of groupMap) {
    const ids = [...idSet].filter(id => !processedIds.has(id));
    if (ids.length <= 1) continue;

    const victims = await prisma.victim.findMany({
      where: { id: { in: ids } },
      include: { sources: true, _count: { select: { sources: true } } },
    });

    // Group by normalized Farsi name
    const farsiGroups = new Map<string, typeof victims>();
    for (const v of victims) {
      const norm = normalizeFarsi(v.nameFarsi);
      if (!farsiGroups.has(norm)) farsiGroups.set(norm, []);
      farsiGroups.get(norm)!.push(v);
    }

    for (const [norm, group] of farsiGroups) {
      if (group.length <= 1) continue;

      const scored = group.map(v => ({ ...v, score: scoreVictim(v) }));
      scored.sort((a, b) => b.score - a.score);

      if (DRY_RUN) {
        console.log(`  MERGE: "${scored[0].nameFarsi}" ← ${scored.slice(1).map(v => `"${v.nameFarsi}"`).join(", ")} [${scored[0].slug}]`);
      }

      await mergeAndDelete(scored[0], scored.slice(1), slugFileMap, stats);
      for (const v of group) processedIds.add(v.id);
      cat2Merged++;
    }

    // Count skipped (different normalized Farsi)
    const uniqueNorms = [...farsiGroups.keys()];
    if (uniqueNorms.length > 1) {
      cat2Skipped++;
      if (DRY_RUN) {
        const [l, d] = key.split("|||");
        const names = [...farsiGroups.entries()].map(([_, g]) => `"${g[0].nameFarsi}"`).join(" vs ");
        console.log(`  SKIP: ${l} (${d.slice(0,10)}): ${names} — different Farsi names`);
      }
    }
  }

  console.log(`\n  Cat 2: ${cat2Merged} merged, ${cat2Skipped} skipped (different people).\n`);

  // Final count
  const finalCount = DRY_RUN ? "N/A" : await prisma.victim.count();

  console.log(`\n=== Results ===`);
  console.log(`  DB entries deleted:  ${stats.deleted}`);
  console.log(`  YAML files deleted:  ${stats.yamlDeleted}`);
  console.log(`  Sources moved:       ${stats.sourcesMoved}`);
  console.log(`  Fields merged:       ${stats.fieldsMerged}`);
  console.log(`  Final DB count:      ${finalCount}`);

  if (DRY_RUN) console.log(`\nRe-run without --dry-run to execute.`);
}

main()
  .catch(e => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
