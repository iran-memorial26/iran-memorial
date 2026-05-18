import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";

export interface BreadcrumbItem {
  /** Visible label in the current locale. */
  label: string;
  /** Internal path (next-intl Link prepends the locale). Omit for the
   *  current page — that crumb is rendered as plain text, not a link. */
  href?: string;
}

const HOME_LABEL: Record<string, string> = {
  en: "Home",
  de: "Start",
  fa: "خانه",
  ar: "الرئيسية",
  fr: "Accueil",
  it: "Inizio",
  es: "Inicio",
  he: "דף הבית",
  ru: "Главная",
  tr: "Ana sayfa",
  ckb: "ماڵەوە",
  hi: "मुख्य पृष्ठ",
  ur: "صفحہ اول",
  sv: "Hem",
  nl: "Start",
  zh: "首页",
};

/**
 * JSON for safe injection inside <script>. Escapes the < and > that
 * JSON.stringify leaves untouched, plus & and the Unicode line/paragraph
 * separators that some parsers mishandle. Without this, a </script> in
 * user-controlled data could break out of the script tag.
 */
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

/**
 * Wayfinding crumbs for detail pages. Always begins with Home (locale-localized),
 * followed by caller-supplied items. The last item is always treated as the
 * current page even if href is provided.
 *
 * Also emits schema.org BreadcrumbList JSON-LD so Google can render the trail
 * inline in SERPs (replaces the URL with a crumb list).
 */
export function Breadcrumbs({
  items,
  locale,
}: {
  items: BreadcrumbItem[];
  locale: Locale;
}) {
  const homeLabel = HOME_LABEL[locale] || HOME_LABEL.en;
  const trail: BreadcrumbItem[] = [{ label: homeLabel, href: "/" }, ...items];

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => {
      const isLast = i === trail.length - 1;
      const entry: Record<string, unknown> = {
        "@type": "ListItem",
        position: i + 1,
        name: c.label,
      };
      if (!isLast && c.href) {
        entry.item = `${siteBase}/${locale}${c.href === "/" ? "" : c.href}`;
      }
      return entry;
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-xs sm:text-sm text-memorial-500"
      >
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {trail.map((c, i) => {
            const isLast = i === trail.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="flex items-center gap-2">
                {isLast || !c.href ? (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className="text-memorial-300 truncate max-w-[14rem] sm:max-w-[24rem]"
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.href}
                    className="hover:text-memorial-200 transition-colors"
                  >
                    {c.label}
                  </Link>
                )}
                {!isLast && (
                  <span aria-hidden className="text-memorial-700">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
