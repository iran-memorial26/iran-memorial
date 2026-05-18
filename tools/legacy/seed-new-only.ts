/**
 * seed-new-only.ts — Insert-only seed for new YAML victims
 *
 * Unlike prisma/seed.ts (which uses upsert and overwrites all fields),
 * this script ONLY creates victims whose slug doesn't exist in the DB yet.
 * This protects AI-extracted fields that exist in DB but not in YAML.
 *
 * Usage:
 *   npx tsx tools/seed-new-only.ts              # Full run
 *   npx tsx tools/seed-new-only.ts --dry-run     # Preview only
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

// Map event context text to event slugs (same as seed.ts)
const EVENT_CONTEXT_MAP: Record<string, string> = {
  "2026 Iranian protests": "massacres-2026",
  "2025-2026 Iranian": "massacres-2026",
  "2026 protest": "massacres-2026",
  "Arrest by Guidance Patrol": "woman-life-freedom-2022",
  "Woman, Life, Freedom": "woman-life-freedom-2022",
  "2022 Mahsa Amini protests": "woman-life-freedom-2022",
  "Mahsa Amini": "woman-life-freedom-2022",
  "Bloody November": "bloody-november-2019",
  "November 2019": "bloody-november-2019",
  "Aban 98": "bloody-november-2019",
  "\u0622\u0628\u0627\u0646": "bloody-november-2019",
  "2009 Green Movement": "green-movement-2009",
  "Green Movement": "green-movement-2009",
  "Post-election protests": "green-movement-2009",
  "Student Protests": "student-protests-1999",
  "18 Tir": "student-protests-1999",
  "1988 Prison Massacres": "massacre-1988",
  "\u06A9\u0634\u062A\u0627\u0631 \u06F6\u06F7": "massacre-1988",
  "Death Commission": "massacre-1988",
  "Reign of Terror": "reign-of-terror-1981-1985",
  "Chain Murders": "chain-murders",
};

function guessEventSlug(victim: any): string | null {
  const context = victim.event_context || "";
  for (const [key, slug] of Object.entries(EVENT_CONTEXT_MAP)) {
    if (context.toLowerCase().includes(key.toLowerCase())) {
      return slug;
    }
  }
  return null;
}

async function main() {
  console.log(`\n=== seed-new-only.ts ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  // Step 1: Load all existing slugs from DB in one query
  console.log("Loading existing slugs from DB...");
  const existingVictims = await prisma.victim.findMany({
    select: { slug: true },
  });
  const existingSlugs = new Set(existingVictims.map((v) => v.slug));
  console.log(`  Found ${existingSlugs.size} existing victims in DB.\n`);

  // Step 2: Load event slug→id map
  const events = await prisma.event.findMany({ select: { id: true, slug: true } });
  const eventSlugToId = new Map(events.map((e) => [e.slug, e.id]));

  // Step 3: Find all YAML files
  const victimsDir = join(DATA_DIR, "victims");
  const yamlFiles = findYamlFiles(victimsDir);
  console.log(`Found ${yamlFiles.length} YAML files.\n`);

  let created = 0,
    skipped = 0,
    errors = 0,
    noId = 0;

  for (const filePath of yamlFiles) {
    const v = readYaml(filePath);
    if (!v || !v.id) {
      noId++;
      continue;
    }

    // YAML may parse "-1989" as number -1989, coerce to string
    const slug = String(v.id);

    // Skip if already in DB
    if (existingSlugs.has(slug)) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      created++;
      if (created <= 20) {
        console.log(`  [NEW] ${slug} — ${v.name_latin || "?"}`);
      }
      continue;
    }

    // Resolve event
    const eventSlug = guessEventSlug(v);
    const eventId = eventSlug ? eventSlugToId.get(eventSlug) || null : null;

    try {
      const victimData = {
        slug,
        nameLatin: v.name_latin || "Unknown",
        nameFarsi: v.name_farsi || null,
        aliases: v.aliases || [],
        dateOfBirth: v.date_of_birth ? new Date(v.date_of_birth) : null,
        placeOfBirth: v.place_of_birth || null,
        gender: v.gender || "unknown",
        ethnicity: v.ethnicity || null,
        religion: v.religion || null,
        photoUrl: v.photo || null,
        occupationEn: v.occupation || null,
        occupationFa: null as string | null,
        education: v.education || null,
        familyInfo: v.family || null,
        dreamsEn: typeof v.dreams === "string" ? v.dreams.trim() : null,
        dreamsFa: null as string | null,
        beliefsEn: typeof v.beliefs === "string" ? v.beliefs.trim() : null,
        beliefsFa: null as string | null,
        personalityEn: typeof v.personality === "string" ? v.personality.trim() : null,
        personalityFa: null as string | null,
        quotes: v.quotes || [],
        dateOfDeath: v.date_of_death ? new Date(v.date_of_death) : null,
        ageAtDeath: v.age_at_death || null,
        placeOfDeath: v.place_of_death || null,
        province: v.province || null,
        causeOfDeath: v.cause_of_death || null,
        circumstancesEn: typeof v.circumstances === "string" ? v.circumstances.trim() : null,
        circumstancesFa: null as string | null,
        eventId,
        eventContext: typeof v.event_context === "string" ? v.event_context.trim() : null,
        responsibleForces: typeof v.responsible_forces === "string" ? v.responsible_forces.trim() : null,
        witnesses: Array.isArray(v.witnesses) ? v.witnesses : [],
        lastSeen: typeof v.last_seen === "string" ? v.last_seen.trim() : null,
        burialLocation: v.burial?.location || null,
        burialDate: v.burial?.date ? new Date(v.burial.date) : null,
        burialCircumstancesEn: typeof v.burial?.circumstances === "string" ? v.burial.circumstances.trim() : null,
        burialCircumstancesFa: null as string | null,
        graveStatus: typeof v.burial?.grave_status === "string" ? v.burial.grave_status.trim() : null,
        familyPersecutionEn: typeof v.family_persecution === "string" ? v.family_persecution.trim() : null,
        familyPersecutionFa: null as string | null,
        legalProceedings: typeof v.legal_proceedings === "string" ? v.legal_proceedings.trim() : null,
        tributes: v.tributes || [],
        verificationStatus: v.status || "unverified",
        dataSource: typeof v.updated_by === "string" ? v.updated_by.trim() : null,
        notes: typeof v.notes === "string" ? v.notes.trim() : null,
      };

      const victim = await prisma.victim.create({ data: victimData });

      // Create sources
      if (v.sources && Array.isArray(v.sources)) {
        for (const source of v.sources) {
          if (!source.name) continue;
          await prisma.source.create({
            data: {
              victimId: victim.id,
              url: source.url || null,
              name: source.name,
              sourceType: source.type || null,
              publishedDate: source.date ? new Date(source.date) : null,
            },
          });
        }
      }

      created++;
      if (created % 500 === 0) {
        console.log(`  [${created}] ${v.name_latin || v.id}`);
      }
    } catch (e: any) {
      errors++;
      if (errors <= 20) {
        console.log(`  ERROR: ${slug}: ${e.message?.slice(0, 500)}`);
      }
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`  YAML files:  ${yamlFiles.length}`);
  console.log(`  Already in DB: ${skipped}`);
  console.log(`  New created: ${created}`);
  console.log(`  No ID:       ${noId}`);
  console.log(`  Errors:      ${errors}`);
  console.log(`  Total in DB: ${existingSlugs.size + (DRY_RUN ? 0 : created)}`);

  if (DRY_RUN && created > 20) {
    console.log(`\n  ... and ${created - 20} more new victims (showing first 20)`);
  }
  if (DRY_RUN) {
    console.log(`\n  Re-run without --dry-run to actually insert.`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
