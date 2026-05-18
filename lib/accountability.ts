/** Slug ↔ display-name mapping for /accountability/[slug]. Stable, reversible. */
export function partySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/** Reverse-lookup: given a slug, find the matching court/judge in the
 *  aggregates. Returns the canonical display name. Falls back to a
 *  static judge profile (e.g. 1988 Death Commission members who don't
 *  appear in per-victim attribution but have hand-curated profiles). */
export function findPartyBySlug(
  slug: string,
  aggregates: { courts: { name: string; count: number }[]; judges: { name: string; count: number }[] },
): { name: string; kind: "court" | "judge" } | null {
  for (const c of aggregates.courts) {
    if (partySlug(c.name) === slug) return { name: c.name, kind: "court" };
  }
  for (const j of aggregates.judges) {
    if (partySlug(j.name) === slug) return { name: j.name, kind: "judge" };
  }
  // Static-profile fallback (Death Commission etc.)
  const profile = STATIC_JUDGE_LOOKUP[slug];
  if (profile) return { name: profile, kind: "judge" };
  return null;
}

// Lazy import-free static map — kept in sync with HISTORICAL_PERPETRATOR_SLUGS.
const STATIC_JUDGE_LOOKUP: Record<string, string> = {
  "hossein-ali-nayeri": "Hossein-Ali Nayeri",
  "ebrahim-raisi": "Ebrahim Raisi",
  "mostafa-pourmohammadi": "Mostafa Pourmohammadi",
  "morteza-eshraghi": "Morteza Eshraghi",
};
