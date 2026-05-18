/** Shared feed-builder helpers for /feed.xml (RSS 2.0) and /feed.json (JSON Feed 1.1). */
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site-url";

export const BASE_URL = SITE_URL;
export const FEED_LIMIT = 50;

export interface FeedItem {
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: Date | null;
  placeOfDeath: string | null;
  causeOfDeath: string | null;
  circumstancesEn: string | null;
  photoUrl: string | null;
  verificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function loadFeedItems(): Promise<FeedItem[]> {
  return prisma.victim.findMany({
    select: {
      slug: true,
      nameLatin: true,
      nameFarsi: true,
      dateOfDeath: true,
      placeOfDeath: true,
      causeOfDeath: true,
      circumstancesEn: true,
      photoUrl: true,
      verificationStatus: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: FEED_LIMIT,
  });
}

/** XML-escape user-supplied content. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build a one-paragraph English description for an item. */
export function buildDescription(item: FeedItem): string {
  const parts: string[] = [];
  if (item.dateOfDeath) {
    const d = item.dateOfDeath.toISOString().split("T")[0];
    parts.push(`Date of death: ${d}`);
  }
  if (item.placeOfDeath) parts.push(`Place: ${item.placeOfDeath}`);
  if (item.causeOfDeath) parts.push(`Cause: ${item.causeOfDeath}`);
  if (item.verificationStatus === "verified") parts.push("Status: Verified");
  const meta = parts.join(" · ");
  const body = item.circumstancesEn?.slice(0, 400) ?? "";
  return body ? `${meta}\n\n${body}` : meta || `Memorial entry for ${item.nameLatin}`;
}

export function itemUrl(slug: string): string {
  return `${BASE_URL}/en/victims/${slug}`;
}

export function itemTitle(item: FeedItem): string {
  return item.nameFarsi ? `${item.nameLatin} — ${item.nameFarsi}` : item.nameLatin;
}
