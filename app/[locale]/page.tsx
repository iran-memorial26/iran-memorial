import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SearchBar } from "@/components/SearchBar";
import { VictimCard } from "@/components/VictimCard";
import { getStats, getRecentVictims, getAllEvents, localized } from "@/lib/queries";
import { formatNumber, formatKilledRange } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

interface HomeStats {
  victimCount: number;
  eventCount: number;
  sourceCount: number;
  yearsOfRepression: number;
  recentProtestExecutions: number;
}

interface HomeVictim {
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: Date | string | null;
  placeOfDeath: string | null;
  causeOfDeath: string | null;
  photoUrl: string | null;
  verificationStatus?: string;
  city: { nameEn: string; nameFa: string | null; nameDe: string | null } | null;
}

interface HomeEvent {
  slug: string;
  titleEn: string;
  titleFa: string | null;
  titleDe?: string | null;
  descriptionEn: string | null;
  descriptionFa?: string | null;
  descriptionDe?: string | null;
  dateStart: Date | string;
  dateEnd: Date | string | null;
  estimatedKilledLow: number | null;
  estimatedKilledHigh: number | null;
  tags: string[];
  _count: { victims: number };
}

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [stats, recentVictims, events] = await Promise.all([
    getStats(),
    getRecentVictims(),
    getAllEvents(),
  ]);

  return (
    <HomeContent
      locale={locale as Locale}
      stats={stats}
      recentVictims={recentVictims}
      events={events}
    />
  );
}

function HomeContent({
  locale,
  stats,
  recentVictims,
  events,
}: {
  locale: Locale;
  stats: HomeStats;
  recentVictims: HomeVictim[];
  events: HomeEvent[];
}) {
  const t = useTranslations("home");
  const te = useTranslations("timeline");

  // Pick 4 most significant events for homepage preview
  const keyEvents = events
    .filter(
      (e) => e.estimatedKilledLow || e.estimatedKilledHigh
    )
    .slice(-5);

  return (
    <div>
      {/* Hero */}
      <section className="relative py-28 sm:py-40 px-4 overflow-hidden bg-memorial-950">
        {/* Photo wall removed. To restore: re-import HeroMosaic +
            getHeroMosaicPhotos, add back to the Promise.all + HomeContent
            props, then render <HeroMosaic photos={mosaicPhotos} /> here. */}

        {/* Subtle blood-red wash (kept for atmosphere) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-blood-600)_0%,_transparent_70%)] opacity-[0.04] pointer-events-none" />

        {/* Decorative top line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent via-memorial-700 to-transparent" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Urgent: 2026 protest executions */}
          {stats.recentProtestExecutions > 0 && (
            <div className="mb-8 flex justify-center">
              <Link
                href="/executions"
                className="group inline-flex items-center gap-3 px-4 py-2 rounded-full border border-blood-400/30 bg-blood-400/10 text-blood-300 text-sm hover:bg-blood-400/15 hover:border-blood-400/50 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-blood-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blood-400" />
                </span>
                <span className="font-medium">
                  {t("alertBannerText", { count: stats.recentProtestExecutions })}
                </span>
                <span className="text-xs text-blood-400/80 group-hover:text-blood-300">
                  {t("alertBannerCta")}
                </span>
              </Link>
            </div>
          )}

          {/* Candle */}
          <div className="mb-8">
            <span className="text-5xl candle-flicker inline-block">🕯</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-memorial-50 mb-5 leading-[1.05]">
            {t("heroTitle")}
          </h1>

          <p className="text-lg sm:text-xl text-memorial-300 mb-3 font-light">
            {t("heroSubtitle")}
          </p>

          <p className="text-sm sm:text-base text-memorial-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            {t("heroDescription")}
          </p>

          {/* Search */}
          <div className="flex justify-center mb-16">
            <SearchBar large />
          </div>

          {/* Stats — single editorial-style stat block. The big number is the
              moral weight of the memorial; the secondary line shows how much
              of it is corroborated and where it comes from. Each stat links
              to its evidence: victims, sources, events, timeline, methodology. */}
          <div className="max-w-2xl mx-auto text-center">
            <Link
              href="/victims"
              className="block group"
              aria-label={t("totalVictims")}
            >
              <div className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gold-400 tabular-nums leading-none transition-colors group-hover:text-gold-300">
                {formatNumber(stats.victimCount, locale)}
              </div>
              <div className="mt-3 text-sm sm:text-base text-memorial-400 group-hover:text-memorial-300 transition-colors">
                {t("totalVictims")}
              </div>
            </Link>
            <div className="mt-5 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-memorial-500 tabular-nums">
              <Link href="/sources" className="hover:text-memorial-200 transition-colors">
                <span className="text-memorial-300 font-medium">{formatNumber(stats.sourceCount, locale)}</span>{" "}
                {t("documentedSources")}
              </Link>
              <span className="text-memorial-700">·</span>
              <Link href="/events" className="hover:text-memorial-200 transition-colors">
                <span className="text-memorial-300 font-medium">{formatNumber(stats.eventCount, locale)}</span>{" "}
                {t("totalEvents")}
              </Link>
              <span className="text-memorial-700">·</span>
              <Link href="/timeline" className="hover:text-memorial-200 transition-colors">
                <span className="text-memorial-300 font-medium">{formatNumber(stats.yearsOfRepression, locale)}</span>{" "}
                {t("timespan")}
              </Link>
            </div>
            <div className="mt-3 text-xs text-memorial-600">
              <Link href="/methodology" className="hover:text-gold-400 transition-colors underline-offset-4 hover:underline">
                {(({
                  en: "How we verify",
                  de: "Wie wir verifizieren",
                  fa: "روش تأیید ما",
                  ar: "كيف نتحقق",
                  fr: "Comment nous vérifions",
                  it: "Come verifichiamo",
                  es: "Cómo verificamos",
                  he: "כיצד אנו מאמתים",
                  ru: "Как мы проверяем",
                  tr: "Nasıl doğruluyoruz",
                  ckb: "چۆن پشتڕاست دەکەینەوە",
                  hi: "हम कैसे सत्यापित करते हैं",
                  ur: "ہم کیسے تصدیق کرتے ہیں",
                  sv: "Hur vi verifierar",
                  nl: "Hoe wij verifiëren",
                  zh: "我们如何核实",
                }) as Record<string, string>)[locale] || "How we verify"} &rarr;
              </Link>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/victims"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-6 py-3 text-sm font-medium text-gold-400 hover:bg-gold-500/20 transition-colors"
            >
              {t("browseVictims")}
            </Link>
            <Link
              href="/timeline"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-memorial-700 bg-memorial-800/50 px-6 py-3 text-sm font-medium text-memorial-300 hover:bg-memorial-700 hover:text-memorial-50 transition-colors"
            >
              {t("browseTimeline")}
            </Link>
          </div>
        </div>

        {/* Decorative bottom line */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-t from-transparent via-memorial-700 to-transparent" />
      </section>

      {/* Key Events */}
      {keyEvents.length > 0 && (
        <section className="py-20 px-4">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center gap-4 mb-10">
              <div className="h-px flex-1 bg-memorial-800" />
              <h2 className="text-lg font-semibold text-memorial-200 tracking-wide">
                {t("keyEvents")}
              </h2>
              <div className="h-px flex-1 bg-memorial-800" />
            </div>

            <div className="space-y-3">
              {keyEvents.map((event) => {
                const title = localized(event, "title", locale);
                const killed = formatKilledRange(
                  event.estimatedKilledLow,
                  event.estimatedKilledHigh,
                  locale
                );

                return (
                  <Link
                    key={event.slug}
                    href={`/events/${event.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-lg border border-memorial-800/60 bg-memorial-900/30 px-5 py-4 transition-all hover:border-memorial-600 hover:bg-memorial-800/40"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium text-memorial-200 group-hover:text-gold-400 transition-colors truncate">
                        {title}
                      </h3>
                      <p className="text-xs text-memorial-500 mt-0.5">
                        {new Date(event.dateStart).getFullYear()}
                        {event.dateEnd && event.dateEnd !== event.dateStart
                          ? `–${new Date(event.dateEnd).getFullYear()}`
                          : ""}
                      </p>
                    </div>
                    {killed && (
                      <div className="flex-shrink-0 text-end">
                        <span className="text-lg font-bold text-blood-400">
                          {killed}
                        </span>
                        <span className="text-xs text-memorial-500 ms-1.5">
                          {te("killed")}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/timeline"
                className="text-sm text-memorial-400 hover:text-gold-400 transition-colors"
              >
                {t("viewTimeline")} &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Prominent Victims */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-memorial-800" />
            <h2 className="text-lg font-semibold text-memorial-200 tracking-wide">
              {(({
                en: "Prominent Victims",
                de: "Prominente Opfer",
                fa: "قربانیان شاخص",
                ar: "ضحايا بارزون",
                fr: "Victimes notables",
                it: "Vittime di rilievo",
                es: "Víctimas destacadas",
                he: "קורבנות בולטים",
                ru: "Известные жертвы",
                tr: "Önemli Kurbanlar",
                ckb: "قوربانیانی بەرچاو",
                hi: "प्रमुख पीड़ित",
                ur: "نمایاں متاثرین",
                sv: "Framträdande offer",
                nl: "Prominente slachtoffers",
                zh: "知名受害者",
              }) as Record<string, string>)[locale] || "Prominent Victims"}
            </h2>
            <div className="h-px flex-1 bg-memorial-800" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { slug: "sharmahd-jamshid-2024", year: "2024", label: { en: "German-Iranian dissident, abducted in Dubai 2020", de: "Deutsch-iranischer Dissident, 2020 in Dubai entführt", fa: "مخالف آلمانی-ایرانی، ربوده شده در دبی ۲۰۲۰" } },
              { slug: "karami-mohammad-mahdi-2023", year: "2023", label: { en: "National karate champion, 21 years old, WLF protests", de: "Nationaler Karate-Meister, 21 Jahre, WLF-Proteste", fa: "قهرمان ملی کاراته، ۲۱ ساله، اعتراضات ZZA" } },
              { slug: "ghobadlou-mohammad-2024", year: "2024", label: { en: "Executed despite Supreme Court annulment", de: "Trotz Annullierung durch Oberstes Gericht hingerichtet", fa: "علیرغم نقض حکم توسط دیوان عالی اعدام شد" } },
              { slug: "hosseini-seyed-mohammad-2023", year: "2023", label: { en: "Kickboxing champion, arrested en route to cemetery", de: "Kickbox-Meister, auf dem Weg zum Friedhof verhaftet", fa: "قهرمان کیک‌بوکسینگ، در مسیر قبرستان دستگیر شد" } },
              { slug: "sepehri-fatemeh-2022", year: "2022–", label: { en: "Political activist, 18-year sentence, currently imprisoned", de: "Politische Aktivistin, 18 Jahre Haft, aktuell inhaftiert", fa: "فعال سیاسی، ۱۸ سال حبس، در حال حاضر در زندان" } },
              { slug: "aghilizadeh-mohammad-amin-2026", year: "2026", label: { en: "Teenager, died in custody with gunshot wounds, Jan 2026", de: "Jugendlicher, starb in Haft mit Schusswunden, Jan 2026", fa: "نوجوان، در بازداشت با زخم گلوله درگذشت، ژانویه ۲۰۲۶" } },
            ].map((c) => (
              <Link
                key={c.slug}
                href={`/victims/${c.slug}`}
                className="group rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 hover:border-gold-500/30 hover:bg-memorial-800/40 transition-all"
              >
                <div className="text-xs text-memorial-500 mb-1">{c.year}</div>
                <div className="text-sm font-medium text-memorial-200 group-hover:text-gold-400 transition-colors">
                  {c.slug.split("-").slice(0, -1).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")}
                </div>
                <p className="text-xs text-memorial-500 mt-1 leading-relaxed">
                  {c.label[locale as keyof typeof c.label] || c.label.en}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/victims?verified=true" className="text-sm text-memorial-400 hover:text-gold-400 transition-colors">
              {(({
                en: "All verified cases →",
                de: "Alle verifizierten Fälle →",
                fa: "تمام موارد تأیید شده ←",
                ar: "كل الحالات الموثقة ←",
                fr: "Tous les cas vérifiés →",
                it: "Tutti i casi verificati →",
                es: "Todos los casos verificados →",
                he: "כל המקרים המאומתים ←",
                ru: "Все подтверждённые случаи →",
                tr: "Tüm doğrulanmış vakalar →",
                ckb: "هەموو حاڵەتە پشتڕاستکراوەکان ←",
                hi: "सभी सत्यापित मामले →",
                ur: "تمام تصدیق شدہ کیسز ←",
                sv: "Alla verifierade fall →",
                nl: "Alle geverifieerde gevallen →",
                zh: "所有已核实的案例 →",
              }) as Record<string, string>)[locale] || "All verified cases →"}
            </Link>
          </div>
        </div>
      </section>

      {/* Why This Matters */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-memorial-800/60 bg-gradient-to-br from-memorial-900/60 to-memorial-950 p-8 sm:p-12">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-semibold text-memorial-100 mb-4">
                  {t("whyMatters")}
                </h2>
                <p className="text-memorial-400 leading-relaxed mb-6">
                  {t("whyMattersText")}
                </p>
                <Link
                  href="/about"
                  className="text-sm text-gold-400 hover:text-gold-300 transition-colors"
                >
                  {t("learnMore")} &rarr;
                </Link>
              </div>
              <div className="flex-shrink-0 grid grid-cols-2 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gold-400 tabular-nums">
                    {formatNumber(stats.victimCount, locale)}
                  </div>
                  <div className="text-xs text-memorial-500 mt-1">{t("totalVictims")}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gold-400 tabular-nums">
                    {formatNumber(stats.sourceCount, locale)}
                  </div>
                  <div className="text-xs text-memorial-500 mt-1">{t("documentedSources")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recently Added Victims */}
      {recentVictims.length > 0 && (
        <section className="py-20 px-4 bg-memorial-900/20">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center gap-4 mb-10">
              <div className="h-px flex-1 bg-memorial-800" />
              <h2 className="text-lg font-semibold text-memorial-200 tracking-wide">
                {t("recentlyAdded")}
              </h2>
              <div className="h-px flex-1 bg-memorial-800" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentVictims.map((victim) => (
                <VictimCard
                  key={victim.slug}
                  slug={victim.slug}
                  nameLatin={victim.nameLatin}
                  nameFarsi={victim.nameFarsi}
                  dateOfDeath={victim.dateOfDeath}
                  placeOfDeath={victim.city ? localized(victim.city, "name", locale) : victim.placeOfDeath}
                  causeOfDeath={victim.causeOfDeath}
                  photoUrl={victim.photoUrl}
                  locale={locale}
                  verificationStatus={victim.verificationStatus}
                />
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/victims"
                className="text-sm text-memorial-400 hover:text-gold-400 transition-colors"
              >
                {t("browseVictims")} &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA: Submit Information */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-gold-500)_0%,_transparent_70%)] opacity-[0.03]" />
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="rounded-xl border border-gold-500/20 bg-memorial-900/40 p-10 sm:p-14">
            <span className="text-4xl candle-flicker inline-block mb-5">🕯</span>
            <h2 className="text-xl sm:text-2xl font-semibold text-memorial-100 mb-3">
              {t("submitInfo")}
            </h2>
            <p className="text-memorial-400 text-sm mb-8 leading-relaxed max-w-lg mx-auto">
              {t("submitInfoDescription")}
            </p>
            <Link
              href="/submit"
              className="inline-flex items-center justify-center rounded-lg border border-gold-500/30 bg-gold-500/10 px-8 py-3.5 text-sm font-medium text-gold-400 hover:bg-gold-500/20 transition-colors"
            >
              {t("submitInfo")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
