import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { VictimCard } from "@/components/VictimCard";
import { getImprisonedVictims } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function ImprisonedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const page = Math.max(1, Number(sp.page) || 1);
  const { victims: imprisoned, total, totalPages } = await getImprisonedVictims(page);

  const titles: Record<string, string> = {
    en: "Currently Imprisoned",
    de: "Aktuell Inhaftierte",
    fa: "زندانیان سیاسی فعلی",
  };
  const subtitles: Record<string, string> = {
    en: "Political prisoners currently in custody under the Islamic Republic",
    de: "Politische Gefangene, die sich aktuell in Haft der Islamischen Republik befinden",
    fa: "زندانیان سیاسی که در حال حاضر در بازداشت جمهوری اسلامی هستند",
  };
  const amnesty: Record<string, string> = {
    en: "Write a letter to Amnesty International",
    de: "Brief an Amnesty International schreiben",
    fa: "نامه به عفو بین‌الملل بنویسید",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {locale === "de" ? "Aktuell in Haft" : locale === "fa" ? "در حال حاضر در بازداشت" : "Currently in Custody"}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-memorial-100 mb-2">
          {titles[locale] || titles.en}
        </h1>
        <p className="text-memorial-400 text-sm max-w-2xl">
          {subtitles[locale] || subtitles.en}
        </p>
        <p className="text-memorial-500 text-xs mt-2">
          {formatNumber(total, locale as Locale)}{" "}
          {locale === "de" ? "Einträge dokumentiert" : locale === "fa" ? "مورد مستند شده" : "documented entries"}
        </p>
      </div>

      {imprisoned.length === 0 ? (
        <div className="py-20 text-center text-memorial-400">
          <p>{locale === "de" ? "Keine aktuellen Einträge gefunden." : "No current entries found."}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            {imprisoned.map((victim) => (
              <VictimCard
                key={victim.slug}
                slug={victim.slug}
                nameLatin={victim.nameLatin}
                nameFarsi={victim.nameFarsi}
                dateOfDeath={null}
                placeOfDeath={victim.placeOfDeath}
                causeOfDeath={victim.causeOfDeath}
                photoUrl={victim.photoUrl}
                locale={locale as Locale}
                verificationStatus={victim.verificationStatus}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-2 mb-12 flex items-center justify-center gap-1">
              {page > 1 ? (
                <Link
                  href={`/imprisoned?page=${page - 1}`}
                  className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm"
                >
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
                    href={`/imprisoned?page=${p}`}
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
                <Link
                  href={`/imprisoned?page=${page + 1}`}
                  className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm"
                >
                  &rarr;
                </Link>
              ) : (
                <span className="px-3 py-2 rounded-md border border-memorial-800 text-memorial-600 text-sm cursor-not-allowed">&rarr;</span>
              )}
            </div>
          )}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
            <p className="text-memorial-300 text-sm mb-4">
              {locale === "de"
                ? "Sie können helfen, indem Sie an internationale Organisationen schreiben, die sich für politische Gefangene einsetzen."
                : locale === "fa"
                ? "شما می‌توانید با نوشتن به سازمان‌های بین‌المللی که از زندانیان سیاسی حمایت می‌کنند کمک کنید."
                : "You can help by writing to international organizations that advocate for political prisoners."}
            </p>
            <a
              href="https://www.amnesty.org/en/take-action/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm hover:bg-amber-500/20 transition-colors"
            >
              {amnesty[locale] || amnesty.en} →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
