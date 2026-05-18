#!/usr/bin/env tsx
/** Bulk reindex all victims from Postgres → Meilisearch.
 *
 *  Usage:
 *    npx tsx scripts/meili-reindex.ts             # full reindex
 *    npx tsx scripts/meili-reindex.ts --since 1h  # incremental (updatedAt window)
 *
 *  Pre-req env: DATABASE_URL, MEILI_HOST, MEILI_MASTER_KEY.
 *  Run after every enricher batch to push new victims into search.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { ensureVictimsIndex, getVictimsIndex, type VictimDoc } from "../lib/meili";

const BATCH_SIZE = 1000;

function parseSince(arg: string): Date {
  const m = arg.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Invalid --since: ${arg} (expected like "1h", "30m", "2d")`);
  const n = Number(m[1]);
  const unit = m[2];
  const ms = unit === "s" ? n * 1000 : unit === "m" ? n * 60_000 : unit === "h" ? n * 3_600_000 : n * 86_400_000;
  return new Date(Date.now() - ms);
}

function toEpoch(d: Date | null): number | null {
  return d ? Math.floor(d.getTime() / 1000) : null;
}

async function main() {
  const args = process.argv.slice(2);
  const sinceArg = args[args.indexOf("--since") + 1];
  const since = args.includes("--since") && sinceArg ? parseSince(sinceArg) : null;

  console.log("[meili-reindex] Ensuring index schema...");
  await ensureVictimsIndex();
  const index = getVictimsIndex();
  if (!index) throw new Error("Meili client not configured");

  const baseWhere: Prisma.VictimWhereInput = since ? { updatedAt: { gte: since } } : {};
  const total = await prisma.victim.count({ where: baseWhere });
  console.log(`[meili-reindex] Indexing ${total} victims${since ? ` since ${since.toISOString()}` : " (full reindex)"}`);

  let processed = 0;
  let lastId: string | undefined = undefined;

  while (processed < total) {
    const where: Prisma.VictimWhereInput = lastId
      ? { ...baseWhere, id: { gt: lastId } }
      : baseWhere;
    const rows = await prisma.victim.findMany({
      where,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      select: {
        id: true,
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        aliases: true,
        occupationEn: true,
        occupationFa: true,
        occupationDe: true,
        placeOfDeath: true,
        causeOfDeath: true,
        dateOfDeath: true,
        dateOfBirth: true,
        verificationStatus: true,
        photoUrl: true,
        city: { select: { nameEn: true, nameFa: true, nameDe: true } },
      },
    });

    if (rows.length === 0) break;

    const docs: VictimDoc[] = rows.map((v) => ({
      id: v.id,
      slug: v.slug,
      nameLatin: v.nameLatin,
      nameFarsi: v.nameFarsi,
      aliases: v.aliases ?? [],
      occupationEn: v.occupationEn,
      occupationFa: v.occupationFa,
      occupationDe: v.occupationDe,
      placeOfDeath: v.placeOfDeath,
      cityNameEn: v.city?.nameEn ?? null,
      cityNameFa: v.city?.nameFa ?? null,
      cityNameDe: v.city?.nameDe ?? null,
      causeOfDeath: v.causeOfDeath,
      dateOfDeath: toEpoch(v.dateOfDeath),
      dateOfBirth: toEpoch(v.dateOfBirth),
      verificationStatus: v.verificationStatus ?? "unverified",
      hasPhoto: !!v.photoUrl,
    }));

    await index.addDocuments(docs, { primaryKey: "id" });
    processed += rows.length;
    lastId = rows[rows.length - 1]!.id;
    process.stdout.write(`\r[meili-reindex] ${processed}/${total} (id<=${lastId})  `);
  }

  process.stdout.write("\n[meili-reindex] Waiting for Meili to apply...\n");
  // Trigger a final settings update + give Meili time to flush the queue
  await ensureVictimsIndex();
  console.log("[meili-reindex] Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[meili-reindex] Failed:", err);
  process.exit(1);
});
