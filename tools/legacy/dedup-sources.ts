/**
 * dedup-sources.ts — Remove duplicate source entries from the database
 *
 * The seed script creates new source rows on every run without deleting existing ones,
 * resulting in ~221K duplicate entries. This script keeps only the earliest source
 * for each (victim_id, name, url) combination and deletes the rest.
 *
 * Usage:
 *   npx tsx tools/dedup-sources.ts           # Execute deduplication
 *   npx tsx tools/dedup-sources.ts --dry-run  # Preview without deleting
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`🗑  Source Deduplication${dryRun ? " (DRY RUN)" : ""}\n`);

  // Get current counts
  const totalBefore = await prisma.source.count();
  console.log(`Total sources before: ${totalBefore.toLocaleString()}`);

  // Find duplicates: for each (victim_id, name, url) group, get all IDs except the first
  const duplicateIds: string[] = await prisma.$queryRaw<{ id: string }[]>`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY victim_id, name, COALESCE(url, '')
               ORDER BY created_at ASC, id ASC
             ) AS rn
      FROM sources
    )
    SELECT id FROM ranked WHERE rn > 1
  `.then((rows) => rows.map((r) => r.id));

  console.log(`Duplicate sources found: ${duplicateIds.length.toLocaleString()}`);

  if (duplicateIds.length === 0) {
    console.log("\n✓ No duplicates found. Database is clean.");
    return;
  }

  if (dryRun) {
    // Show some stats
    const uniqueCount = totalBefore - duplicateIds.length;
    console.log(`\nWould keep: ${uniqueCount.toLocaleString()}`);
    console.log(`Would delete: ${duplicateIds.length.toLocaleString()}`);
    console.log("\nRe-run without --dry-run to execute.");
    return;
  }

  // Delete in batches of 5000 to avoid memory issues
  const BATCH_SIZE = 5000;
  let deleted = 0;

  for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
    const batch = duplicateIds.slice(i, i + BATCH_SIZE);
    const result = await prisma.source.deleteMany({
      where: { id: { in: batch } },
    });
    deleted += result.count;
    if ((i / BATCH_SIZE) % 10 === 0 || i + BATCH_SIZE >= duplicateIds.length) {
      console.log(`  Deleted ${deleted.toLocaleString()} / ${duplicateIds.length.toLocaleString()}`);
    }
  }

  const totalAfter = await prisma.source.count();
  console.log(`\n✓ Deduplication complete.`);
  console.log(`  Before: ${totalBefore.toLocaleString()}`);
  console.log(`  Deleted: ${deleted.toLocaleString()}`);
  console.log(`  After: ${totalAfter.toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error("Dedup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
