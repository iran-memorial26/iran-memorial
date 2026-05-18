import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getAllEvents, localized } from "@/lib/queries";
import { formatDateRange, formatKilledRange } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const events = await getAllEvents();

  return <EventsList events={events} locale={locale as Locale} />;
}

function EventsList({ events, locale }: { events: any[]; locale: Locale }) {
  const t = useTranslations("common");
  const te = useTranslations("event");
  const tt = useTranslations("timeline");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-memorial-50 mb-2">
          {t("events")}
        </h1>
        <p className="text-memorial-400">{tt("subtitle")}</p>
      </div>

      {events.length === 0 ? (
        <p className="text-memorial-400 py-12 text-center">{t("noResults")}</p>
      ) : (
        <div className="space-y-4">
          {events.map((event: any) => {
            const title = localized(event, "title", locale);
            const description = localized(event, "description", locale);
            const killed = formatKilledRange(event.estimatedKilledLow, event.estimatedKilledHigh, locale);

            return (
              <Link
                key={event.slug}
                href={`/events/${event.slug}`}
                className="group block rounded-lg border border-memorial-800/60 bg-memorial-900/40 p-6 transition-all hover:border-memorial-600 hover:bg-memorial-800/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-memorial-100 group-hover:text-gold-400 transition-colors">
                      {title}
                    </h2>
                    <p className="text-sm text-memorial-500 mt-1">
                      {formatDateRange(event.dateStart, event.dateEnd, locale)}
                    </p>
                    {description && (
                      <p className="text-sm text-memorial-300 mt-3 line-clamp-2 leading-relaxed">
                        {description}
                      </p>
                    )}
                    {event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {event.tags.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded bg-memorial-800 text-memorial-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {killed && (
                    <div className="text-end flex-shrink-0">
                      <div className="text-2xl font-bold text-blood-400 tabular-nums">{killed}</div>
                      <div className="text-xs text-memorial-500">{te("estimatedKilled")}</div>
                    </div>
                  )}
                </div>
                {event._count?.victims > 0 && (
                  <div className="mt-4 pt-3 border-t border-memorial-800/50">
                    <p className="text-xs text-memorial-500">
                      {te("relatedVictims")}: <span className="text-memorial-300">{event._count.victims}</span>
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
