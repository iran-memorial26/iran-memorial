import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { IranMap } from "@/components/IranMap";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

async function getMapData(locale: Locale) {
  const nameCol = locale === "fa" ? "p.name_fa" : locale === "de" ? "p.name_de" : "p.name_en";
  const byProvince = await prisma.$queryRaw<{
    slug: string;
    name: string;
    latitude: number;
    longitude: number;
    count: number;
  }[]>`
    SELECT p.slug, ${Prisma.raw(nameCol)} AS name,
      p.latitude, p.longitude, COUNT(*)::int AS count
    FROM victims v
    JOIN cities c ON v.city_id = c.id
    JOIN provinces p ON c.province_id = p.id
    GROUP BY p.id, p.slug, ${Prisma.raw(nameCol)}, p.latitude, p.longitude
    ORDER BY count DESC
  `;
  return byProvince.map((r) => ({
    slug: r.slug,
    name: r.name,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    count: Number(r.count),
  }));
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getMapData(locale as Locale);
  const totalMapped = data.reduce((sum, d) => sum + d.count, 0);

  return <MapContent data={data} totalMapped={totalMapped} locale={locale as Locale} />;
}

function MapContent({
  data,
  totalMapped,
  locale,
}: {
  data: { slug: string; name: string; latitude: number; longitude: number; count: number }[];
  totalMapped: number;
  locale: Locale;
}) {
  const t = useTranslations("map");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-memorial-100 tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 text-memorial-400">
          {t("subtitle")}
        </p>
        <p className="mt-1 text-sm text-memorial-500">
          {formatNumber(totalMapped, locale)} {t("victimsWithProvince")}
        </p>
      </div>

      <IranMap data={data} locale={locale} />

      {/* Province legend table */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gold-400 mb-4">{t("byProvince")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {data.map(({ slug, name, count }) => (
            // Each province row links to a pre-filtered /victims grid. Map
            // legend doubles as a discoverability surface — readers without
            // working JS / Leaflet still get a clickable list.
            <Link
              key={slug}
              href={`/victims?province=${encodeURIComponent(slug)}`}
              className="group flex items-center justify-between px-3 py-2 rounded border border-memorial-800/60 bg-memorial-900/30 hover:border-gold-500/30 hover:bg-memorial-800/50 transition-colors"
            >
              <span className="text-sm text-memorial-300 truncate group-hover:text-memorial-100">{name}</span>
              <span className="text-sm text-gold-400 tabular-nums ms-2 flex-shrink-0">
                {formatNumber(count, locale)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
