/**
 * sync-gender-to-db.ts — Sync gender values from YAML files to DB
 *
 * Updates DB records where gender differs from YAML (e.g., after infer_gender.py).
 * Only updates gender field, leaves all other fields untouched.
 *
 * Usage:
 *   npx tsx tools/sync-gender-to-db.ts              # Full run
 *   npx tsx tools/sync-gender-to-db.ts --dry-run     # Preview only
 */

import { PrismaClient } from "@prisma/client";
import { parse } from "yaml";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();
const DATA_DIR = join(__dirname, "..", "data");
const DRY_RUN = process.argv.includes("--dry-run");

function readYaml(filePath: string): any {
  const content = readFileSync(filePath, "utf-8");
  try {
    return parse(content);
  } catch {
    return null; // Skip unparseable YAML
  }
}

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (entry.endsWith(".yaml") && !entry.startsWith("_")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  console.log(`\n=== sync-gender-to-db.ts ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  // Load all DB victims with their current gender
  console.log("Loading victims from DB...");
  const dbVictims = await prisma.victim.findMany({
    select: { id: true, slug: true, gender: true },
  });
  const dbMap = new Map(dbVictims.map((v) => [v.slug, v]));
  console.log(`  ${dbMap.size} victims in DB.\n`);

  const victimsDir = join(DATA_DIR, "victims");
  const yamlFiles = findYamlFiles(victimsDir);

  let updated = 0, skipped = 0, notInDb = 0, errors = 0;

  for (const filePath of yamlFiles) {
    const v = readYaml(filePath);
    if (!v || !v.id) continue;

    const slug = String(v.id);
    const yamlGender = v.gender || null;
    const dbVictim = dbMap.get(slug);

    if (!dbVictim) {
      notInDb++;
      continue;
    }

    // Only update if YAML has a non-null gender AND it differs from DB
    if (!yamlGender || yamlGender === "null" || yamlGender === dbVictim.gender) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      updated++;
      if (updated <= 20) {
        console.log(`  [UPDATE] ${slug}: ${dbVictim.gender} → ${yamlGender}`);
      }
      continue;
    }

    try {
      await prisma.victim.update({
        where: { id: dbVictim.id },
        data: { gender: yamlGender },
      });
      updated++;
      if (updated % 500 === 0) {
        console.log(`  [${updated}] ${slug}`);
      }
    } catch (e: any) {
      errors++;
      if (errors <= 10) {
        console.log(`  ERROR: ${slug}: ${e.message?.slice(0, 200)}`);
      }
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`  Updated:    ${updated}`);
  console.log(`  Skipped:    ${skipped} (same or null)`);
  console.log(`  Not in DB:  ${notInDb}`);
  console.log(`  Errors:     ${errors}`);

  if (DRY_RUN && updated > 20) {
    console.log(`  ... and ${updated - 20} more (showing first 20)`);
  }
  if (DRY_RUN) {
    console.log(`\n  Re-run without --dry-run to update.`);
  }
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
