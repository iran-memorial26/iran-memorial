/**
 * dedup-db.ts — Comprehensive database deduplication
 *
 * Finds and merges duplicate victims in the database:
 * 1. Named duplicates: same name_farsi + same date_of_death
 * 2. Unknown duplicates: same name_farsi ('ناشناس') + same date + same circumstances text
 *
 * For each duplicate group:
 * - Scores entries (non-null fields, photo, text length) → picks best as keeper
 * - Merges non-null fields from losers into keeper
 * - Moves sources from losers to keeper (deduped by url)
 * - Deletes losers from DB + YAML files
 *
 * Usage:
 *   npx tsx tools/dedup-db.ts              # Full run
 *   npx tsx tools/dedup-db.ts --dry-run    # Preview only
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
// Helpers
// ---------------------------------------------------------------------------

/** Score a victim entry: higher = more data = better keeper */
function scoreVictim(v: any): number {
  let score = 0;
  // Count non-null string/number fields
  const fields = [
    "nameLatin", "nameFarsi", "placeOfBirth", "gender", "ethnicity", "religion",
    "photoUrl", "occupationEn", "occupationFa", "education", "dreamsEn", "beliefsEn",
    "personalityEn", "placeOfDeath", "province", "causeOfDeath", "circumstancesEn",
    "circumstancesFa", "eventContext", "responsibleForces", "lastSeen",
    "burialLocation", "graveStatus", "familyPersecutionEn", "legalProceedings", "notes",
  ];
  for (const f of fields) {
    if (v[f] != null && v[f] !== "" && v[f] !== "unknown") score += 1;
  }
  // Bonus for photo
  if (v.photoUrl) score += 10;
  // Bonus for longer circumstances text
  if (v.circumstancesEn) score += Math.min(v.circumstancesEn.length / 100, 10);
  // Bonus for having an event link
  if (v.eventId) score += 5;
  // Bonus for age
  if (v.ageAtDeath) score += 2;
  // Bonus for familyInfo
  if (v.familyInfo) score += 2;
  // Bonus for sources count
  if (v._count?.sources) score += Math.min(v._count.sources, 5);
  // Penalty for "unknown" name
  if (v.nameLatin === "Unknown" || v.nameLatin === "Unnamed") score -= 5;
  // Bonus for non-boroumand source (Wikipedia, HRANA more detailed)
  if (v.dataSource && !v.dataSource.includes("boroumand")) score += 3;
  return score;
}

/** Merge non-null fields from source into target (only fill nulls) */
function mergeFields(target: any, source: any): string[] {
  const merged: string[] = [];
  const mergeableFields = [
    "nameLatin", "nameFarsi", "placeOfBirth", "gender", "ethnicity", "religion",
    "photoUrl", "occupationEn", "occupationFa", "education", "familyInfo",
    "dreamsEn", "dreamsFa", "beliefsEn", "beliefsFa", "personalityEn", "personalityFa",
    "dateOfBirth", "ageAtDeath", "placeOfDeath", "province", "causeOfDeath",
    "circumstancesEn", "circumstancesFa", "eventId", "eventContext",
    "responsibleForces", "lastSeen", "burialLocation", "burialDate",
    "burialCircumstancesEn", "burialCircumstancesFa", "graveStatus",
    "familyPersecutionEn", "familyPersecutionFa", "legalProceedings", "notes",
  ];
  for (const f of mergeableFields) {
    const tVal = target[f];
    const sVal = source[f];
    // Fill null/empty target from source
    if ((tVal == null || tVal === "" || tVal === "unknown") && sVal != null && sVal !== "" && sVal !== "unknown") {
      target[f] = sVal;
      merged.push(f);
    }
    // Special: take longer circumstancesEn
    if (f === "circumstancesEn" && tVal && sVal && sVal.length > tVal.length * 1.5) {
      target[f] = sVal;
      merged.push(f + "(longer)");
    }
  }
  // Merge arrays (aliases, witnesses, quotes, tributes)
  for (const arrField of ["aliases", "witnesses", "quotes", "tributes"]) {
    const tArr = target[arrField] || [];
    const sArr = source[arrField] || [];
    if (sArr.length > 0) {
      const combined = [...new Set([...tArr, ...sArr])];
      if (combined.length > tArr.length) {
        target[arrField] = combined;
        merged.push(arrField);
      }
    }
  }
  return merged;
}

// Build slug→filepath map for all YAML files
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
          if (data?.id) {
            map.set(String(data.id), fullPath);
          }
        } catch {
          // skip
        }
      }
    }
  }
  walk(DATA_DIR);
  return map;
}

// Update YAML file with merged fields from DB
function updateYamlFromDb(filePath: string, dbVictim: any): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = parse(content);
    if (!data) return false;

    let changed = false;
    // Map DB fields → YAML fields
    const mapping: [string, string][] = [
      ["nameFarsi", "name_farsi"],
      ["placeOfBirth", "place_of_birth"],
      ["gender", "gender"],
      ["ethnicity", "ethnicity"],
      ["religion", "religion"],
      ["photoUrl", "photo"],
      ["occupationEn", "occupation"],
      ["education", "education"],
      ["ageAtDeath", "age_at_death"],
      ["placeOfDeath", "place_of_death"],
      ["province", "province"],
      ["causeOfDeath", "cause_of_death"],
      ["responsibleForces", "responsible_forces"],
      ["eventContext", "event_context"],
    ];

    for (const [dbField, yamlField] of mapping) {
      const dbVal = dbVictim[dbField];
      const yamlVal = data[yamlField];
      if (dbVal != null && dbVal !== "" && dbVal !== "unknown" && (yamlVal == null || yamlVal === "" || yamlVal === "unknown")) {
        data[yamlField] = dbVal;
        changed = true;
      }
    }

    // Merge circumstances
    if (dbVictim.circumstancesEn && (!data.circumstances || dbVictim.circumstancesEn.length > (data.circumstances?.length || 0) * 1.3)) {
      data.circumstances = dbVictim.circumstancesEn;
      changed = true;
    }

    if (changed) {
      writeFileSync(filePath, stringify(data, { lineWidth: 0 }));
    }
    return changed;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== dedup-db.ts ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  // Step 1: Build YAML slug→file map
  console.log("Building YAML file map...");
  const slugFileMap = buildSlugFileMap();
  console.log(`  ${slugFileMap.size} YAML files indexed.\n`);

  // Step 2: Find named duplicate groups
  console.log("Finding named duplicates (same name_farsi + date_of_death)...");
  const namedGroups: { name_farsi: string; date_of_death: Date; cnt: bigint }[] = await prisma.$queryRaw`
    SELECT name_farsi, date_of_death, COUNT(*) as cnt
    FROM victims
    WHERE name_farsi IS NOT NULL AND name_farsi != ''
      AND name_farsi != 'ناشناس'
      AND name_latin NOT IN ('Unknown', 'Unnamed')
      AND date_of_death IS NOT NULL
    GROUP BY name_farsi, date_of_death
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;
  const namedRemovable = namedGroups.reduce((sum, g) => sum + Number(g.cnt) - 1, 0);
  console.log(`  ${namedGroups.length} groups, ${namedRemovable} removable entries.\n`);

  // Step 3: Find Unknown duplicate groups (same text)
  console.log("Finding Unknown duplicates (same text)...");
  const unknownGroups: { name_farsi: string; date_of_death: Date; circ_prefix: string; cnt: bigint }[] = await prisma.$queryRaw`
    SELECT name_farsi, date_of_death, LEFT(circumstances_en, 200) as circ_prefix, COUNT(*) as cnt
    FROM victims
    WHERE name_farsi = 'ناشناس'
      AND circumstances_en IS NOT NULL
      AND date_of_death IS NOT NULL
    GROUP BY name_farsi, date_of_death, LEFT(circumstances_en, 200)
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;
  const unknownRemovable = unknownGroups.reduce((sum, g) => sum + Number(g.cnt) - 1, 0);
  console.log(`  ${unknownGroups.length} groups, ${unknownRemovable} removable entries.\n`);

  const totalRemovable = namedRemovable + unknownRemovable;
  console.log(`Total removable: ${totalRemovable}\n`);

  if (DRY_RUN) {
    // Show some examples
    console.log("--- Named duplicate examples (first 20) ---");
    for (const g of namedGroups.slice(0, 20)) {
      const victims = await prisma.victim.findMany({
        where: { nameFarsi: g.name_farsi, dateOfDeath: g.date_of_death },
        select: { slug: true, nameLatin: true, dataSource: true },
      });
      console.log(`  [${Number(g.cnt)}x] ${g.name_farsi} (${g.date_of_death.toISOString().slice(0, 10)}): ${victims.map(v => v.slug).join(", ")}`);
    }
    console.log(`\n--- Unknown duplicate examples (first 10) ---`);
    for (const g of unknownGroups.slice(0, 10)) {
      console.log(`  [${Number(g.cnt)}x] ${g.date_of_death.toISOString().slice(0, 10)}: "${g.circ_prefix?.slice(0, 60)}..."`);
    }
    console.log(`\nRe-run without --dry-run to execute.`);
    return;
  }

  // Step 4: Process named duplicates
  let merged = 0, deleted = 0, yamlDeleted = 0, yamlUpdated = 0, sourcesMoved = 0, fieldsMerged = 0;

  console.log("Processing named duplicates...");
  for (let i = 0; i < namedGroups.length; i++) {
    const g = namedGroups[i];
    const victims = await prisma.victim.findMany({
      where: { nameFarsi: g.name_farsi, dateOfDeath: g.date_of_death },
      include: { sources: true, _count: { select: { sources: true } } },
    });

    // Score and pick keeper
    const scored = victims.map(v => ({ ...v, score: scoreVictim(v) }));
    scored.sort((a, b) => b.score - a.score);
    const keeper = scored[0];
    const losers = scored.slice(1);

    // Merge fields from losers into keeper
    const allMerged: string[] = [];
    for (const loser of losers) {
      const fields = mergeFields(keeper, loser);
      allMerged.push(...fields);
    }

    // Build update data from merged fields
    if (allMerged.length > 0) {
      const updateData: any = {};
      for (const f of allMerged) {
        const cleanField = f.replace("(longer)", "");
        if (keeper[cleanField] !== undefined) {
          updateData[cleanField] = keeper[cleanField];
        }
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.victim.update({ where: { id: keeper.id }, data: updateData });
        fieldsMerged += allMerged.length;
      }
    }

    // Move sources from losers to keeper (dedup by url+name)
    const keeperSourceKeys = new Set(
      keeper.sources.map(s => `${s.url || ""}|||${s.name}`)
    );
    for (const loser of losers) {
      for (const source of loser.sources) {
        const key = `${source.url || ""}|||${source.name}`;
        if (!keeperSourceKeys.has(key)) {
          await prisma.source.update({
            where: { id: source.id },
            data: { victimId: keeper.id },
          });
          keeperSourceKeys.add(key);
          sourcesMoved++;
        }
      }
    }

    // Delete losers from DB (cascade deletes remaining sources)
    for (const loser of losers) {
      await prisma.victim.delete({ where: { id: loser.id } });
      deleted++;

      // Delete YAML file
      const yamlPath = slugFileMap.get(loser.slug);
      if (yamlPath && existsSync(yamlPath)) {
        unlinkSync(yamlPath);
        yamlDeleted++;
      }
    }

    // Update keeper YAML with merged data
    const keeperYaml = slugFileMap.get(keeper.slug);
    if (keeperYaml && allMerged.length > 0) {
      if (updateYamlFromDb(keeperYaml, keeper)) {
        yamlUpdated++;
      }
    }

    merged++;
    if (merged % 200 === 0) {
      console.log(`  [${merged}/${namedGroups.length}] named groups processed, ${deleted} deleted`);
    }
  }
  console.log(`  Named: ${merged} groups processed, ${deleted} DB entries deleted.\n`);

  // Step 5: Process Unknown duplicates (same text)
  console.log("Processing Unknown duplicates (same text)...");
  let unknownMerged = 0, unknownDeleted = 0, unknownYamlDeleted = 0;

  for (let i = 0; i < unknownGroups.length; i++) {
    const g = unknownGroups[i];
    // Find victims matching this group
    const victims = await prisma.victim.findMany({
      where: {
        nameFarsi: "ناشناس",
        dateOfDeath: g.date_of_death,
        circumstancesEn: { startsWith: g.circ_prefix },
      },
      include: { sources: true, _count: { select: { sources: true } } },
    });

    if (victims.length <= 1) continue;

    // Score and pick keeper
    const scored = victims.map(v => ({ ...v, score: scoreVictim(v) }));
    scored.sort((a, b) => b.score - a.score);
    const keeper = scored[0];
    const losers = scored.slice(1);

    // Move unique sources
    const keeperSourceKeys = new Set(
      keeper.sources.map(s => `${s.url || ""}|||${s.name}`)
    );
    for (const loser of losers) {
      for (const source of loser.sources) {
        const key = `${source.url || ""}|||${source.name}`;
        if (!keeperSourceKeys.has(key)) {
          await prisma.source.update({
            where: { id: source.id },
            data: { victimId: keeper.id },
          });
          keeperSourceKeys.add(key);
          sourcesMoved++;
        }
      }
    }

    // Delete losers
    for (const loser of losers) {
      await prisma.victim.delete({ where: { id: loser.id } });
      unknownDeleted++;

      const yamlPath = slugFileMap.get(loser.slug);
      if (yamlPath && existsSync(yamlPath)) {
        unlinkSync(yamlPath);
        unknownYamlDeleted++;
      }
    }

    unknownMerged++;
    if (unknownMerged % 50 === 0) {
      console.log(`  [${unknownMerged}/${unknownGroups.length}] Unknown groups processed`);
    }
  }
  console.log(`  Unknown: ${unknownMerged} groups processed, ${unknownDeleted} DB entries deleted.\n`);

  // Step 6: Final count
  const finalCount = await prisma.victim.count();

  console.log(`\n=== Results ===`);
  console.log(`  Named groups merged:   ${merged}`);
  console.log(`  Unknown groups merged: ${unknownMerged}`);
  console.log(`  DB entries deleted:    ${deleted + unknownDeleted}`);
  console.log(`  YAML files deleted:    ${yamlDeleted + unknownYamlDeleted}`);
  console.log(`  YAML files updated:    ${yamlUpdated}`);
  console.log(`  Sources moved:         ${sourcesMoved}`);
  console.log(`  Fields merged:         ${fieldsMerged}`);
  console.log(`  Final DB count:        ${finalCount}`);
}

main()
  .catch((e) => {
    console.error("Dedup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
