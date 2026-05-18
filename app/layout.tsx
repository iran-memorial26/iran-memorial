import type { Metadata } from "next";
import { ReactNode } from "react";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/safe-json-ld";
import { locales } from "@/i18n/config";
import "./globals.css";

// Map locale code → BCP-47 region tag for og:locale alternateLocale.
// Picks the most common spelling region per language; not used for routing,
// only for OG meta hinting search engines and social platforms.
const OG_LOCALE: Record<string, string> = {
  fa: "fa_IR", en: "en_US", de: "de_DE", ar: "ar_SA",
  fr: "fr_FR", it: "it_IT", es: "es_ES",
  he: "he_IL", ru: "ru_RU", tr: "tr_TR", ckb: "ckb_IR",
  hi: "hi_IN", ur: "ur_PK", sv: "sv_SE", nl: "nl_NL", zh: "zh_CN",
};

// alternates.languages emits <link rel="alternate" hreflang="…"> tags so
// Google/Bing connect /en, /de, /fa, … as the same page in different
// languages. "x-default" routes to the canonical (English) version.
const HREFLANG_MAP: Record<string, string> = Object.fromEntries(
  locales.map((l) => [l, `${SITE_URL}/${l}`])
);
HREFLANG_MAP["x-default"] = `${SITE_URL}/en`;

export const metadata: Metadata = {
  title: {
    template: "%s | Iran Memorial",
    default: "Iran Memorial — Every Victim Has a Name",
  },
  description:
    "A living memorial for the victims of the Islamic Republic of Iran (1979–present). Documenting every life lost to state violence.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "Iran",
    "memorial",
    "human rights",
    "Islamic Republic",
    "political prisoners",
    "executions",
    "1988 massacre",
    "Mahsa Amini",
    "Woman Life Freedom",
    "accountability",
  ],
  openGraph: {
    siteName: "Iran Memorial",
    type: "website",
    locale: OG_LOCALE.en,
    alternateLocale: locales.filter((l) => l !== "en").map((l) => OG_LOCALE[l]),
  },
  twitter: {
    card: "summary",
    // site: "@iran_memorial" intentionally omitted — see lib/features.ts.
    // The handle isn't claimed yet; declaring association would invite
    // squatting and produce confusing card previews.
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: {
    languages: HREFLANG_MAP,
    types: {
      "application/rss+xml": "/feed.xml",
      "application/feed+json": "/feed.json",
    },
  },
};

// Root-level schema.org JSON-LD.
//
// WebSite + SearchAction: gives Google the metadata it needs to render a
// sitelinks search box directly in SERPs for the domain.
//
// Organization: declares "Iran Memorial" as a stable entity so Google/Bing
// can build a knowledge-graph node and so other sites can link to us via
// `sameAs`. This is one of the cheap wins on the path to schema.org gold-
// standard compliance.
const SITE_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Iran Memorial",
    alternateName: "یادبود ایران",
    url: SITE_URL,
    inLanguage: locales,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/en/victims?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Iran Memorial",
    alternateName: "یادبود ایران",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    description:
      "Digital memorial for victims of the Islamic Republic of Iran (1979–present). Documenting every life lost to state violence.",
    foundingDate: "2025-01-01",
    // No sameAs link — repository ownership is intentionally not surfaced
    // in public schema.org. Maintainer attribution is an OPSEC concern on
    // IRI-critical projects; see docs/SECURITY.md.
  },
];


export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <>
      {SITE_JSON_LD.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          nonce={nonce}
          // safeJsonLd serialises schema.org data — no user input, no XSS risk.
          dangerouslySetInnerHTML={{ __html: safeJsonLd(block) }}
        />
      ))}
      {children}
    </>
  );
}
