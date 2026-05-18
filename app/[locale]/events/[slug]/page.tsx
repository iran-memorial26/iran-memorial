import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getEventBySlug, getEventStatistics, localized, type EventStatistics as EventStatsData } from "@/lib/queries";
import { SITE_URL } from "@/lib/site-url";
import { formatDateRange, formatKilledRange } from "@/lib/utils";
import { VictimCard } from "@/components/VictimCard";
import { EventHero } from "@/components/EventHero";
import { PhotoGallery } from "@/components/PhotoGallery";
import { EventStatistics } from "@/components/EventStatistics";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const event = await getEventBySlug(slug);
    if (!event) return { title: "Not Found" };
    const title = localized(event, "title", locale as Locale) || event.titleEn;
    const description = localized(event, "description", locale as Locale)?.slice(0, 160) || event.descriptionEn?.slice(0, 160);
    // Dynamic OG image card at /og/event/[slug] — branded layout with title,
    // year range, description, killed + documented counters. Mirrors the
    // victim card so /events and /victims look like one product on social.
    const ogImage = `${SITE_URL}/og/event/${slug}?lang=${locale}`;
    return {
      title,
      description,
      openGraph: {
        title: title || "Event",
        description: description || undefined,
        url: `${SITE_URL}/${locale}/events/${slug}`,
        siteName: "Iran Memorial",
        type: "article",
        locale: locale === "fa" ? "fa_IR" : locale === "de" ? "de_DE" : locale === "ar" ? "ar_IR" : "en_US",
        images: [{ url: ogImage, alt: title || "Event", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: title || "Event",
        description: description || undefined,
        // site omitted until @iran_memorial handle is claimed.
        images: [ogImage],
      },
    };
  } catch {
    return { title: "Event" };
  }
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params;
  const { page: pageStr } = await searchParams;
  setRequestLocale(locale);

  const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);

  let event: any;
  try {
    event = await getEventBySlug(slug, page);
  } catch {
    notFound();
  }
  if (!event) notFound();

  // Fetch event statistics only if event has >= 10 victims
  let eventStats: EventStatsData | null = null;
  if (event.totalVictims >= 10) {
    try {
      eventStats = await getEventStatistics(event.id, locale as Locale);
    } catch {
      eventStats = null;
    }
  }

  return <EventDetail event={event} locale={locale as Locale} slug={slug} statistics={eventStats} />;
}

function EventDetail({ event, locale, slug, statistics }: { event: any; locale: Locale; slug: string; statistics: EventStatsData | null }) {
  const t = useTranslations("event");
  const tv = useTranslations("victim");
  const tc = useTranslations("common");

  const title = localized(event, "title", locale);
  const description = localized(event, "description", locale);
  const killed = formatKilledRange(event.estimatedKilledLow, event.estimatedKilledHigh, locale);
  const { page, totalPages, totalVictims } = event;
  const primaryPhoto = event.photos?.find((p: any) => p.isPrimary) || event.photos?.[0];

  return (
    <div>
      {/* Hero */}
      <EventHero title={title || ""} photoUrl={primaryPhoto?.url}>
          <h1 className="text-3xl sm:text-4xl font-bold text-memorial-50 mb-3">{title}</h1>
          <p className="text-memorial-400 mb-6">
            {formatDateRange(event.dateStart, event.dateEnd, locale)}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {killed && (
              <div className="inline-flex items-baseline gap-2 rounded-lg border border-blood-600/30 bg-blood-600/10 px-4 py-2.5">
                <span className="text-2xl font-bold text-blood-400 tabular-nums">{killed}</span>
                <span className="text-sm text-memorial-400">{t("estimatedKilled")}</span>
              </div>
            )}
            {totalVictims > 0 && (
              <div className="inline-flex items-baseline gap-2 rounded-lg border border-memorial-700/50 bg-memorial-800/30 px-4 py-2.5">
                <span className="text-2xl font-bold text-gold-400 tabular-nums">{totalVictims}</span>
                <span className="text-sm text-memorial-400">{t("relatedVictims")}</span>
              </div>
            )}
          </div>
      </EventHero>

      <div className="mx-auto max-w-4xl px-4 pb-16">
        <div className="pt-6">
          <Breadcrumbs
            locale={locale}
            items={[
              { label: tc("events"), href: "/events" },
              { label: title || event.titleEn },
            ]}
          />
        </div>

        {/* Description */}
        {description && (
          <section className="py-8 mb-4 space-y-4">
            {description.split('\n\n').map((paragraph: string, i: number) => (
              <p key={i} className="text-memorial-200 leading-relaxed text-lg">
                {paragraph.trim()}
              </p>
            ))}
          </section>
        )}

        {/* Event Photo Gallery */}
        {event.photos && event.photos.length > 1 && (
          <section className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-memorial-200 flex-shrink-0">
                {tv("photos")}
              </h2>
              <div className="h-px flex-1 bg-memorial-800" />
            </div>
            <PhotoGallery
              photos={event.photos}
              name={localized(event, "title", locale) || ""}
              locale={locale}
              labels={{
                photoOf: tv("photoOf"),
                photoCredit: tv("photoCredit"),
                closeGallery: tv("closeGallery"),
                previousPhoto: tv("previousPhoto"),
                nextPhoto: tv("nextPhoto"),
              }}
            />
          </section>
        )}

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {event.tags.map((tag: string) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-memorial-800 text-memorial-400 border border-memorial-700">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Event Statistics */}
        {statistics && (
          <EventStatistics statistics={statistics} locale={locale} />
        )}

        {/* Linked Victims */}
        {event.victims.length > 0 && (
          <section className="mt-4">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-lg font-semibold text-memorial-200 flex-shrink-0">
                {t("relatedVictims")}
              </h2>
              <div className="h-px flex-1 bg-memorial-800" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {event.victims.map((victim: any) => (
                <VictimCard
                  key={victim.slug}
                  slug={victim.slug}
                  nameLatin={victim.nameLatin}
                  nameFarsi={victim.nameFarsi}
                  dateOfDeath={victim.dateOfDeath}
                  placeOfDeath={victim.placeOfDeath}
                  causeOfDeath={victim.causeOfDeath}
                  photoUrl={victim.photoUrl}
                  locale={locale}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination locale={locale} slug={slug} page={page} totalPages={totalPages} />
            )}
          </section>
        )}

        {/* Sources */}
        {event.sources.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-memorial-200 flex-shrink-0">
                {tv("sources")}
              </h2>
              <div className="h-px flex-1 bg-memorial-800" />
            </div>
            <ul className="space-y-2">
              {event.sources.map((source: any) => (
                <li key={source.id} className="text-sm">
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                      {source.name}
                    </a>
                  ) : (
                    <span className="text-memorial-200">{source.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Pagination({ locale, slug, page, totalPages }: { locale: Locale; slug: string; page: number; totalPages: number }) {
  const t = useTranslations("event");
  const basePath = `/${locale}/events/${slug}`;

  // Show max 7 page buttons around current page
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <nav className="mt-8 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={`${basePath}?page=${page - 1}`}
          className="px-3 py-2 text-sm rounded-lg border border-memorial-700 text-memorial-300 hover:bg-memorial-800 transition-colors"
        >
          &larr;
        </Link>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-memorial-500">...</span>
        ) : (
          <Link
            key={p}
            href={`${basePath}${p === 1 ? "" : `?page=${p}`}`}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              p === page
                ? "border-gold-500/50 bg-gold-500/10 text-gold-400 font-medium"
                : "border-memorial-700 text-memorial-300 hover:bg-memorial-800"
            }`}
          >
            {p}
          </Link>
        )
      )}

      {page < totalPages && (
        <Link
          href={`${basePath}?page=${page + 1}`}
          className="px-3 py-2 text-sm rounded-lg border border-memorial-700 text-memorial-300 hover:bg-memorial-800 transition-colors"
        >
          &rarr;
        </Link>
      )}
    </nav>
  );
}
