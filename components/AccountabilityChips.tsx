import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";
import { partySlug } from "@/lib/accountability";

const SECTION_LABEL: Record<string, string> = {
  en: "Linked profiles",
  de: "Verknüpfte Profile",
  fa: "پروفایل‌های مرتبط",
  ar: "ملفات مرتبطة",
  fr: "Profils liés",
  it: "Profili collegati",
  es: "Perfiles vinculados",
  he: "פרופילים מקושרים",
  ru: "Связанные профили",
  tr: "Bağlantılı profiller",
  ckb: "پرۆفایلە پەیوەندیدارەکان",
  hi: "जुड़े प्रोफ़ाइल",
  ur: "منسلک پروفائلز",
  sv: "Länkade profiler",
  nl: "Gekoppelde profielen",
  zh: "相关档案",
};

/**
 * Extract structured perpetrator references from the free-text
 * responsible_forces field. Returns each unique reference with its
 * computed slug; the caller filters to those that actually have a
 * matching /accountability/<slug> page.
 *
 * Recognizes:
 *   - "Judge <Firstname Lastname>"            → kind: judge
 *   - "Branch N of <X> Revolutionary Court"   → kind: court
 *   - "<X> Revolutionary Court (of Y)?"       → kind: court (fallback)
 *
 * Stops at the first sentence-terminating punctuation per match so
 * "Judge Salavati; Judge Mortazavi" yields two entries, not one.
 */
export function extractPerpetrators(
  rf: string | null | undefined
): Array<{ name: string; slug: string; kind: "judge" | "court" }> {
  if (!rf) return [];
  const out = new Map<string, { name: string; slug: string; kind: "judge" | "court" }>();

  // Match all "Judge <Name>" occurrences. The name part stops at ),;,. or EOL.
  for (const m of rf.matchAll(/Judge\s+([A-Z][\w'\- ]+?)(?=\s*[\)\];,.]|$)/g)) {
    const tokens = m[1].trim().split(/\s+/);
    // Often-cited form is just the surname (last token). Use that as the
    // canonical slug input — matches /accountability/[slug] convention.
    const surname = tokens[tokens.length - 1];
    const slug = partySlug(surname);
    if (slug && !out.has(slug)) {
      out.set(slug, { name: `Judge ${tokens.join(" ")}`, slug, kind: "judge" });
    }
  }

  // Match "Branch N of <City> Revolutionary Court" or "<City> Revolutionary Court".
  for (const m of rf.matchAll(
    /((?:Branch\s+\d+\s+of\s+)?(?:Islamic\s+)?[A-Z][\w' ]+?\s+Revolutionary\s+Court(?:\s+of\s+[A-Z][\w' ]+)?)/g
  )) {
    const name = m[1].trim();
    const slug = partySlug(name);
    if (slug && !out.has(slug)) {
      out.set(slug, { name, slug, kind: "court" });
    }
  }

  return Array.from(out.values());
}

/**
 * Accountability chip row — rendered under the Death section's
 * `Responsible forces` free text. Each chip links to /accountability/<slug>
 * if a profile exists; otherwise the chip is suppressed (no dead links).
 * The free text above the chips is the canonical record; chips are pure
 * affordance. Renders nothing when no recognized profile is linked.
 */
export function AccountabilityChips({
  responsibleForces,
  knownSlugs,
  locale,
}: {
  responsibleForces: string | null | undefined;
  /** Slugs that have a real /accountability/<slug> page (from aggregates).
   *  Pre-computed at page level so the component stays a server component
   *  without its own DB roundtrip. */
  knownSlugs: Set<string>;
  locale: Locale;
}) {
  const extracted = extractPerpetrators(responsibleForces);
  const linked = extracted.filter((e) => knownSlugs.has(e.slug));
  if (linked.length === 0) return null;

  const title = SECTION_LABEL[locale] || SECTION_LABEL.en;

  return (
    <div className="mt-3">
      <h3 className="text-xs font-medium text-memorial-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {linked.map((p) => (
          <Link
            key={p.slug}
            href={`/accountability/${p.slug}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-memorial-800 bg-memorial-900/40 text-memorial-300 hover:border-gold-500/30 hover:bg-memorial-800/60 hover:text-gold-400 transition-colors"
          >
            <span aria-hidden>{p.kind === "judge" ? "👤" : "⚖"}</span>
            <span>{p.name}</span>
            <span className="text-memorial-500" aria-hidden>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
