"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

type CitationFormat = "apa" | "mla" | "chicago" | "bibtex";

const LABELS: Record<string, Record<string, string>> = {
  en: {
    cite: "Cite this page",
    hide: "Hide citation",
    copy: "Copy",
    copied: "Copied",
    apa: "APA",
    mla: "MLA",
    chicago: "Chicago",
    bibtex: "BibTeX",
    hint:
      "Choose a format and copy the citation. Update the access date if you cite long after retrieval.",
  },
  de: {
    cite: "Diese Seite zitieren",
    hide: "Zitation ausblenden",
    copy: "Kopieren",
    copied: "Kopiert",
    apa: "APA",
    mla: "MLA",
    chicago: "Chicago",
    bibtex: "BibTeX",
    hint:
      "Format wählen und kopieren. Bei späterer Zitierung das Abrufdatum aktualisieren.",
  },
  fa: {
    cite: "ارجاع به این صفحه",
    hide: "پنهان کردن ارجاع",
    copy: "کپی",
    copied: "کپی شد",
    apa: "APA",
    mla: "MLA",
    chicago: "Chicago",
    bibtex: "BibTeX",
    hint: "قالب را انتخاب کنید و ارجاع را کپی کنید.",
  },
};

function pickLabels(locale: string) {
  return LABELS[locale] || LABELS.en;
}

function isoToday(): string {
  return new Date().toISOString().split("T")[0];
}

function todayHuman(locale: string): string {
  return new Date().toLocaleDateString(locale === "fa" ? "fa-IR" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Build the four citation strings for a single victim profile. The site
 *  itself is the creator — there is no individual author per profile. */
function buildCitations({
  name,
  url,
  locale,
  yearKnown,
}: {
  name: string;
  url: string;
  locale: string;
  yearKnown?: number | null;
}) {
  const today = todayHuman(locale);
  const accessDate = isoToday();
  const siteName = "Iran Memorial";
  const yr = yearKnown ?? new Date().getFullYear();
  // BibTeX key — slug-safe identifier without spaces or punctuation.
  const bibKey = url
    .split("/")
    .filter(Boolean)
    .pop()!
    .replace(/[^a-z0-9-]/gi, "");

  return {
    apa: `${siteName}. (${yr}). ${name} [Memorial profile]. Retrieved ${today}, from ${url}`,
    mla: `"${name}." ${siteName}, ${yr}, ${url}. Accessed ${today}.`,
    chicago: `${siteName}. "${name}." Last modified ${yr}. ${url}.`,
    bibtex: `@misc{${bibKey},
  title        = {${name}},
  author       = {{${siteName}}},
  year         = {${yr}},
  url          = {${url}},
  urldate      = {${accessDate}},
  howpublished = {Memorial profile, \\url{${url}}}
}`,
  } satisfies Record<CitationFormat, string>;
}

/**
 * Toggle-revealed citation block for victim/event detail pages. Researchers,
 * NGOs and court briefs need machine-stable citations; copy-link alone does
 * not solve that. Four formats covers ~95% of academic + legal contexts.
 */
export function CitationBlock({
  name,
  url,
  yearKnown,
}: {
  /** Person name OR event title — whatever goes between quotes in the citation. */
  name: string;
  /** Absolute URL to the page being cited. */
  url: string;
  /** Year for the citation's date field (death year or event year). */
  yearKnown?: number | null;
}) {
  const locale = useLocale();
  const l = pickLabels(locale);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<CitationFormat>("apa");
  const [copied, setCopied] = useState(false);

  const cites = buildCitations({ name, url, locale, yearKnown });
  const current = cites[active];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard write rejected — leave UI untouched, user can manually select.
    }
  }

  const formats: CitationFormat[] = ["apa", "mla", "chicago", "bibtex"];

  return (
    <section className="mt-8 border-t border-memorial-800/60 pt-6" data-print-hide>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-memorial-400 hover:text-memorial-200 transition-colors cursor-pointer inline-flex items-center gap-2"
        aria-expanded={open}
        aria-controls="citation-block-content"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        {open ? l.hide : l.cite}
      </button>

      {open && (
        <div id="citation-block-content" className="mt-4">
          <p className="text-xs text-memorial-500 mb-3">{l.hint}</p>

          {/* Format tabs */}
          <div role="tablist" className="flex flex-wrap gap-1 mb-3">
            {formats.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={active === f}
                onClick={() => setActive(f)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                  active === f
                    ? "bg-gold-500/20 border-gold-500/30 text-gold-400 font-medium"
                    : "border-memorial-700 text-memorial-400 hover:bg-memorial-800 hover:text-memorial-200"
                }`}
              >
                {l[f]}
              </button>
            ))}
          </div>

          {/* Citation body — monospace for BibTeX, sans for narrative formats */}
          <div className="relative">
            <pre
              className={`rounded-lg border border-memorial-800 bg-memorial-900/50 p-4 text-xs text-memorial-200 overflow-x-auto whitespace-pre-wrap break-words ${
                active === "bibtex" ? "font-mono" : "font-sans leading-relaxed"
              }`}
            >
              {current}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-2 end-2 px-2.5 py-1 text-xs rounded-md border border-memorial-700 bg-memorial-900/80 text-memorial-300 hover:bg-memorial-800 hover:text-memorial-100 transition-colors cursor-pointer"
            >
              {copied ? `✓ ${l.copied}` : l.copy}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
