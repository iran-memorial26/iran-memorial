"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { localized } from "@/lib/queries";
import { formatDate, formatKilledRange } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";

function timeGapRem(yearsDiff: number): number {
  if (yearsDiff <= 0) return 1;
  return Math.min(14, 1 + yearsDiff * 0.7);
}

function yearsBetween(a: Date | string, b: Date | string): number {
  const da = new Date(a);
  const db = new Date(b);
  const diffMs = Math.abs(db.getTime() - da.getTime());
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

function decadeOf(date: Date | string): number {
  return Math.floor(new Date(date).getFullYear() / 10) * 10;
}

function formatDecade(decade: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale, {
    useGrouping: false,
  }).format(decade);
  return `${num}s`;
}

export function InteractiveTimeline({
  events,
  locale,
}: {
  events: any[];
  locale: Locale;
}) {
  const t = useTranslations("timeline");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-24">
      {/* Editorial header */}
      <header className="text-center mb-20 sm:mb-28">
        <div
          aria-hidden
          className="mx-auto mb-8 h-px w-12 bg-gold-500/60"
        />
        <p className="text-[11px] font-sans uppercase tracking-[0.28em] text-memorial-500 mb-5">
          1979 — {new Date().getFullYear()}
        </p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-memorial-50 leading-[1.05] tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-memorial-300 leading-relaxed">
          {t("subtitle")}
        </p>
      </header>

      {events.length === 0 ? (
        <p className="text-memorial-400 py-16 text-center">
          {t("noEvents")}
        </p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div
            aria-hidden
            className="absolute start-4 sm:start-1/2 top-0 bottom-0 w-px timeline-line"
          />

          <ol className="list-none p-0 m-0">
            {events.map((event: any, index: number) => {
              const title = localized(event, "title", locale);
              const killed = formatKilledRange(
                event.estimatedKilledLow,
                event.estimatedKilledHigh,
                locale
              );
              const isLeft = index % 2 === 0;
              const eventPhoto = event.photos?.[0]?.url;
              const description = localized(event, "description", locale);

              const prevStart =
                index > 0 ? events[index - 1].dateStart : null;
              const gap = prevStart
                ? yearsBetween(prevStart, event.dateStart)
                : 0;
              const gapRem = index === 0 ? 0 : timeGapRem(gap);

              const currentDecade = decadeOf(event.dateStart);
              const previousDecade = prevStart ? decadeOf(prevStart) : null;
              const showDecade =
                index === 0 || currentDecade !== previousDecade;

              return (
                <li
                  key={event.slug}
                  style={{ marginTop: index === 0 ? 0 : `${gapRem}rem` }}
                >
                  {showDecade && (
                    <div
                      className="relative flex items-center justify-center mb-10"
                      style={index > 0 ? { marginTop: "1rem" } : undefined}
                    >
                      <span className="relative z-10 px-4 bg-memorial-950 text-xs uppercase tracking-[0.32em] text-gold-400/80 tabular-nums">
                        {formatDecade(currentDecade, locale)}
                      </span>
                    </div>
                  )}

                  <article
                    className={`relative flex items-start gap-8 ${
                      isLeft ? "sm:flex-row" : "sm:flex-row-reverse"
                    }`}
                  >
                    {/* Marker on timeline: outer ring + inner dot */}
                    <span
                      aria-hidden
                      className="absolute start-4 sm:start-1/2 -translate-x-1/2 mt-2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-memorial-950 ring-1 ring-memorial-600"
                    >
                      <span className="block w-1.5 h-1.5 rounded-full bg-blood-500" />
                    </span>

                    {/* Content */}
                    <div
                      className={`ms-12 sm:ms-0 sm:w-[calc(50%-2.25rem)] ${
                        isLeft ? "sm:text-end sm:pe-10" : "sm:ps-10"
                      }`}
                    >
                      <time className="block font-sans text-[11px] uppercase tracking-[0.22em] text-memorial-500 tabular-nums">
                        {formatDate(event.dateStart, locale)}
                      </time>

                      <h2 className="mt-3 text-2xl sm:text-[1.6rem] font-semibold leading-snug">
                        <Link
                          href={`/events/${event.slug}`}
                          className="text-memorial-50 hover:text-gold-300 transition-colors duration-200 outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-gold-400"
                        >
                          {title}
                        </Link>
                      </h2>

                      <div
                        className={`mt-4 flex items-start gap-4 ${
                          isLeft ? "sm:flex-row-reverse sm:text-end" : ""
                        }`}
                      >
                        {eventPhoto && (
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 overflow-hidden bg-memorial-800 ring-1 ring-memorial-700/60">
                            <Image
                              src={eventPhoto}
                              alt=""
                              fill
                              sizes="80px"
                              className="object-cover grayscale opacity-90"
                              unoptimized={eventPhoto.startsWith("https://")}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {description && (
                            <p className="text-[0.95rem] text-memorial-300 leading-relaxed">
                              {truncate(description, 320)}
                            </p>
                          )}
                        </div>
                      </div>

                      {(killed || event._count?.victims > 0) && (
                        <dl
                          className={`mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs ${
                            isLeft ? "sm:justify-end" : ""
                          }`}
                        >
                          {killed && (
                            <div className="flex items-baseline gap-1.5">
                              <dt className="sr-only">{t("killed")}</dt>
                              <dd className="font-sans tabular-nums text-blood-400">
                                {killed}
                              </dd>
                              <span className="font-sans uppercase tracking-[0.18em] text-memorial-500 text-[10px]">
                                {t("killed")}
                              </span>
                            </div>
                          )}
                          {event._count?.victims > 0 && (
                            <div className="flex items-baseline gap-1.5">
                              <dt className="sr-only">{t("documented")}</dt>
                              <dd className="font-sans tabular-nums text-memorial-200">
                                {event._count.victims}
                              </dd>
                              <span className="font-sans uppercase tracking-[0.18em] text-memorial-500 text-[10px]">
                                {t("documented")}
                              </span>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>

                    {/* Spacer for the other side */}
                    <div
                      aria-hidden
                      className="hidden sm:block sm:w-[calc(50%-2.25rem)]"
                    />
                  </article>
                </li>
              );
            })}
          </ol>

          {/* Closing accent */}
          <div
            aria-hidden
            className="relative flex items-center justify-center mt-16"
          >
            <span className="block w-1.5 h-1.5 rounded-full bg-gold-500/60" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Truncate to ~maxChars at the nearest sentence or word boundary, append "…".
 *  The full description still lives on the event detail page, so the timeline
 *  acts as a teaser users click through to read. */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  // Prefer ending at a sentence terminator within the window
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (lastSentence > maxChars * 0.6) return slice.slice(0, lastSentence + 1) + " …";
  // Otherwise fall back to the last word boundary
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + "…";
}
