/**
 * Update German translations for events in the database.
 * Reads title_de and description_de from timeline.yaml and updates the DB.
 *
 * Usage: npx tsx tools/update-events-de.ts
 * Requires: DATABASE_URL env var or SSH tunnel to server DB
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const yamlPath = join(process.cwd(), "data", "events", "timeline.yaml");
  const raw = readFileSync(yamlPath, "utf-8");
  const events = parse(raw) as Array<{
    id: string;
    title_de?: string;
    description_de?: string;
  }>;

  let updated = 0;
  let skipped = 0;

  for (const e of events) {
    if (!e.title_de && !e.description_de) {
      console.log(`  ⏭ ${e.id} — no German content`);
      skipped++;
      continue;
    }

    await prisma.event.update({
      where: { slug: e.id },
      data: {
        titleDe: e.title_de || undefined,
        descriptionDe: e.description_de?.trim() || undefined,
      },
    });

    console.log(`  ✓ ${e.id} — titleDe: ${e.title_de ? "yes" : "no"}, descriptionDe: ${e.description_de ? "yes" : "no"}`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
