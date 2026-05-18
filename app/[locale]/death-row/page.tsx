import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { VictimCard } from "@/components/VictimCard";
import { getDeathRowVictims } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function DeathRowPage({
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
  const { victims, total, totalPages } = await getDeathRowVictims(page);

  const titles: Record<string, string> = {
    en: "Death Row",
    de: "Todeszelle",
    fa: "زندان مرگ",
    ar: "طابور الإعدام",
    fr: "Couloir de la mort",
    it: "Braccio della morte",
    es: "Corredor de la muerte",
  };
  const subtitles: Record<string, string> = {
    en: "Iranians sentenced to death and awaiting execution. International pressure has stopped executions before — your letter can save a life.",
    de: "Iraner, die zum Tode verurteilt sind und auf ihre Hinrichtung warten. Internationaler Druck hat schon Hinrichtungen verhindert — dein Brief kann ein Leben retten.",
    fa: "ایرانیانی که به اعدام محکوم شده‌اند و در انتظار اجرای حکم هستند. فشار بین‌المللی در گذشته اعدام‌ها را متوقف کرده — نامه شما می‌تواند جانی را نجات دهد.",
    ar: "إيرانيون محكوم عليهم بالإعدام بانتظار تنفيذ الحكم. الضغط الدولي أوقف عمليات إعدام من قبل — رسالتك قد تنقذ حياة.",
    fr: "Iraniens condamnés à mort en attente d'exécution. La pression internationale a déjà arrêté des exécutions — votre lettre peut sauver une vie.",
    it: "Iraniani condannati a morte in attesa dell'esecuzione. La pressione internazionale ha già fermato esecuzioni — la tua lettera può salvare una vita.",
    es: "Iraníes condenados a muerte a la espera de ejecución. La presión internacional ya ha detenido ejecuciones — su carta puede salvar una vida.",
  };
  const entriesLabel: Record<string, string> = {
    en: "people awaiting execution",
    de: "Personen warten auf ihre Hinrichtung",
    fa: "نفر در انتظار اعدام",
    ar: "شخصاً بانتظار الإعدام",
    fr: "personnes en attente d'exécution",
    it: "persone in attesa di esecuzione",
    es: "personas a la espera de ejecución",
  };
  const badge: Record<string, string> = {
    en: "Hanging Imminent",
    de: "Hinrichtung droht",
    fa: "اعدام قریب‌الوقوع",
    ar: "الإعدام وشيك",
    fr: "Exécution imminente",
    it: "Esecuzione imminente",
    es: "Ejecución inminente",
  };
  const ctaTitle: Record<string, string> = {
    en: "Take Action — Today",
    de: "Werde aktiv — heute",
    fa: "اقدام کنید — همین امروز",
    ar: "اتخذ إجراءً — اليوم",
    fr: "Agir — aujourd'hui",
    it: "Agisci — oggi",
    es: "Actúa — hoy",
  };
  const ctaText: Record<string, string> = {
    en: "Amnesty International runs urgent-action letter campaigns for prisoners on death row. Their letters have stopped executions in Iran before. Write one today.",
    de: "Amnesty International führt Eilaktionen mit Briefkampagnen für Todeskandidaten durch. Ihre Briefe haben im Iran schon Hinrichtungen gestoppt. Schreib heute einen.",
    fa: "عفو بین‌الملل کمپین‌های اقدام فوری برای زندانیان محکوم به اعدام انجام می‌دهد. نامه‌های آنها در گذشته اعدام‌هایی را در ایران متوقف کرده‌اند. همین امروز نامه‌ای بنویسید.",
    ar: "تنظم منظمة العفو الدولية حملات رسائل عاجلة للمحكوم عليهم بالإعدام. رسائلهم أوقفت إعدامات في إيران من قبل. اكتب رسالة اليوم.",
    fr: "Amnesty International mène des campagnes de lettres d'action urgente pour les condamnés à mort. Leurs lettres ont déjà arrêté des exécutions en Iran. Écrivez-en une aujourd'hui.",
    it: "Amnesty International conduce campagne di azione urgente con lettere per i condannati a morte. Le loro lettere hanno già fermato esecuzioni in Iran. Scrivine una oggi.",
    es: "Amnistía Internacional realiza campañas de cartas de acción urgente para condenados a muerte. Sus cartas ya han detenido ejecuciones en Irán. Escriba una hoy.",
  };
  const amnestyBtn: Record<string, string> = {
    en: "Amnesty Urgent Actions →",
    de: "Amnesty Eilaktionen →",
    fa: "اقدامات فوری عفو بین‌الملل ←",
    ar: "إجراءات عاجلة لمنظمة العفو ←",
    fr: "Actions urgentes Amnesty →",
    it: "Azioni urgenti Amnesty →",
    es: "Acciones urgentes Amnistía →",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blood-400/10 border border-blood-400/30 text-blood-300 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blood-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blood-400" />
            </span>
            {badge[locale] || badge.en}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-memorial-100 mb-2">
          {titles[locale] || titles.en}
        </h1>
        <p className="text-memorial-400 text-sm max-w-2xl">
          {subtitles[locale] || subtitles.en}
        </p>
        <p className="text-blood-400 text-xs mt-2 font-semibold tabular-nums">
          {formatNumber(total, locale as Locale)} {entriesLabel[locale] || entriesLabel.en}
        </p>
      </div>

      {/* Amnesty CTA — top placement so it's seen even before scrolling */}
      <div className="rounded-xl border border-blood-400/30 bg-blood-400/5 p-6 mb-10">
        <h2 className="text-lg font-semibold text-blood-300 mb-2">
          {ctaTitle[locale] || ctaTitle.en}
        </h2>
        <p className="text-memorial-300 text-sm mb-4 max-w-3xl">
          {ctaText[locale] || ctaText.en}
        </p>
        <a
          href="https://www.amnesty.org/en/get-involved/take-action/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-blood-400/40 bg-blood-400/15 text-blood-200 text-sm hover:bg-blood-400/25 transition-colors font-medium"
        >
          {amnestyBtn[locale] || amnestyBtn.en}
        </a>
      </div>

      {victims.length === 0 ? (
        <div className="py-20 text-center text-memorial-400">
          <p>{locale === "de" ? "Keine Einträge gefunden." : locale === "fa" ? "موردی یافت نشد." : "No entries found."}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            {victims.map((victim) => (
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

          {totalPages > 1 && (
            <div className="mt-2 mb-12 flex items-center justify-center gap-1">
              {page > 1 ? (
                <Link
                  href={`/death-row?page=${page - 1}`}
                  className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm"
                >
                  &larr;
                </Link>
              ) : (
                <span className="px-3 py-2 rounded-md border border-memorial-800 text-memorial-600 text-sm cursor-not-allowed">&larr;</span>
              )}

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p =
                  totalPages <= 7
                    ? i + 1
                    : page <= 4
                      ? i + 1
                      : page >= totalPages - 3
                        ? totalPages - 6 + i
                        : page - 3 + i;
                return (
                  <Link
                    key={p}
                    href={`/death-row?page=${p}`}
                    className={`px-3 py-2 rounded-md text-sm ${
                      p === page
                        ? "bg-blood-400/20 border border-blood-400/30 text-blood-300 font-medium"
                        : "border border-memorial-700 text-memorial-300 hover:bg-memorial-800"
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}

              {page < totalPages ? (
                <Link
                  href={`/death-row?page=${page + 1}`}
                  className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm"
                >
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
