import { getPartnerStatistics } from "@/lib/queries";
import { StatCard, Section, HorizontalBars } from "@/components/charts";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function PartnersPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("admin");
  const stats = await getPartnerStatistics();

  // Aggregate totals
  const totalRequests = stats.reduce((sum, s) => sum + s.totalRequests, 0);
  const activePartners = stats.filter((s) => s.totalRequests > 0).length;
  const requestsLast7Days = stats.reduce((sum, s) => sum + s.requestsLast7Days, 0);

  // Combined daily usage (all partners)
  const allDailyUsage = stats.flatMap((s) => s.dailyUsage);
  const dailyUsageByDate = allDailyUsage.reduce(
    (acc, d) => {
      acc[d.date] = (acc[d.date] || 0) + d.count;
      return acc;
    },
    {} as Record<string, number>
  );

  const combinedDailyUsage = Object.entries(dailyUsageByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Partnership Analytics</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <StatCard
            value={formatNumber(totalRequests, locale)}
            label="Total API Requests"
            highlight
          />
          <StatCard value={formatNumber(activePartners, locale)} label="Active Partners" />
          <StatCard
            value={formatNumber(requestsLast7Days, locale)}
            label="Requests (Last 7 Days)"
          />
        </div>

        {/* Time Series Chart */}
        {combinedDailyUsage.length > 0 && (
          <Section title="API Usage Over Time (Last 30 Days)">
            <TimeSeriesChart
              data={combinedDailyUsage}
              locale={locale}
              color="bg-gold-500/80"
            />
          </Section>
        )}

        {/* Partner Breakdown Table */}
        <Section title="Partners">
          {stats.length === 0 ? (
            <p className="text-memorial-400">No API keys created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-memorial-800 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Total Requests</th>
                    <th className="p-3">Last 7 Days</th>
                    <th className="p-3">Last 30 Days</th>
                    <th className="p-3">Last Used</th>
                    <th className="p-3">Top Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((partner) => {
                    const topEndpoint = partner.endpoints[0];
                    return (
                      <tr key={partner.apiKeyId} className="border-t border-memorial-800">
                        <td className="p-3 font-medium">{partner.name}</td>
                        <td className="p-3">{formatNumber(partner.totalRequests, locale)}</td>
                        <td className="p-3">{formatNumber(partner.requestsLast7Days, locale)}</td>
                        <td className="p-3">
                          {formatNumber(partner.requestsLast30Days, locale)}
                        </td>
                        <td className="p-3 text-sm text-memorial-400">
                          {partner.lastUsedAt
                            ? new Date(partner.lastUsedAt).toLocaleDateString(locale)
                            : "Never"}
                        </td>
                        <td className="p-3 text-sm">
                          {topEndpoint ? (
                            <code className="text-xs bg-memorial-800 px-2 py-1 rounded">
                              {topEndpoint.endpoint} ({topEndpoint.count})
                            </code>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Top Endpoints (Global) */}
        {(() => {
          const allEndpoints = stats.flatMap((s) => s.endpoints);
          const endpointCounts = allEndpoints.reduce(
            (acc, e) => {
              acc[e.endpoint] = (acc[e.endpoint] || 0) + e.count;
              return acc;
            },
            {} as Record<string, number>
          );
          const topEndpoints = Object.entries(endpointCounts)
            .map(([endpoint, count]) => ({ label: endpoint, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          return topEndpoints.length > 0 ? (
            <Section title="Most Requested Endpoints">
              <HorizontalBars data={topEndpoints} locale={locale} color="bg-gold-500/80" />
            </Section>
          ) : null;
        })()}
      </div>
  );
}
