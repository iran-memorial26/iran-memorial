import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getStats } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

type Stats = {
  victimCount: number;
  verifiedCount: number;
  sourceCount: number;
  dataSourceCount: number;
  eventCount: number;
  photoCount: number;
  yearsOfRepression: number;
};

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const stats = await getStats();

  return <AboutContent locale={locale as Locale} stats={stats} />;
}

type CredibilityTier = "high" | "reputable" | "community";

// Source list — 15+ data sources, each annotated with credibility tier.
// Order: high-credibility first (matches the methodology tiers).
const SOURCES: { key: string; tier: CredibilityTier }[] = [
  { key: "source_boroumand",      tier: "high" },
  { key: "source_hrana",          tier: "high" },
  { key: "source_hengaw",         tier: "high" },
  { key: "source_amnesty",        tier: "high" },
  { key: "source_ihr",            tier: "high" },
  { key: "source_ohchr",          tier: "high" },
  { key: "source_cpj",            tier: "high" },
  { key: "source_khrn",           tier: "high" },
  { key: "source_iranvictims",    tier: "reputable" },
  { key: "source_iranrevolution", tier: "reputable" },
  { key: "source_iranmonitor",    tier: "reputable" },
  { key: "source_witnessReport",  tier: "reputable" },
  { key: "source_telegramRtn",    tier: "community" },
  { key: "source_telegramVahid",  tier: "community" },
  { key: "source_wikipedia",      tier: "community" },
  { key: "source_community",      tier: "community" },
] as const;

const TIER_STYLE: Record<CredibilityTier, { dot: string; label: string }> = {
  high:       { dot: "bg-emerald-400", label: "credibilityHigh" },
  reputable:  { dot: "bg-amber-400",   label: "credibilityReputable" },
  community:  { dot: "bg-memorial-500", label: "credibilityCommunity" },
};

const AUDIENCES = [
  "audienceFamilies",
  "audienceResearchers",
  "audienceJournalists",
  "audienceLawyers",
  "audienceNgos",
  "audienceDiaspora",
] as const;

const METHODOLOGY_TIERS = [
  "methodologyTierVerified",
  "methodologyTierUnverified",
  "methodologyTierDisputed",
] as const;

const STANDARDS = [
  { title: "standardsSchemaOrg", desc: "standardsSchemaOrgDesc" },
  { title: "standardsDataset",   desc: "standardsDatasetDesc" },
  { title: "standardsFair",      desc: "standardsFairDesc" },
  { title: "standardsHuridocs",  desc: "standardsHuridocsDesc" },
  { title: "standardsApi",       desc: "standardsApiDesc" },
  { title: "standardsLicense",   desc: "standardsLicenseDesc" },
] as const;

const API_ITEMS = ["apiRest", "apiMcp", "apiBulk"] as const;

const HELP_ITEMS = [
  "howToHelpFamilies",
  "howToHelpCorrect",
  "howToHelpTranslate",
  "howToHelpResearchers",
  "howToHelpNgos",
  "howToHelpDev",
  "howToHelpShare",
] as const;

function AboutContent({
  locale,
  stats,
}: {
  locale: Locale;
  stats: Stats;
}) {
  const t = useTranslations("about");

  const verifiedPercent =
    stats.victimCount > 0
      ? Math.round((stats.verifiedCount / stats.victimCount) * 100)
      : 0;

  const statTiles = [
    { label: t("statVictims"),     value: formatNumber(stats.victimCount, locale) },
    { label: t("statVerified"),    value: `${formatNumber(stats.verifiedCount, locale)} (${verifiedPercent}%)` },
    { label: t("statSources"),     value: formatNumber(stats.sourceCount, locale) },
    { label: t("statDataSources"), value: formatNumber(stats.dataSourceCount, locale) },
    { label: t("statEvents"),      value: formatNumber(stats.eventCount, locale) },
    { label: t("statPhotos"),      value: formatNumber(stats.photoCount, locale) },
    { label: t("statLanguages"),   value: formatNumber(locales.length, locale) },
    { label: t("statYears"),       value: formatNumber(stats.yearsOfRepression, locale) },
  ];

  return (
    <div>
      {/* Hero / Quote */}
      <section className="relative py-20 sm:py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-memorial-950 via-memorial-900/30 to-memorial-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-gold-500)_0%,_transparent_70%)] opacity-[0.03]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="text-4xl candle-flicker inline-block mb-6">🕯</span>
          <h1 className="sr-only">{t("title")}</h1>
          <blockquote className="text-2xl sm:text-3xl font-light text-memorial-200 italic leading-relaxed">
            {t("quote")}
          </blockquote>
        </div>
      </section>

      {/* Expanded stats grid (8 tiles, 2×4 on desktop).
          relative z-10 is required because the hero section above creates a
          stacking context (position: relative + absolute-positioned gradient
          overlays as children). Without z-10 here the negative top margin
          would pull this section's content under the hero's gradient and
          the top row of numbers would render clipped. */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 -mt-8 mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl bg-memorial-800 overflow-hidden">
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className="bg-memorial-950 px-4 py-5 text-center"
            >
              <div className="text-xl sm:text-2xl font-bold text-gold-400 tabular-nums leading-none">
                {tile.value}
              </div>
              <div className="mt-2 text-xs text-memorial-500 leading-snug">
                {tile.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-20 space-y-16">
        {/* 1. Mission — Remembrance */}
        <section>
          <SectionHeading>{t("mission")}</SectionHeading>
          <p className="text-memorial-300 leading-relaxed text-lg">
            {t("missionText")}
          </p>
        </section>

        {/* 2. In the families' name — Goal #1 reframed */}
        <section>
          <SectionHeading>{t("familyWishTitle")}</SectionHeading>
          <p className="text-memorial-400 leading-relaxed mb-4">
            {t("familyWishLead")}
          </p>
          <blockquote className="border-s-2 border-gold-500/40 ps-5 my-6 text-memorial-200 italic text-lg leading-relaxed">
            {t("familyWishQuote")}
          </blockquote>
          <p className="text-memorial-300 leading-relaxed">
            {t("familyWishBody")}
          </p>
        </section>

        {/* 3. Why this project exists */}
        <section>
          <SectionHeading>{t("whyTitle")}</SectionHeading>
          <p className="text-memorial-300 leading-relaxed">
            {t("whyText")}
          </p>
        </section>

        {/* 4. Audiences — for whom we build this */}
        <section>
          <SectionHeading>{t("audiencesTitle")}</SectionHeading>
          <p className="text-memorial-400 mb-6 leading-relaxed">
            {t("audiencesLead")}
          </p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {AUDIENCES.map((key) => (
              <li
                key={key}
                className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 text-sm text-memorial-300 leading-relaxed"
              >
                {t(key)}
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Sources — expanded with credibility tiers */}
        <section>
          <SectionHeading>{t("sourcesTitle")}</SectionHeading>
          <p className="text-memorial-400 mb-6 leading-relaxed">
            {t("sourcesLead")}
          </p>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5 text-xs text-memorial-500">
            {(Object.keys(TIER_STYLE) as CredibilityTier[]).map((tier) => (
              <span key={tier} className="inline-flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${TIER_STYLE[tier].dot}`} />
                {t(TIER_STYLE[tier].label)}
              </span>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SOURCES.map(({ key, tier }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border border-memorial-800/60 bg-memorial-900/40 px-4 py-2.5"
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${TIER_STYLE[tier].dot}`}
                  aria-hidden
                />
                <span className="text-sm text-memorial-200">{t(key)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-memorial-500">
            <Link href="/sources" className="hover:text-gold-400 transition-colors underline-offset-4 hover:underline">
              {/* The /sources page renders detailed metadata + per-source counts.
                  Linking from /about avoids duplicating that table here. */}
              →
            </Link>{" "}
            <Link href="/sources" className="hover:text-gold-400 transition-colors">
              {t("statDataSources")}
            </Link>
          </p>
        </section>

        {/* 6. Methodology & verification — tier system visible */}
        <section>
          <SectionHeading>{t("methodology")}</SectionHeading>
          <p className="text-memorial-300 mb-5 leading-relaxed">
            {t("methodologyLead")}
          </p>
          <ul className="space-y-3 mb-6">
            {METHODOLOGY_TIERS.map((key, i) => {
              const tierColors = ["bg-emerald-400", "bg-amber-400", "bg-red-400"];
              return (
                <li
                  key={key}
                  className="flex items-start gap-3 rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4"
                >
                  <span
                    className={`mt-1.5 inline-block w-2 h-2 flex-shrink-0 rounded-full ${tierColors[i]}`}
                    aria-hidden
                  />
                  <span className="text-sm text-memorial-200 leading-relaxed">
                    {t(key)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-memorial-400 leading-relaxed">
            {t("methodologyTransparency")}
          </p>
          <div className="mt-5">
            <Link
              href="/methodology"
              className="text-sm text-gold-400 hover:text-gold-300 transition-colors underline-offset-4 hover:underline"
            >
              {t("methodology")} →
            </Link>
          </div>
        </section>

        {/* 7. Standards & Interoperability — gold-standard commitment */}
        <section>
          <SectionHeading>{t("standardsTitle")}</SectionHeading>
          <p className="text-memorial-300 mb-6 leading-relaxed">
            {t("standardsLead")}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {STANDARDS.map(({ title, desc }) => (
              <div
                key={title}
                className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4"
              >
                <div className="text-sm font-medium text-gold-400 mb-1.5">
                  {t(title)}
                </div>
                <div className="text-xs text-memorial-400 leading-relaxed">
                  {t(desc)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 8. Open API & bulk data */}
        <section>
          <SectionHeading>{t("apiTitle")}</SectionHeading>
          <p className="text-memorial-300 mb-5 leading-relaxed">
            {t("apiLead")}
          </p>
          <ul className="space-y-2 mb-6">
            {API_ITEMS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-400" />
                <span className="text-sm text-memorial-300 leading-relaxed">{t(key)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/developers"
            className="inline-flex items-center text-sm text-gold-400 hover:text-gold-300 transition-colors underline-offset-4 hover:underline"
          >
            {t("apiDevLink")}
          </Link>
        </section>

        {/* 9. How you can help */}
        <section>
          <SectionHeading>{t("howToHelp")}</SectionHeading>
          <ul className="space-y-3">
            {HELP_ITEMS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-400" />
                <span className="text-memorial-300 leading-relaxed">{t(key)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link
              href="/submit"
              className="inline-flex items-center justify-center rounded-lg border border-gold-500/30 bg-gold-500/10 px-6 py-3 text-sm font-medium text-gold-400 hover:bg-gold-500/20 transition-colors"
            >
              {t("howToHelpFamilies").split(":")[0]}
            </Link>
          </div>
        </section>

        {/* 10. Ethics & care */}
        <section>
          <SectionHeading>{t("privacy")}</SectionHeading>
          <p className="text-memorial-300 leading-relaxed">
            {t("privacyText")}
          </p>
        </section>

        {/* 11. Open Source — no maintainer attribution by design (OPSEC on
            IRI-critical projects). License + repo link only. */}
        <section>
          <SectionHeading>{t("openSource")}</SectionHeading>
          <p className="text-memorial-300 leading-relaxed mb-5">
            {t("openSourceText")}
          </p>
          <a
            href="https://github.com/iran-memorial26/iran-memorial"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-gold-400 hover:text-gold-300 transition-colors underline-offset-4 hover:underline"
          >
            {t("githubLinkLabel")}
          </a>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2 className="text-lg font-semibold text-gold-400 flex-shrink-0">
        {children}
      </h2>
      <div className="h-px flex-1 bg-memorial-800" />
    </div>
  );
}
