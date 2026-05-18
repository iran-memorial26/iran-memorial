import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getStatistics, type Statistics } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { translateCause, translateAgeBucket, translateDataSource } from "@/lib/translate";
import { StatCard, Section, HorizontalBars } from "@/components/charts";
import { Link } from "@/i18n/navigation";
import { TIER_BADGE, type CredibilityTier } from "@/lib/credibility";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

// Canonical source name → official website. Keys must match the canonical
// names emitted by getStatistics() SQL.
const SOURCE_URLS: Record<string, string> = {
  "Abdorrahman Boroumand Center": "https://www.iranrights.org/",
  "iranvictims.com": "https://iranvictims.com/",
  "iranrevolution.online": "https://iranrevolution.online/",
  "witness.report": "https://witness.report/",
  "Wikipedia": "https://en.wikipedia.org/wiki/Human_rights_in_Iran",
  "HRANA (Human Rights Activists)": "https://www.en-hrana.org/",
  "@RememberTheirNames (Telegram)": "https://t.me/RememberTheirNames",
  "@VahidOnline (Telegram)": "https://t.me/s/VahidOnline",
  "Iran Monitor": "https://www.iranmonitor.org/memorial",
  "Iran International": "https://www.iranintl.com/",
  "Iran Human Rights (IHR)": "https://iranhr.net/",
  "Amnesty International": "https://www.amnesty.org/en/countries/middle-east-and-north-africa/iran/",
  "Hengaw": "https://hengaw.net/",
  "Committee to Protect Journalists (CPJ)": "https://cpj.org/data/?cc_fips%5B%5D=IR",
  "Kurdistan Human Rights Network": "https://kurdistanhumanrights.org/",
  "NCRI": "https://www.ncr-iran.org/",
  "OHCHR (UN)": "https://www.ohchr.org/en/countries/iran",
  "IGFM": "https://www.igfm.de/",
};

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const stats = await getStatistics(locale as Locale);

  return <StatisticsContent stats={stats} locale={locale as Locale} />;
}

function StatisticsContent({
  stats,
  locale,
}: {
  stats: Statistics;
  locale: Locale;
}) {
  const t = useTranslations("statistics");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-memorial-100 tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 text-memorial-400 max-w-2xl mx-auto">
          {t("subtitle")}
        </p>
      </div>

      {/* Hero Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
        <StatCard
          value={formatNumber(stats.totalVictims, locale)}
          label={t("totalVictims")}
          highlight
        />
        <StatCard
          value={stats.yearsCovered}
          label={t("yearsCovered")}
        />
        <StatCard
          value={formatNumber(stats.provincesAffected, locale)}
          label={t("provincesAffected")}
        />
        <StatCard
          value={formatNumber(stats.verifiedCount, locale)}
          label={t("verifiedRecords")}
        />
      </div>

      {/* Deaths by Year */}
      <Section title={t("deathsByYear")}>
        <YearlyBarChart data={stats.deathsByYear} locale={locale} />
      </Section>

      {/* Deaths by Province */}
      <Section title={t("deathsByProvince")}>
        <HorizontalBars
          data={stats.deathsByProvince}
          locale={locale}
          color="bg-gold-500/80"
        />
      </Section>

      {/* Cause of Death */}
      <Section title={t("causeOfDeath")}>
        <HorizontalBars
          data={stats.deathsByCause.map((d) => ({
            ...d,
            label: translateCause(d.label, locale) || d.label,
          }))}
          locale={locale}
          color="bg-blood-500"
        />
      </Section>

      {/* Age Distribution */}
      <Section title={t("ageDistribution")}>
        <p className="text-sm text-memorial-500 mb-4">
          {formatNumber(
            stats.ageDistribution.reduce((s, d) => s + d.count, 0),
            locale
          )}{" "}
          {t("withKnownAge")}
        </p>
        <HorizontalBars
          data={stats.ageDistribution.map((d) => ({
            ...d,
            label: translateAgeBucket(d.label, locale),
          }))}
          locale={locale}
          color="bg-gold-500"
        />
      </Section>

      {/* Gender + Data Sources side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 mt-12 sm:mt-16">
        <div>
          <Section title={t("genderBreakdown")}>
            <div className="grid grid-cols-3 gap-3">
              {stats.genderBreakdown.map((g) => (
                <div
                  key={g.label}
                  className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 text-center"
                >
                  <div className="text-xl sm:text-2xl font-bold text-gold-400 tabular-nums">
                    {formatNumber(g.count, locale)}
                  </div>
                  <div className="text-xs text-memorial-500 mt-1">
                    {g.label === "male"
                      ? t("male")
                      : g.label === "female"
                        ? t("female")
                        : t("unknown")}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div>
          <Section title={t("dataSources")}>
            <HorizontalBars
              data={stats.dataSources.map((d) => ({
                ...d,
                label: translateDataSource(d.label, locale),
                href: SOURCE_URLS[d.label],
              }))}
              locale={locale}
              color="bg-memorial-500"
            />
          </Section>
        </div>
      </div>

      {/* Trust block — verification breakdown, tier mix, sources-per-victim */}
      <TrustBlock stats={stats} locale={locale} />
    </div>
  );
}

function TrustBlock({ stats, locale }: { stats: Statistics; locale: Locale }) {
  const t = useTranslations("statistics");
  const tc = useTranslations("credibility");
  const verifiedPct = stats.totalVictims
    ? Math.round((stats.verifiedCount / stats.totalVictims) * 100)
    : 0;
  const unverified = stats.totalVictims - stats.verifiedCount;

  return (
    <div className="mt-16">
      <Section title={t("trustTitle")}>
        <p className="text-sm text-memorial-400 mb-6 max-w-2xl">
          {t("trustIntro")}{" "}
          <Link
            href="/methodology"
            className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
          >
            {t("trustReadMore")}
          </Link>
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Verification breakdown */}
          <div>
            <h3 className="text-sm uppercase tracking-wider text-memorial-400 mb-4">
              {t("verificationBreakdown")}
            </h3>
            <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-bold text-emerald-400 tabular-nums">
                  {formatNumber(stats.verifiedCount, locale)}
                </span>
                <span className="text-sm text-memorial-400">
                  {verifiedPct}% {t("verifiedRecords").toLowerCase()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-memorial-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500/70"
                  style={{ width: `${verifiedPct}%` }}
                  aria-label={`${verifiedPct}% verified`}
                />
              </div>
              <div className="mt-3 text-xs text-memorial-500">
                {formatNumber(unverified, locale)} {t("unverifiedRemaining")}
              </div>
            </div>
          </div>

          {/* Top tier per victim */}
          <div>
            <h3 className="text-sm uppercase tracking-wider text-memorial-400 mb-4">
              {t("tierMix")}
            </h3>
            <ul className="space-y-2">
              {stats.tierDistribution.map((row) => {
                const tier = row.label as CredibilityTier | "unsourced";
                const badge = tier === "unsourced" ? null : TIER_BADGE[tier];
                const pct = stats.totalVictims
                  ? Math.round((row.count / stats.totalVictims) * 100)
                  : 0;
                const label = badge ? tc(`${tier}_label`) : t("unsourced");
                return (
                  <li
                    key={row.label}
                    className="flex items-center gap-3 rounded-lg border border-memorial-800/60 bg-memorial-900/30 px-4 py-2.5"
                  >
                    {badge ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                      >
                        <span aria-hidden>{badge.icon}</span>
                        <span>{label}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-memorial-700/40 bg-memorial-800/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-memorial-400">
                        {label}
                      </span>
                    )}
                    <span className="ms-auto text-sm font-semibold text-memorial-100 tabular-nums">
                      {formatNumber(row.count, locale)}
                    </span>
                    <span className="w-10 text-right text-xs text-memorial-500 tabular-nums">
                      {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-memorial-500">{t("tierMixCaption")}</p>
          </div>
        </div>

        {/* Sources-per-victim histogram */}
        <div className="mt-8">
          <h3 className="text-sm uppercase tracking-wider text-memorial-400 mb-4">
            {t("sourcesPerVictim")}
          </h3>
          <HorizontalBars
            data={stats.sourcesPerVictim.map((d) => ({
              label: `${d.label} ${t("sourcesShort")}`,
              count: d.count,
            }))}
            locale={locale}
            color="bg-amber-500/70"
          />
        </div>
      </Section>
    </div>
  );
}

/* ---------- Page-specific components ---------- */

function YearlyBarChart({
  data,
  locale,
}: {
  data: { year: number; count: number }[];
  locale: Locale;
}) {
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div dir="ltr" className="flex gap-px min-w-[700px] h-64 sm:h-72 pb-6">
        {data.map(({ year, count }) => {
          const heightPercent = (count / maxCount) * 100;
          const isPeak = count > 1000;
          return (
            <div
              key={year}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-memorial-800 text-memorial-100 text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                {year}: {formatNumber(count, locale)}
              </div>
              {/* Bar */}
              <div
                className={`w-full min-w-[4px] rounded-t-sm transition-colors ${
                  isPeak
                    ? "bg-blood-500 group-hover:bg-blood-400"
                    : "bg-memorial-600 group-hover:bg-memorial-500"
                }`}
                style={{ height: `${Math.max(heightPercent, 0.5)}%` }}
              />
              {/* Year label every 5 years */}
              {year % 5 === 0 && (
                <span className="absolute top-full mt-1 text-[10px] text-memorial-500 whitespace-nowrap">
                  {year}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
