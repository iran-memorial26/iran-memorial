/**
 * Translation maps for database values that need locale-aware display.
 *
 * DB stores values in English. These maps translate the most common values
 * for display in German and Farsi. Unknown values fall back to the English original.
 */

import type { Locale } from "@/i18n/config";

// ─── Cause of Death ─────────────────────────────────────────────────────────

const causeDE: Record<string, string> = {
  "Execution » Hanging": "Hinrichtung » Erhängen",
  "Execution » Shooting": "Hinrichtung » Erschießung",
  "Execution » Unspecified execution method": "Hinrichtung » Nicht spezifizierte Methode",
  "Execution » Death in custody": "Hinrichtung » Tod in Haft",
  "Execution » Other execution method": "Hinrichtung » Andere Methode",
  "Execution » Stoning": "Hinrichtung » Steinigung",
  "Execution": "Hinrichtung",
  "Fatal": "Tödlich",
  "Gunshot": "Erschossen",
  "Gunshot (headshot)": "Erschossen (Kopfschuss)",
  "Bullet wound": "Schussverletzung",
  "Extrajudicial Execution": "Außergerichtliche Hinrichtung",
  "Extrajudicial Execution » Extrajudicial shooting": "Außergerichtliche Hinrichtung » Erschießung",
  "Extrajudicial Execution » Enforced disappearance": "Außergerichtliche Hinrichtung » Erzwungenes Verschwinden",
  "Arbitrary Execution » Arbitrary shooting": "Willkürliche Hinrichtung » Willkürliche Erschießung",
  "Arbitrary Execution » Bombing": "Willkürliche Hinrichtung » Bombardierung",
  "Arbitrary Execution » Unspecified arbitrary execution method": "Willkürliche Hinrichtung » Nicht spezifizierte Methode",
  "Arbitrary Execution": "Willkürliche Hinrichtung",
  "Judicial execution": "Justizhinrichtung",
  "Unknown": "Unbekannt",
  "Torture": "Folter",
  "In custody": "In Haft",
  "Stabbing": "Messerstich",
  "Beating": "Totschlag",
  "Chemical weapons": "Chemiewaffen",
  "Asphyxiation": "Erstickung",
  "Suicide under duress": "Suizid unter Zwang",
};

const causeFA: Record<string, string> = {
  "Execution » Hanging": "اعدام » حلق‌آویز",
  "Execution » Shooting": "اعدام » تیرباران",
  "Execution » Unspecified execution method": "اعدام » روش نامشخص",
  "Execution » Death in custody": "اعدام » مرگ در بازداشت",
  "Execution » Other execution method": "اعدام » روش دیگر",
  "Execution » Stoning": "اعدام » سنگسار",
  "Execution": "اعدام",
  "Fatal": "کشنده",
  "Gunshot": "تیراندازی",
  "Gunshot (headshot)": "تیراندازی (شلیک به سر)",
  "Bullet wound": "زخم گلوله",
  "Extrajudicial Execution": "اعدام فراقضایی",
  "Extrajudicial Execution » Extrajudicial shooting": "اعدام فراقضایی » تیراندازی",
  "Extrajudicial Execution » Enforced disappearance": "اعدام فراقضایی » ناپدیدسازی اجباری",
  "Arbitrary Execution » Arbitrary shooting": "اعدام خودسرانه » تیراندازی خودسرانه",
  "Arbitrary Execution » Bombing": "اعدام خودسرانه » بمباران",
  "Arbitrary Execution » Unspecified arbitrary execution method": "اعدام خودسرانه » روش نامشخص",
  "Arbitrary Execution": "اعدام خودسرانه",
  "Judicial execution": "اعدام قضایی",
  "Unknown": "نامشخص",
  "Torture": "شکنجه",
  "In custody": "در بازداشت",
  "Stabbing": "چاقو",
  "Beating": "ضرب و شتم",
  "Chemical weapons": "سلاح شیمیایی",
  "Asphyxiation": "خفگی",
  "Suicide under duress": "خودکشی اجباری",
};

const causeMaps: Record<string, Record<string, string>> = { de: causeDE, fa: causeFA };

export function translateCause(value: string | null, locale: Locale): string | null {
  if (!value) return null;
  if (locale === "en") return value;
  return causeMaps[locale]?.[value] || value;
}

// ─── Age Distribution Buckets ───────────────────────────────────────────────

const ageBucketDE: Record<string, string> = {
  "Under 18": "Unter 18",
  "18-25": "18–25",
  "26-35": "26–35",
  "36-50": "36–50",
  "Over 50": "Über 50",
};

const ageBucketFA: Record<string, string> = {
  "Under 18": "زیر ۱۸",
  "18-25": "۱۸–۲۵",
  "26-35": "۲۶–۳۵",
  "36-50": "۳۶–۵۰",
  "Over 50": "بالای ۵۰",
};

const ageMaps: Record<string, Record<string, string>> = { de: ageBucketDE, fa: ageBucketFA };

export function translateAgeBucket(value: string, locale: Locale): string {
  if (locale === "en") return value;
  return ageMaps[locale]?.[value] || value;
}

// ─── Data Source Labels ─────────────────────────────────────────────────────

const sourceDE: Record<string, string> = {
  "boroumand-import": "Boroumand Center",
  "iranvictims-csv-import": "IranVictims",
  "iran-memorial project": "Iran Memorial",
  "boroumand-photo-import": "Boroumand (Fotos)",
};

const sourceFA: Record<string, string> = {
  "boroumand-import": "مرکز برومند",
  "iranvictims-csv-import": "قربانیان ایران",
  "iran-memorial project": "یادبود ایران",
  "boroumand-photo-import": "برومند (تصاویر)",
};

const sourceMaps: Record<string, Record<string, string>> = { de: sourceDE, fa: sourceFA };

export function translateDataSource(value: string, locale: Locale): string {
  if (locale === "en") return value;
  return sourceMaps[locale]?.[value] || value;
}

// ─── Generic label translation (for chart labels) ──────────────────────────

export function translateLabel(
  value: string,
  category: "cause" | "ageBucket" | "dataSource",
  locale: Locale
): string {
  switch (category) {
    case "cause": return translateCause(value, locale) || value;
    case "ageBucket": return translateAgeBucket(value, locale);
    case "dataSource": return translateDataSource(value, locale);
    default: return value;
  }
}
