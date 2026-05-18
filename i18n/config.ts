export const locales = [
  "fa", "en", "de", "ar", "fr", "it", "es",
  // 2026-05-11: broadened reach — Hebrew (Israeli + Iranian-Jewish diaspora),
  // Russian (ex-USSR + Israeli-Russian community), Turkish (Iran-Turkey
  // corridor + Azeri minority inside Iran), Sorani Kurdish (Hengaw victim
  // archive), Hindi + Urdu (UAE expat communities + South Asia), Swedish
  // (largest Iranian refugee community in Europe), Dutch (NL community),
  // Simplified Chinese (global reach).
  "he", "ru", "tr", "ckb", "hi", "ur", "sv", "nl", "zh",
] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Native language name. Used in contexts where users see a full label,
 *  e.g. metadata. The compact switcher uses `localeAbbreviations` instead. */
export const localeNames: Record<Locale, string> = {
  fa: "فارسی",
  en: "English",
  de: "Deutsch",
  ar: "العربية",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  he: "עברית",
  ru: "Русский",
  tr: "Türkçe",
  ckb: "کوردی",
  hi: "हिन्दी",
  ur: "اردو",
  sv: "Svenska",
  nl: "Nederlands",
  zh: "中文",
};

/** ISO 639-1 two-letter codes, uppercase. Industry standard for compact
 *  language switchers (Apple, Google, GitHub, Wikipedia all use this form).
 *  Sorani Kurdish (ckb) has no ISO 639-1 code — uses the ISO 639-3 form. */
export const localeAbbreviations: Record<Locale, string> = {
  fa: "FA",
  en: "EN",
  de: "DE",
  ar: "AR",
  fr: "FR",
  it: "IT",
  es: "ES",
  he: "HE",
  ru: "RU",
  tr: "TR",
  ckb: "KU",
  hi: "HI",
  ur: "UR",
  sv: "SV",
  nl: "NL",
  zh: "ZH",
};

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  fa: "rtl",
  en: "ltr",
  de: "ltr",
  ar: "rtl",
  fr: "ltr",
  it: "ltr",
  es: "ltr",
  he: "rtl",
  ru: "ltr",
  tr: "ltr",
  ckb: "rtl",
  hi: "ltr",
  ur: "rtl",
  sv: "ltr",
  nl: "ltr",
  zh: "ltr",
};
