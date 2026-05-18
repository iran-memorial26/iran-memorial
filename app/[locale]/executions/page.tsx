import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { VictimCard } from "@/components/VictimCard";
import { ExecutionsFilterBar } from "@/components/ExecutionsFilterBar";
import { getExecutedVictims, getExecutionFacets, type ExecutionMethod } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const METHODS: ExecutionMethod[] = ["hanging", "shooting", "stoning", "custody", "other"];

export default async function ExecutionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    method?: string;
    year?: string;
    province?: string;
    court?: string;
    verified?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const page = Math.max(1, Number(sp.page) || 1);
  const method = METHODS.includes(sp.method as ExecutionMethod) ? (sp.method as ExecutionMethod) : undefined;
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : undefined;
  const province = sp.province || undefined;
  const court = sp.court || undefined;
  const verifiedOnly = sp.verified === "true";

  const [{ victims: executed, total, totalPages }, facets] = await Promise.all([
    getExecutedVictims(page, 50, { method, year, province, court, verifiedOnly }),
    getExecutionFacets(),
  ]);

  const titles: Record<string, string> = {
    en: "Executions", de: "Hinrichtungen", fa: "اعدام‌ها", ar: "الإعدامات",
    fr: "Exécutions", it: "Esecuzioni", es: "Ejecuciones",
  };
  const subtitles: Record<string, string> = {
    en: "Political prisoners executed by the Islamic Republic — by hanging, firing squad, or other state execution.",
    de: "Politische Gefangene, die von der Islamischen Republik hingerichtet wurden — durch Erhängen, Erschießung oder andere staatliche Hinrichtungen.",
    fa: "زندانیان سیاسی که توسط جمهوری اسلامی اعدام شده‌اند — از طریق اعدام با طناب، جوخه آتش یا سایر اعدام‌های دولتی.",
    ar: "السجناء السياسيون الذين تم إعدامهم من قبل الجمهورية الإسلامية — شنقاً أو رمياً بالرصاص أو غير ذلك من أشكال الإعدام الرسمي.",
    fr: "Prisonniers politiques exécutés par la République islamique — par pendaison, peloton d'exécution ou autres exécutions d'État.",
    it: "Prigionieri politici giustiziati dalla Repubblica Islamica — per impiccagione, plotone d'esecuzione o altre esecuzioni di Stato.",
    es: "Presos políticos ejecutados por la República Islámica — por horca, pelotón de fusilamiento u otras ejecuciones de Estado.",
  };
  const entriesLabel: Record<string, string> = {
    en: "documented executions", de: "dokumentierte Hinrichtungen",
    fa: "اعدام‌های مستند شده", ar: "إعدامات موثقة",
    fr: "exécutions documentées", it: "esecuzioni documentate",
    es: "ejecuciones documentadas",
  };
  const badge: Record<string, string> = {
    en: "In Memory", de: "Im Gedenken", fa: "به یاد", ar: "في الذكرى",
    fr: "En mémoire", it: "In memoria", es: "En memoria",
  };

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (method) params.set("method", method);
    if (year) params.set("year", String(year));
    if (province) params.set("province", province);
    if (court) params.set("court", court);
    if (verifiedOnly) params.set("verified", "true");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/executions${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blood-400/10 border border-blood-400/30 text-blood-400 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-blood-400" />
            {badge[locale] || badge.en}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-memorial-100 mb-2">{titles[locale] || titles.en}</h1>
        <p className="text-memorial-400 text-sm max-w-2xl">{subtitles[locale] || subtitles.en}</p>
        <p className="text-memorial-500 text-xs mt-2">
          {formatNumber(total, locale as Locale)} {entriesLabel[locale] || entriesLabel.en}
        </p>
      </div>

      {/* Filters: Method + Year as <select> dropdowns (matches /victims pattern) */}
      <ExecutionsFilterBar
        locale={locale as Locale}
        years={facets.years}
        methods={facets.methods}
        provinces={facets.provinces}
        courts={facets.courts}
        verifiedCount={facets.verifiedCount}
      />

      {executed.length === 0 ? (
        <div className="py-20 text-center text-memorial-400">
          <p>{locale === "de" ? "Keine Einträge gefunden." : locale === "fa" ? "موردی یافت نشد." : "No entries found."}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            {executed.map((victim) => (
              <VictimCard
                key={victim.slug}
                slug={victim.slug}
                nameLatin={victim.nameLatin}
                nameFarsi={victim.nameFarsi}
                dateOfDeath={victim.dateOfDeath}
                placeOfDeath={victim.placeOfDeath}
                causeOfDeath={victim.causeOfDeath}
                photoUrl={victim.photoUrl}
                locale={locale as Locale}
                verificationStatus={victim.verificationStatus}
                responsibleForces={victim.responsibleForces}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-2 mb-12 flex items-center justify-center gap-1">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm">
                  &larr;
                </Link>
              ) : (
                <span className="px-3 py-2 rounded-md border border-memorial-800 text-memorial-600 text-sm cursor-not-allowed">&larr;</span>
              )}

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <Link
                    key={p}
                    href={pageHref(p)}
                    className={`px-3 py-2 rounded-md text-sm ${
                      p === page
                        ? "bg-gold-500/20 border border-gold-500/30 text-gold-400 font-medium"
                        : "border border-memorial-700 text-memorial-300 hover:bg-memorial-800"
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}

              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm">
                  &rarr;
                </Link>
              ) : (
                <span className="px-3 py-2 rounded-md border border-memorial-800 text-memorial-600 text-sm cursor-not-allowed">&rarr;</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
