"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Locale } from "@/i18n/config";

type Method = "hanging" | "shooting" | "stoning" | "custody" | "other";

const METHODS: Method[] = ["hanging", "shooting", "stoning", "custody", "other"];

const METHOD_LABEL: Record<Method, Record<string, string>> = {
  hanging: { en: "Hanging", de: "Erhängen", fa: "اعدام با طناب", ar: "شنق", fr: "Pendaison", it: "Impiccagione", es: "Horca" },
  shooting: { en: "Firing squad", de: "Erschießung", fa: "تیرباران", ar: "رمياً بالرصاص", fr: "Peloton d'exécution", it: "Plotone d'esecuzione", es: "Pelotón de fusilamiento" },
  stoning: { en: "Stoning", de: "Steinigung", fa: "سنگسار", ar: "رجم", fr: "Lapidation", it: "Lapidazione", es: "Lapidación" },
  custody: { en: "In custody", de: "In Haft", fa: "در حجز", ar: "في الحجز", fr: "En détention", it: "In custodia", es: "Bajo custodia" },
  other: { en: "Other", de: "Andere", fa: "سایر", ar: "أخرى", fr: "Autre", it: "Altro", es: "Otro" },
};

const ALL_METHODS_LABEL: Record<string, string> = {
  en: "All methods", de: "Alle Methoden", fa: "همه روش‌ها", ar: "كل الطرق",
  fr: "Toutes les méthodes", it: "Tutti i metodi", es: "Todos los métodos",
};
const ALL_YEARS_LABEL: Record<string, string> = {
  en: "All years", de: "Alle Jahre", fa: "همه سال‌ها", ar: "كل السنوات",
  fr: "Toutes les années", it: "Tutti gli anni", es: "Todos los años",
};
const ALL_PROVINCES_LABEL: Record<string, string> = {
  en: "All provinces", de: "Alle Provinzen", fa: "همه استان‌ها", ar: "كل المحافظات",
  fr: "Toutes provinces", it: "Tutte le province", es: "Todas las provincias",
};
const ALL_COURTS_LABEL: Record<string, string> = {
  en: "All courts", de: "Alle Gerichte", fa: "همه دادگاه‌ها", ar: "كل المحاكم",
  fr: "Tous les tribunaux", it: "Tutti i tribunali", es: "Todos los tribunales",
};
const VERIFIED_ONLY_LABEL: Record<string, string> = {
  en: "Verified only", de: "Nur verifiziert", fa: "فقط تأیید‌شده", ar: "موثقة فقط",
  fr: "Vérifiés uniquement", it: "Solo verificati", es: "Solo verificados",
};
const CLEAR_LABEL: Record<string, string> = {
  en: "Clear filters", de: "Filter zurücksetzen", fa: "حذف فیلترها", ar: "مسح الفلاتر",
  fr: "Effacer les filtres", it: "Cancella filtri", es: "Borrar filtros",
};

function fmt(n: number, locale: Locale) {
  try {
    return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale).format(n);
  } catch {
    return String(n);
  }
}

export function ExecutionsFilterBar({
  locale,
  years,
  methods,
  provinces,
  courts,
  verifiedCount,
}: {
  locale: Locale;
  years: { year: number; count: number }[];
  methods: Record<string, number>;
  provinces: { name: string; count: number }[];
  courts: { name: string; count: number }[];
  verifiedCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMethod = searchParams.get("method") || "";
  const currentYear = searchParams.get("year") || "";
  const currentProvince = searchParams.get("province") || "";
  const currentCourt = searchParams.get("court") || "";
  const currentVerified = searchParams.get("verified") === "true";
  const hasFilters = currentMethod || currentYear || currentProvince || currentCourt || currentVerified;

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname],
  );

  const clear = () => router.push(pathname);

  const selectClasses =
    "rounded-md border border-memorial-700 bg-memorial-900/80 text-memorial-200 text-sm px-3 py-2 focus:border-blood-400 focus:outline-none focus:ring-1 focus:ring-blood-400/30 appearance-none cursor-pointer min-w-[10rem]";

  return (
    <div className="flex flex-wrap items-center gap-3 mb-8">
      <select
        value={currentMethod}
        onChange={(e) => updateParams({ method: e.target.value })}
        className={selectClasses}
        aria-label={ALL_METHODS_LABEL[locale] || ALL_METHODS_LABEL.en}
      >
        <option value="">{ALL_METHODS_LABEL[locale] || ALL_METHODS_LABEL.en}</option>
        {METHODS.map((m) => {
          const count = methods[m] || 0;
          if (count === 0) return null;
          const label = METHOD_LABEL[m][locale] || METHOD_LABEL[m].en;
          return (
            <option key={m} value={m}>
              {label} ({fmt(count, locale)})
            </option>
          );
        })}
      </select>

      <select
        value={currentYear}
        onChange={(e) => updateParams({ year: e.target.value })}
        className={selectClasses}
        aria-label={ALL_YEARS_LABEL[locale] || ALL_YEARS_LABEL.en}
      >
        <option value="">{ALL_YEARS_LABEL[locale] || ALL_YEARS_LABEL.en}</option>
        {years.map((y) => (
          <option key={y.year} value={String(y.year)}>
            {y.year} ({fmt(y.count, locale)})
          </option>
        ))}
      </select>

      <select
        value={currentProvince}
        onChange={(e) => updateParams({ province: e.target.value })}
        className={selectClasses}
        aria-label={ALL_PROVINCES_LABEL[locale] || ALL_PROVINCES_LABEL.en}
      >
        <option value="">{ALL_PROVINCES_LABEL[locale] || ALL_PROVINCES_LABEL.en}</option>
        {provinces.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name} ({fmt(p.count, locale)})
          </option>
        ))}
      </select>

      {courts.length > 0 && (
        <select
          value={currentCourt}
          onChange={(e) => updateParams({ court: e.target.value })}
          className={selectClasses}
          aria-label={ALL_COURTS_LABEL[locale] || ALL_COURTS_LABEL.en}
        >
          <option value="">{ALL_COURTS_LABEL[locale] || ALL_COURTS_LABEL.en}</option>
          {courts.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({fmt(c.count, locale)})
            </option>
          ))}
        </select>
      )}

      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-memorial-700 bg-memorial-900/80 text-sm text-memorial-200 cursor-pointer hover:border-memorial-600">
        <input
          type="checkbox"
          checked={currentVerified}
          onChange={(e) => updateParams({ verified: e.target.checked ? "true" : "" })}
          className="accent-blood-400 cursor-pointer"
        />
        <span>
          {VERIFIED_ONLY_LABEL[locale] || VERIFIED_ONLY_LABEL.en}{" "}
          <span className="text-memorial-500 tabular-nums text-xs">({fmt(verifiedCount, locale)})</span>
        </span>
      </label>

      {hasFilters && (
        <button
          onClick={clear}
          className="text-sm text-memorial-500 hover:text-memorial-300 transition-colors cursor-pointer"
        >
          ✕ {CLEAR_LABEL[locale] || CLEAR_LABEL.en}
        </button>
      )}
    </div>
  );
}
