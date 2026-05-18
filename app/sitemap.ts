import { prisma } from "@/lib/db";
import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
const VICTIMS_PER_SITEMAP = 40000; // Google caps at 50K, 10K margin

export const revalidate = 86400;

const STATIC_PAGES = [
  "",
  "/victims",
  "/events",
  "/executions",
  "/death-row",
  "/imprisoned",
  "/accountability",
  "/anonymous-victims",
  "/sources",
  "/timeline",
  "/map",
  "/statistics",
  "/developers",
  "/methodology",
  "/embed-preview",
  "/about",
  "/submit",
];

// Generate one sitemap per "shard": id=0 is the static+events index, id>=1 are victim chunks.
// `generateSitemaps()` is invoked at build time, where the DB may be unreachable —
// fall back to a fixed, generous shard count so the build never breaks. Empty
// shards return an empty entry list at request time.
export async function generateSitemaps() {
  let victimShards = 3; // ~120K victim URLs of headroom — well above current 32K
  try {
    const total = await prisma.victim.count();
    victimShards = Math.max(1, Math.ceil(total / VICTIMS_PER_SITEMAP));
  } catch {
    // DB unavailable (build time, no DATABASE_URL) — keep the default
  }
  return Array.from({ length: victimShards + 1 }, (_, i) => ({ id: i }));
}

export default async function sitemap({ id }: { id: number | string }): Promise<MetadataRoute.Sitemap> {
  // Defensive cast: Next can pass `id` as a string from the URL param. Out-of-range
  // or non-numeric values return an empty sitemap rather than triggering Prisma
  // with skip=NaN (latent bug surfaced when ISR tried to prerender shards).
  const shardId = Number(id);
  if (!Number.isInteger(shardId) || shardId < 0) {
    return [];
  }

  if (shardId === 0) {
    const events = await prisma.event.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const entries: MetadataRoute.Sitemap = [];
    const now = new Date();
    for (const locale of locales) {
      for (const page of STATIC_PAGES) {
        entries.push({
          url: `${BASE_URL}/${locale}${page}`,
          lastModified: now,
          changeFrequency:
            page === "" ? "daily" : page === "/developers" ? "weekly" : "weekly",
          priority:
            page === "" ? 1.0 : page === "/developers" ? 0.7 : 0.8,
        });
      }
    }
    for (const event of events) {
      for (const locale of locales) {
        entries.push({
          url: `${BASE_URL}/${locale}/events/${event.slug}`,
          lastModified: event.updatedAt,
          changeFrequency: "monthly",
          priority: 0.8,
        });
      }
    }

    // Dataset distribution endpoints (referenced from Dataset JSON-LD on /developers).
    // These are crawlable JSON resources; Google Dataset Search and other consumers
    // rely on them being discoverable from the sitemap.
    entries.push({
      url: `${BASE_URL}/api/v1/victims`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
    entries.push({
      url: `${BASE_URL}/api/v1/public/dump`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });

    return entries;
  }

  // Victim shard: id=1 → first chunk, id=2 → second chunk, etc.
  const shardIndex = shardId - 1;
  const victims = await prisma.victim.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { id: "asc" }, // stable ordering across shards
    skip: shardIndex * VICTIMS_PER_SITEMAP,
    take: VICTIMS_PER_SITEMAP,
  });

  const entries: MetadataRoute.Sitemap = [];
  for (const victim of victims) {
    // Emit canonical (English) URL; hreflang alternates declared per page.
    entries.push({
      url: `${BASE_URL}/en/victims/${victim.slug}`,
      lastModified: victim.updatedAt,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${BASE_URL}/${l}/victims/${victim.slug}`]),
        ),
      },
    });
  }
  return entries;
}
