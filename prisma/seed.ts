import { PrismaClient } from "@prisma/client";
import { parse } from "yaml";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

const DATA_DIR = join(__dirname, "..", "data");

function readYaml(filePath: string): any {
  const content = readFileSync(filePath, "utf-8");
  return parse(content);
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

async function seedEvents() {
  const timelinePath = join(DATA_DIR, "events", "timeline.yaml");
  const events = readYaml(timelinePath);

  console.log(`Seeding ${events.length} events...`);

  for (const e of events) {
    const eventData = {
      slug: e.id,
      dateStart: new Date(e.date_start),
      dateEnd: e.date_end ? new Date(e.date_end) : null,
      titleEn: e.title_en,
      titleFa: e.title_fa || null,
      titleDe: e.title_de || null,
      descriptionEn: e.description || null,
      descriptionFa: e.description_fa || null,
      descriptionDe: e.description_de || null,
      estimatedKilledLow: e.estimated_killed_low || e.estimated_killed || null,
      estimatedKilledHigh: e.estimated_killed_high || null,
      tags: e.tags || [],
    };
    await prisma.event.upsert({
      where: { slug: e.id },
      update: eventData,
      create: eventData,
    });
    console.log(`  ✓ ${e.id}`);
  }
}

// Map event context text to event slugs
const EVENT_CONTEXT_MAP: Record<string, string> = {
  // 2026
  "2026 Iranian protests": "massacres-2026",
  "2025-2026 Iranian": "massacres-2026",
  "2026 protest": "massacres-2026",
  // 2022
  "Arrest by Guidance Patrol": "woman-life-freedom-2022",
  "Woman, Life, Freedom": "woman-life-freedom-2022",
  "2022 Mahsa Amini protests": "woman-life-freedom-2022",
  "Mahsa Amini": "woman-life-freedom-2022",
  // 2019
  "Bloody November": "bloody-november-2019",
  "November 2019": "bloody-november-2019",
  "Aban 98": "bloody-november-2019",
  "آبان": "bloody-november-2019",
  // 2009
  "2009 Green Movement": "green-movement-2009",
  "Green Movement": "green-movement-2009",
  "Post-election protests": "green-movement-2009",
  // 1999
  "Student Protests": "student-protests-1999",
  "18 Tir": "student-protests-1999",
  // 1988
  "1988 Prison Massacres": "massacre-1988",
  "کشتار ۶۷": "massacre-1988",
  "Death Commission": "massacre-1988",
  // 1981-1985
  "Reign of Terror": "reign-of-terror-1981-1985",
  // Chain murders
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

async function seedVictims() {
  const victimsDir = join(DATA_DIR, "victims");
  const yamlFiles = findYamlFiles(victimsDir);

  console.log(`\nSeeding ${yamlFiles.length} victims...`);

  let created = 0, skipped = 0, errors = 0;

  for (const filePath of yamlFiles) {
    const v = readYaml(filePath);
    if (!v || !v.id) {
      skipped++;
      continue;
    }

    // Find related event
    const eventSlug = guessEventSlug(v);
    let eventId: string | null = null;
    if (eventSlug) {
      const event = await prisma.event.findUnique({ where: { slug: eventSlug } });
      if (event) eventId = event.id;
    }

    try {
    const victimData = {
      slug: v.id,
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
      occupationFa: null,
      education: v.education || null,
      familyInfo: v.family || null,
      dreamsEn: typeof v.dreams === "string" ? v.dreams.trim() : null,
      dreamsFa: null,
      beliefsEn: typeof v.beliefs === "string" ? v.beliefs.trim() : null,
      beliefsFa: null,
      personalityEn: typeof v.personality === "string" ? v.personality.trim() : null,
      personalityFa: null,
      quotes: v.quotes || [],
      dateOfDeath: v.date_of_death ? new Date(v.date_of_death) : null,
      ageAtDeath: v.age_at_death || null,
      placeOfDeath: v.place_of_death || null,
      province: v.province || null,
      causeOfDeath: v.cause_of_death || null,
      circumstancesEn: typeof v.circumstances === "string" ? v.circumstances.trim() : null,
      circumstancesFa: null,
      eventId,
      eventContext: typeof v.event_context === "string" ? v.event_context.trim() : null,
      responsibleForces: typeof v.responsible_forces === "string" ? v.responsible_forces.trim() : null,
      witnesses: Array.isArray(v.witnesses) ? v.witnesses : [],
      lastSeen: typeof v.last_seen === "string" ? v.last_seen.trim() : null,
      burialLocation: v.burial?.location || null,
      burialDate: v.burial?.date ? new Date(v.burial.date) : null,
      burialCircumstancesEn: typeof v.burial?.circumstances === "string" ? v.burial.circumstances.trim() : null,
      burialCircumstancesFa: null,
      graveStatus: typeof v.burial?.grave_status === "string" ? v.burial.grave_status.trim() : null,
      familyPersecutionEn: typeof v.family_persecution === "string" ? v.family_persecution.trim() : null,
      familyPersecutionFa: null,
      legalProceedings: typeof v.legal_proceedings === "string" ? v.legal_proceedings.trim() : null,
      tributes: v.tributes || [],
      verificationStatus: v.status || "unverified",
      dataSource: typeof v.updated_by === "string" ? v.updated_by.trim() : null,
      notes: typeof v.notes === "string" ? v.notes.trim() : null,
    };
    const victim = await prisma.victim.upsert({
      where: { slug: v.id },
      update: victimData,
      create: victimData,
    });

    // Seed sources (delete existing first to prevent duplicates on re-seed)
    await prisma.source.deleteMany({ where: { victimId: victim.id } });
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
    if (created % 500 === 0) console.log(`  [${created}/${yamlFiles.length}] ${v.name_latin || v.id}`);
    } catch (e: any) {
      errors++;
      console.log(`  ✗ ${filePath}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`\n  Created/updated: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
}

async function main() {
  console.log("🕯 Iran Memorial — Database Seed\n");

  await seedEvents();
  await seedVictims();

  console.log("\n✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
