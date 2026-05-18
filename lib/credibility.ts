/**
 * Source credibility tiers — drives the trust badges on victim profiles
 * and the "Verification Methodology" page.
 *
 * Tiers map to the DB enum SourceCredibility (HIGH / MEDIUM / LOW / UNVERIFIED)
 * but collapse them into 3 user-facing buckets that mirror Wikipedia's
 * reliability framing: high / reputable / community.
 */

export type CredibilityTier = "high" | "reputable" | "community" | "unknown";

export interface CredibilityBadge {
  tier: CredibilityTier;
  /** i18n key under `credibility.{tier}_label` */
  labelKey: string;
  /** Emoji glyph for the badge */
  icon: string;
  /** Tailwind color classes for the chip */
  className: string;
}

export const TIER_BADGE: Record<CredibilityTier, CredibilityBadge> = {
  high: {
    tier: "high",
    labelKey: "high_label",
    icon: "●",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  reputable: {
    tier: "reputable",
    labelKey: "reputable_label",
    icon: "●",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  community: {
    tier: "community",
    labelKey: "community_label",
    icon: "○",
    className: "bg-memorial-700/40 text-memorial-300 border-memorial-600/40",
  },
  unknown: {
    tier: "unknown",
    labelKey: "unknown_label",
    icon: "○",
    className: "bg-memorial-800/40 text-memorial-400 border-memorial-700/40",
  },
};

/** Map DB SourceCredibility enum value → tier */
function mapDbCredibility(c: string | null | undefined): CredibilityTier | null {
  switch (c) {
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "reputable";
    case "LOW":
    case "UNVERIFIED":
      return "community";
    default:
      return null;
  }
}

/**
 * URL-pattern fallback for Source rows without a `dataSourceId` FK
 * (most pre-2026-Q1 imports). Keep substrings — the Source URL may
 * include locale prefixes, query params, etc.
 */
const URL_TIER_PATTERNS: Array<[RegExp, CredibilityTier]> = [
  // HIGH — established human-rights NGOs + UN bodies
  [/amnesty\.org/i, "high"],
  [/iranrights\.org/i, "high"], // Boroumand Center
  [/iranhr\.net/i, "high"], // IHR
  [/hra-news\.org/i, "high"], // HRANA
  [/hraney\.net/i, "high"],
  [/ohchr\.org/i, "high"], // UN OHCHR
  [/un\.org\/.*iran/i, "high"],
  [/hrw\.org/i, "high"], // Human Rights Watch
  [/justice4iran\.org/i, "high"],

  // REPUTABLE — established media + memorial projects
  [/iranintl\.com/i, "reputable"],
  [/iranwire\.com/i, "reputable"],
  [/radiofarda\.com/i, "reputable"],
  [/bbc\.(com|co\.uk)\/.*persian/i, "reputable"],
  [/dw\.com/i, "reputable"],
  [/voanews\.com/i, "reputable"],
  [/rferl\.org/i, "reputable"],
  [/reuters\.com/i, "reputable"],
  [/(en|fa|de)\.wikipedia\.org/i, "reputable"],
  [/iranvictims\.(com|org)/i, "reputable"],
  [/iranrevolution\.(org|online)/i, "reputable"],
  [/iran-monitor/i, "reputable"],

  // COMMUNITY — open submissions + social media
  [/witness\.report/i, "community"],
  [/hengaw\.net/i, "community"],
  [/t\.me\//i, "community"],
  [/telegram\.(me|org)/i, "community"],
  [/twitter\.com|x\.com/i, "community"],
  [/instagram\.com/i, "community"],
];

/** Source-row shape we accept (matches Prisma include with dataSource). */
export interface SourceLike {
  url?: string | null;
  name?: string | null;
  dataSource?: { credibility?: string | null } | null;
}

/** Resolve a single source's credibility tier. */
export function tierForSource(s: SourceLike): CredibilityTier {
  // 1) Trust the DB FK first
  const dbTier = mapDbCredibility(s.dataSource?.credibility);
  if (dbTier) return dbTier;

  // 2) URL pattern fallback
  const haystack = `${s.url ?? ""} ${s.name ?? ""}`;
  for (const [re, tier] of URL_TIER_PATTERNS) {
    if (re.test(haystack)) return tier;
  }

  return "unknown";
}

/** Convenience: get the badge config for a source. */
export function badgeForSource(s: SourceLike): CredibilityBadge {
  return TIER_BADGE[tierForSource(s)];
}
