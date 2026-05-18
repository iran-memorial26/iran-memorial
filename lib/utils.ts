import type { Locale } from "@/i18n/config";

export function formatDate(date: Date | string | null, locale: Locale): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;

  const localeMap: Record<Locale, string> = {
    fa: "fa-IR",
    en: "en-US",
    de: "de-DE",
    ar: "ar-SA",
    fr: "fr-FR",
    it: "it-IT",
    es: "es-ES",
    he: "he-IL",
    ru: "ru-RU",
    tr: "tr-TR",
    ckb: "ckb-IR",
    hi: "hi-IN",
    ur: "ur-PK",
    sv: "sv-SE",
    nl: "nl-NL",
    zh: "zh-CN",
  };

  return d.toLocaleDateString(localeMap[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateRange(
  start: Date | string | null,
  end: Date | string | null,
  locale: Locale
): string {
  const s = formatDate(start, locale);
  const e = formatDate(end, locale);
  if (!s) return "";
  if (!e || !start || !end) return s;
  // Single-day event (start == end): show only one date, not "12. Sep – 12. Sep".
  // Compare by ISO date portion to ignore any time component drift.
  const isoStart = new Date(start).toISOString().slice(0, 10);
  const isoEnd = new Date(end).toISOString().slice(0, 10);
  if (isoStart === isoEnd) return s;
  return `${s} – ${e}`;
}

export function formatNumber(n: number | null, locale: Locale): string {
  if (n === null) return "";
  const localeMap: Record<Locale, string> = {
    fa: "fa-IR",
    en: "en-US",
    de: "de-DE",
    ar: "ar-SA",
    fr: "fr-FR",
    it: "it-IT",
    es: "es-ES",
    he: "he-IL",
    ru: "ru-RU",
    tr: "tr-TR",
    ckb: "ckb-IR",
    hi: "hi-IN",
    ur: "ur-PK",
    sv: "sv-SE",
    nl: "nl-NL",
    zh: "zh-CN",
  };
  return n.toLocaleString(localeMap[locale]);
}

export function formatKilledRange(
  low: number | null | undefined,
  high: number | null | undefined,
  locale: Locale
): string {
  if (high) return formatNumber(high, locale);
  if (low) return formatNumber(low, locale);
  return "";
}
