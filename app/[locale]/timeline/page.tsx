import { setRequestLocale } from "next-intl/server";
import { getAllEvents } from "@/lib/queries";
import type { Locale } from "@/i18n/config";
import { InteractiveTimeline } from "@/components/InteractiveTimeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const events = await getAllEvents();

  return <InteractiveTimeline events={events} locale={locale as Locale} />;
}
