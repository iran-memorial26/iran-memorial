"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";

const SEE_ALL_LABELS: Record<string, string> = {
  en: "See all results",
  de: "Alle Ergebnisse anzeigen",
  fa: "مشاهده همه نتایج",
  ar: "عرض جميع النتائج",
  fr: "Voir tous les résultats",
  it: "Vedi tutti i risultati",
  es: "Ver todos los resultados",
  he: "הצג את כל התוצאות",
  ru: "Показать все результаты",
  tr: "Tüm sonuçları göster",
  ckb: "هەموو ئەنجامەکان ببینە",
  hi: "सभी परिणाम देखें",
  ur: "تمام نتائج دیکھیں",
  sv: "Visa alla resultat",
  nl: "Alle resultaten weergeven",
  zh: "查看所有结果",
};

interface Suggestion {
  id: string;
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: string | null;
  placeOfDeath: string | null;
}

export function SearchBar({
  defaultValue = "",
  large = false,
}: {
  defaultValue?: string;
  large?: boolean;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const seeAllLabel = SEE_ALL_LABELS[locale] || SEE_ALL_LABELS.en;
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced fetch
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data.results) ? data.results : []);
        setIsOpen(true);
        setHighlightedIdx(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside closes the dropdown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function submitFullSearch() {
    const q = query.trim();
    if (q) {
      setIsOpen(false);
      router.push(`/victims?search=${encodeURIComponent(q)}`);
    }
  }

  function gotoSuggestion(s: Suggestion) {
    setIsOpen(false);
    router.push(`/victims/${s.slug}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Total option count = suggestions + "see all" row (when query non-empty)
    if (highlightedIdx >= 0 && highlightedIdx < suggestions.length) {
      gotoSuggestion(suggestions[highlightedIdx]);
    } else {
      submitFullSearch();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (suggestions.length > 0) setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, suggestions.length)); // last index = "see all" row
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIdx(-1);
    } else if (e.key === "Enter" && highlightedIdx === suggestions.length) {
      e.preventDefault();
      submitFullSearch();
    }
  }

  function formatYear(d: string | null): string {
    if (!d) return "";
    try {
      const y = new Date(d).getUTCFullYear();
      return Number.isFinite(y) ? String(y) : "";
    } catch {
      return "";
    }
  }

  const showDropdown =
    isOpen && query.trim().length >= 2 && (suggestions.length > 0 || isLoading);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative w-full">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKey}
          placeholder={t("searchPlaceholder")}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-activedescendant={
            highlightedIdx >= 0 && highlightedIdx < suggestions.length
              ? `search-sugg-${highlightedIdx}`
              : undefined
          }
          className={`w-full rounded-lg border border-memorial-700 bg-memorial-900/80 text-memorial-100 placeholder:text-memorial-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 ${
            large ? "px-5 py-4 text-lg" : "px-4 py-2.5 text-sm"
          }`}
        />
        <button
          type="submit"
          aria-label={t("searchPlaceholder")}
          className={`absolute end-2 rounded-md bg-memorial-700 text-memorial-300 hover:bg-memorial-600 hover:text-memorial-100 transition-colors ${
            large ? "top-2.5 px-4 py-2" : "top-1.5 px-3 py-1.5 text-sm"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </form>

      {showDropdown && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-40 max-h-96 overflow-auto rounded-lg border border-memorial-700 bg-memorial-950/95 backdrop-blur-md shadow-2xl text-start"
        >
          {isLoading && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-memorial-500">…</li>
          )}
          {suggestions.map((s, i) => {
            const year = formatYear(s.dateOfDeath);
            const isHi = i === highlightedIdx;
            return (
              <li
                key={s.id}
                id={`search-sugg-${i}`}
                role="option"
                aria-selected={isHi}
                onMouseEnter={() => setHighlightedIdx(i)}
                onMouseDown={(e) => {
                  // mouseDown beats the click-outside handler that closes
                  e.preventDefault();
                  gotoSuggestion(s);
                }}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer border-b border-memorial-800/60 last:border-b-0 ${
                  isHi ? "bg-memorial-800/70" : "hover:bg-memorial-900/60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-memorial-100 truncate">
                    {s.nameLatin}
                    {s.nameFarsi && (
                      <span className="ms-2 text-memorial-400 font-normal">
                        {s.nameFarsi}
                      </span>
                    )}
                  </div>
                  {(year || s.placeOfDeath) && (
                    <div className="text-xs text-memorial-500 truncate mt-0.5">
                      {year}
                      {year && s.placeOfDeath ? " · " : ""}
                      {s.placeOfDeath || ""}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {suggestions.length > 0 && (
            <li
              id={`search-sugg-${suggestions.length}`}
              role="option"
              aria-selected={highlightedIdx === suggestions.length}
              onMouseEnter={() => setHighlightedIdx(suggestions.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                submitFullSearch();
              }}
              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm text-gold-400 ${
                highlightedIdx === suggestions.length
                  ? "bg-memorial-800/70"
                  : "hover:bg-memorial-900/60"
              }`}
            >
              <span>{seeAllLabel}</span>
              <span>&rarr;</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
