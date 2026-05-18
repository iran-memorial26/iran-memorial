import type { Locale } from "@/i18n/config";

const SOURCES_LABEL: Record<string, (n: number) => string> = {
  en: (n) => (n === 1 ? "1 source" : `${n} sources`),
  de: (n) => (n === 1 ? "1 Quelle" : `${n} Quellen`),
  fa: (n) => `${n} منبع`,
  ar: (n) => `${n} مصدر`,
  fr: (n) => (n === 1 ? "1 source" : `${n} sources`),
  it: (n) => (n === 1 ? "1 fonte" : `${n} fonti`),
  es: (n) => (n === 1 ? "1 fuente" : `${n} fuentes`),
  he: (n) => `${n} מקורות`,
  ru: (n) => `${n} источников`,
  tr: (n) => `${n} kaynak`,
  ckb: (n) => `${n} سەرچاوە`,
  hi: (n) => `${n} स्रोत`,
  ur: (n) => `${n} ذرائع`,
  sv: (n) => (n === 1 ? "1 källa" : `${n} källor`),
  nl: (n) => (n === 1 ? "1 bron" : `${n} bronnen`),
  zh: (n) => `${n} 个来源`,
};

/**
 * Inline citation chip — superscript numbered references like Wikipedia.
 * Each [N] anchor scrolls to the corresponding source-N in the bibliography
 * at the bottom of the page. Honest about scope: claims the WHOLE page is
 * backed by these N sources, not per-fact attribution (which would require
 * schema work to attach source IDs per Victim field).
 *
 * Renders nothing if count < 1 — pages without sources don't get the chip.
 */
export function CiteRefs({
  count,
  locale,
}: {
  /** Total number of sources on the page (used to number [1]..[N]). */
  count: number;
  locale: Locale;
}) {
  if (!count || count < 1) return null;

  // Cap visible [1][2]... refs to 8 to avoid a row of 20+ tiny chips.
  // The "N sources →" tail link still scrolls to the bibliography.
  const visible = Math.min(count, 8);
  const sourceLabel = (SOURCES_LABEL[locale] || SOURCES_LABEL.en)(count);
  const refs: number[] = Array.from({ length: visible }, (_, i) => i + 1);

  return (
    <nav
      aria-label="Citations"
      className="inline-flex items-center gap-1 flex-wrap align-middle text-xs"
    >
      {refs.map((n) => (
        <a
          key={n}
          href={`#source-${n}`}
          className="inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1 rounded border border-memorial-700 bg-memorial-900/60 text-memorial-300 hover:bg-memorial-800 hover:text-gold-400 hover:border-gold-500/40 transition-colors tabular-nums"
          title={`Source ${n}`}
        >
          {n}
        </a>
      ))}
      {count > visible && (
        <a
          href="#sources"
          className="inline-flex items-center px-1.5 h-5 text-memorial-400 hover:text-gold-400"
        >
          +{count - visible}
        </a>
      )}
      <a
        href="#sources"
        className="ms-1 text-memorial-500 hover:text-memorial-200 underline-offset-2 hover:underline"
      >
        {sourceLabel} →
      </a>
    </nav>
  );
}
