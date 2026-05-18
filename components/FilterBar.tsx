"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function FilterBar({
  provinces,
  minYear,
  maxYear,
  caseTypeCounts,
  unknownCount,
  events,
}: {
  provinces: { slug: string; name: string }[];
  minYear: number;
  maxYear: number;
  /** Total records matching each case-type filter at zero other constraints.
   *  Displayed next to the chip label so users see the scale of each slice. */
  caseTypeCounts?: Record<string, number>;
  /** Number of unidentified (name_latin='Unknown') victims. Surfaces them as
   *  a facet chip rather than hiding them behind a separate /anonymous-victims
   *  route nobody finds. */
  unknownCount?: number;
  /** Major events for the event-filter dropdown. Empty = no dropdown rendered. */
  events?: { slug: string; title: string }[];
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar-EG" : locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentProvince = searchParams.get("province") || "";
  const currentYear = searchParams.get("year") || "";
  const currentGender = searchParams.get("gender") || "";
  const currentSearch = searchParams.get("search") || "";
  const currentCaseType = searchParams.get("caseType") || "";
  const currentVerified = searchParams.get("verified") === "true";
  const currentEvent = searchParams.get("event") || "";
  const currentIncludeUnknown = searchParams.get("identified") === "false";

  const hasFilters =
    currentProvince ||
    currentYear ||
    currentGender ||
    currentCaseType ||
    currentVerified ||
    currentEvent ||
    currentIncludeUnknown;

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname]
  );

  function clearFilters() {
    const params = new URLSearchParams();
    if (currentSearch) params.set("search", currentSearch);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectClasses =
    "rounded-md border border-memorial-700 bg-memorial-900/80 text-memorial-200 text-sm px-3 py-2 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 appearance-none cursor-pointer";
  const btnBase = "px-3 py-2 rounded-md text-sm border transition-colors cursor-pointer";
  const btnActive = "bg-gold-500/20 border-gold-500/30 text-gold-400 font-medium";
  const btnInactive = "border-memorial-700 text-memorial-400 hover:bg-memorial-800 hover:text-memorial-200";

  const statusChips = [
    { value: "", label: t("allCaseTypes") },
    { value: "execution", label: t("caseExecution") },
    { value: "imprisoned", label: t("caseImprisoned") },
    { value: "death_in_custody", label: t("caseCustody") },
    { value: "killed", label: t("caseKilled") },
  ];

  const UNIDENTIFIED_LABEL: Record<string, string> = {
    en: "Unidentified",
    de: "Unbekannt",
    fa: "ناشناس",
    ar: "مجهول الهوية",
    fr: "Non identifié",
    it: "Non identificato",
    es: "No identificado",
    he: "לא מזוהה",
    ru: "Неизвестные",
    tr: "Kimliği belirsiz",
    ckb: "ناناسراو",
    hi: "अज्ञात",
    ur: "غير شناخت",
    sv: "Oidentifierad",
    nl: "Onbekend",
    zh: "无名",
  };
  const ALL_EVENTS_LABEL: Record<string, string> = {
    en: "All events",
    de: "Alle Ereignisse",
    fa: "همه رویدادها",
    ar: "كل الأحداث",
    fr: "Tous les événements",
    it: "Tutti gli eventi",
    es: "Todos los eventos",
    he: "כל האירועים",
    ru: "Все события",
    tr: "Tüm olaylar",
    ckb: "هەموو ڕووداوەکان",
    hi: "सभी घटनाएं",
    ur: "تمام واقعات",
    sv: "Alla händelser",
    nl: "Alle gebeurtenissen",
    zh: "所有事件",
  };
  const unidentifiedLabel = UNIDENTIFIED_LABEL[locale] || UNIDENTIFIED_LABEL.en;
  const allEventsLabel = ALL_EVENTS_LABEL[locale] || ALL_EVENTS_LABEL.en;

  return (
    <div className="space-y-3">
      {/* Status chips — most prominent filter dimension. Counts make the
          scale of each slice visible at a glance (executions vs imprisoned
          vs custody) so users understand what they are selecting. */}
      <div className="flex flex-wrap items-center gap-2">
        {statusChips.map((c) => {
          const count = caseTypeCounts?.[c.value];
          return (
            <button
              key={c.value || "all"}
              onClick={() => updateParams({ caseType: c.value })}
              className={`${btnBase} ${currentCaseType === c.value ? btnActive : btnInactive}`}
              aria-pressed={currentCaseType === c.value}
            >
              <span>{c.label}</span>
              {typeof count === "number" && (
                <span
                  className={`ms-2 text-xs tabular-nums ${currentCaseType === c.value ? "text-gold-300/80" : "text-memorial-500"}`}
                >
                  {numberFormatter.format(count)}
                </span>
              )}
            </button>
          );
        })}
        {typeof unknownCount === "number" && unknownCount > 0 && (
          <button
            onClick={() => updateParams({ identified: currentIncludeUnknown ? "" : "false" })}
            className={`${btnBase} ${currentIncludeUnknown ? btnActive : btnInactive}`}
            aria-pressed={currentIncludeUnknown}
            title={unidentifiedLabel}
          >
            <span>{unidentifiedLabel}</span>
            <span
              className={`ms-2 text-xs tabular-nums ${currentIncludeUnknown ? "text-gold-300/80" : "text-memorial-500"}`}
            >
              {numberFormatter.format(unknownCount)}
            </span>
          </button>
        )}
      </div>

      {/* Secondary filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Province */}
        <select value={currentProvince} onChange={(e) => updateParams({ province: e.target.value })} className={selectClasses} aria-label={t("allProvinces")}>
          <option value="">{t("allProvinces")}</option>
          {provinces.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>

        {/* Year */}
        <select value={currentYear} onChange={(e) => updateParams({ year: e.target.value })} className={selectClasses} aria-label={t("allYears")}>
          <option value="">{t("allYears")}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Event — pivot back from /events curation into the main victim grid.
            Lets users filter "all PS752 victims" or "all 2022 protest victims"
            from the same surface they already use for free-form filtering. */}
        {events && events.length > 0 && (
          <select
            value={currentEvent}
            onChange={(e) => updateParams({ event: e.target.value })}
            className={selectClasses}
            aria-label={allEventsLabel}
          >
            <option value="">{allEventsLabel}</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.title}
              </option>
            ))}
          </select>
        )}

        {/* Gender buttons */}
        <div className="flex gap-1">
          <button onClick={() => updateParams({ gender: "" })} className={`${btnBase} ${!currentGender ? btnActive : btnInactive}`} aria-pressed={!currentGender}>
            {t("allGenders")}
          </button>
          <button onClick={() => updateParams({ gender: "male" })} className={`${btnBase} ${currentGender === "male" ? btnActive : btnInactive}`} aria-pressed={currentGender === "male"}>
            {t("male")}
          </button>
          <button onClick={() => updateParams({ gender: "female" })} className={`${btnBase} ${currentGender === "female" ? btnActive : btnInactive}`} aria-pressed={currentGender === "female"}>
            {t("female")}
          </button>
        </div>

        {/* Verified toggle */}
        <button
          onClick={() => updateParams({ verified: currentVerified ? "" : "true" })}
          className={`${btnBase} ${currentVerified ? btnActive : btnInactive}`}
          aria-pressed={currentVerified}
        >
          {t("verifiedOnly")}
        </button>

        {/* Clear */}
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-memorial-500 hover:text-memorial-300 transition-colors cursor-pointer">
            {t("clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
