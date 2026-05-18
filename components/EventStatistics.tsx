import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import type { EventStatistics as EventStatsData } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { translateCause, translateAgeBucket } from "@/lib/translate";
import { StatCard, Section, HorizontalBars } from "@/components/charts";

export function EventStatistics({
  statistics,
  locale,
}: {
  statistics: EventStatsData;
  locale: Locale;
}) {
  const t = useTranslations("statistics");
  const te = useTranslations("event");

  return (
    <section className="mt-10 mb-10">
      {/* Section header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-lg font-semibold text-memorial-200 flex-shrink-0">
          {te("statistics")}
        </h2>
        <div className="h-px flex-1 bg-memorial-800" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard
          value={formatNumber(statistics.totalVictims, locale)}
          label={t("totalVictims")}
          highlight
        />
        <StatCard
          value={formatNumber(statistics.provincesAffected, locale)}
          label={t("provincesAffected")}
        />
        <StatCard
          value={formatNumber(statistics.verifiedCount, locale)}
          label={t("verifiedRecords")}
        />
      </div>

      {/* Charts: 2-column on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {statistics.deathsByProvince.length > 0 && (
          <div>
            <Section title={t("deathsByProvince")}>
              <HorizontalBars
                data={statistics.deathsByProvince}
                locale={locale}
                color="bg-gold-500/80"
              />
            </Section>
          </div>
        )}

        {statistics.deathsByCause.length > 0 && (
          <div>
            <Section title={t("causeOfDeath")}>
              <HorizontalBars
                data={statistics.deathsByCause.map((d) => ({
                  ...d,
                  label: translateCause(d.label, locale) || d.label,
                }))}
                locale={locale}
                color="bg-blood-500"
              />
            </Section>
          </div>
        )}

        {statistics.ageDistribution.length > 0 && (
          <div>
            <Section title={t("ageDistribution")}>
              <p className="text-sm text-memorial-500 mb-4">
                {formatNumber(
                  statistics.ageDistribution.reduce((s, d) => s + d.count, 0),
                  locale
                )}{" "}
                {t("withKnownAge")}
              </p>
              <HorizontalBars
                data={statistics.ageDistribution.map((d) => ({
                  ...d,
                  label: translateAgeBucket(d.label, locale),
                }))}
                locale={locale}
                color="bg-gold-500"
              />
            </Section>
          </div>
        )}

        {statistics.genderBreakdown.length > 0 && (
          <div>
            <Section title={t("genderBreakdown")}>
              <div className="grid grid-cols-3 gap-3">
                {statistics.genderBreakdown.map((g) => (
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
        )}
      </div>
    </section>
  );
}
