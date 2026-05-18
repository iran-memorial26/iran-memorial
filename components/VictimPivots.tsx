import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";

const SECTION_TITLE: Record<string, string> = {
  en: "Explore similar cases",
  de: "Ähnliche Fälle erkunden",
  fa: "موارد مشابه را کاوش کنید",
  ar: "استكشاف حالات مماثلة",
  fr: "Explorer des cas similaires",
  it: "Esplora casi simili",
  es: "Explorar casos similares",
  he: "סקור מקרים דומים",
  ru: "Изучить похожие случаи",
  tr: "Benzer vakaları keşfet",
  ckb: "حاڵەتە هاوشێوەکان بگەڕێ",
  hi: "इसी तरह के मामले देखें",
  ur: "اسی طرح کے واقعات دیکھیں",
  sv: "Utforska liknande fall",
  nl: "Vergelijkbare gevallen verkennen",
  zh: "探索类似案例",
};

const IN_PROVINCE: Record<string, (name: string) => string> = {
  en: (n) => `More victims in ${n}`,
  de: (n) => `Weitere Opfer in ${n}`,
  fa: (n) => `قربانیان دیگر در ${n}`,
  ar: (n) => `ضحايا آخرون في ${n}`,
  fr: (n) => `Autres victimes à ${n}`,
  it: (n) => `Altre vittime a ${n}`,
  es: (n) => `Más víctimas en ${n}`,
};

const IN_YEAR: Record<string, (y: number) => string> = {
  en: (y) => `Other ${y} cases`,
  de: (y) => `Weitere Fälle aus ${y}`,
  fa: (y) => `موارد دیگر ${y}`,
  ar: (y) => `حالات أخرى في ${y}`,
  fr: (y) => `Autres cas de ${y}`,
  it: (y) => `Altri casi del ${y}`,
  es: (y) => `Otros casos de ${y}`,
};

const YEAR_CASETYPE: Record<string, Record<string, (y: number) => string>> = {
  en: {
    execution: (y) => `Other ${y} executions`,
    death_in_custody: (y) => `Other ${y} custody deaths`,
    killed: (y) => `Other ${y} shootings`,
  },
  de: {
    execution: (y) => `Weitere Hinrichtungen ${y}`,
    death_in_custody: (y) => `Weitere Tode in Haft ${y}`,
    killed: (y) => `Weitere Erschossene ${y}`,
  },
  fa: {
    execution: (y) => `سایر اعدام‌های ${y}`,
    death_in_custody: (y) => `سایر مرگ‌های در بازداشت ${y}`,
    killed: (y) => `سایر تیراندازی‌های ${y}`,
  },
};

function pickProvinceName(
  p: { nameEn: string | null; nameFa: string | null; nameDe: string | null },
  locale: Locale
): string {
  if (locale === "fa" && p.nameFa) return p.nameFa;
  if (locale === "de" && p.nameDe) return p.nameDe;
  return p.nameEn || "";
}

export interface PivotData {
  province: {
    slug: string;
    nameEn: string | null;
    nameFa: string | null;
    nameDe: string | null;
    count: number;
  } | null;
  year: { year: number; count: number } | null;
  yearCaseType: { year: number; caseType: string; count: number } | null;
}

/**
 * "Explore similar cases" pivot strip on a victim detail page. Each chip is a
 * Link with a count badge; clicking lands on a pre-filtered /victims grid.
 * Renders nothing when no meaningful pivots exist (no city + no death date).
 */
export function VictimPivots({
  pivots,
  locale,
  numberFormatLocale,
}: {
  pivots: PivotData;
  locale: Locale;
  /** Locale string for Intl.NumberFormat — fa-IR for Persian etc. */
  numberFormatLocale: string;
}) {
  if (!pivots.province && !pivots.year && !pivots.yearCaseType) return null;

  const fmt = new Intl.NumberFormat(numberFormatLocale);
  const title = SECTION_TITLE[locale] || SECTION_TITLE.en;
  const inProvince = IN_PROVINCE[locale] || IN_PROVINCE.en;
  const inYear = IN_YEAR[locale] || IN_YEAR.en;
  const yearCaseLabels = YEAR_CASETYPE[locale] || YEAR_CASETYPE.en;

  const chipBase =
    "inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-memorial-800 bg-memorial-900/40 text-memorial-300 hover:border-gold-500/30 hover:bg-memorial-800/60 hover:text-memorial-100 transition-colors";
  const countBase =
    "text-xs tabular-nums text-memorial-500";

  return (
    <section className="mt-10 border-t border-memorial-800/60 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-memorial-400 mb-3">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {pivots.province && (
          <Link
            href={`/victims?province=${encodeURIComponent(pivots.province.slug)}`}
            className={chipBase}
          >
            <span>📍</span>
            <span>{inProvince(pickProvinceName(pivots.province, locale))}</span>
            <span className={countBase}>{fmt.format(pivots.province.count)}</span>
          </Link>
        )}
        {pivots.year && (
          <Link
            href={`/victims?year=${pivots.year.year}`}
            className={chipBase}
          >
            <span>📅</span>
            <span>{inYear(pivots.year.year)}</span>
            <span className={countBase}>{fmt.format(pivots.year.count)}</span>
          </Link>
        )}
        {pivots.yearCaseType && (
          <Link
            href={`/victims?year=${pivots.yearCaseType.year}&caseType=${pivots.yearCaseType.caseType}`}
            className={chipBase}
          >
            <span>⚖</span>
            <span>
              {(yearCaseLabels[pivots.yearCaseType.caseType] ?? inYear)(
                pivots.yearCaseType.year
              )}
            </span>
            <span className={countBase}>{fmt.format(pivots.yearCaseType.count)}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
