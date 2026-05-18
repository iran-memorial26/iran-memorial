import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { VictimCard } from "@/components/VictimCard";
import { getAnonymousVictims } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  en: "Anonymous Victims", de: "Anonyme Opfer", fa: "قربانیان ناشناس",
  ar: "ضحايا مجهولون", fr: "Victimes anonymes", it: "Vittime anonime", es: "Víctimas anónimas",
};

const SUBTITLES: Record<string, string> = {
  en: "Victims of mass executions whose names were never recorded or have been lost. Their lives count even if their identities are missing — many were buried in unmarked graves at sites like Khavaran cemetery during the 1988 mass executions of political prisoners. If you can help identify someone, please submit information.",
  de: "Opfer von Massenhinrichtungen, deren Namen nie erfasst oder verloren gegangen sind. Ihre Leben zählen auch ohne Identität — viele wurden während der Massenhinrichtungen politischer Gefangener 1988 in unmarkierten Gräbern an Orten wie dem Khavaran-Friedhof bestattet. Falls du jemanden identifizieren kannst, schicke bitte Informationen.",
  fa: "قربانیان اعدام‌های دسته‌جمعی که نامشان هرگز ثبت نشده یا از بین رفته است. زندگی آن‌ها اهمیت دارد حتی اگر هویتشان از دست رفته باشد — بسیاری در طول اعدام‌های دسته‌جمعی زندانیان سیاسی در سال ۱۳۶۷ در گورهای بی‌نشان در مکان‌هایی مانند گورستان خاوران دفن شدند. اگر می‌توانید کسی را شناسایی کنید، لطفاً اطلاعات را ارسال کنید.",
  ar: "ضحايا الإعدامات الجماعية الذين لم تُسجّل أسماؤهم أو ضاعت. حياتهم مهمة حتى لو غابت هوياتهم — دُفن كثيرون في قبور مجهولة الهوية في مواقع مثل مقبرة خاوران خلال الإعدامات الجماعية للسجناء السياسيين عام 1988.",
  fr: "Victimes d'exécutions massives dont les noms n'ont jamais été enregistrés ou ont été perdus. Leurs vies comptent même si leurs identités manquent — beaucoup ont été enterrés dans des tombes anonymes lors des exécutions massives de prisonniers politiques en 1988.",
  it: "Vittime di esecuzioni di massa i cui nomi non sono mai stati registrati o sono andati perduti. Le loro vite contano anche senza identità — molti furono sepolti in tombe anonime durante le esecuzioni di massa dei prigionieri politici del 1988.",
  es: "Víctimas de ejecuciones masivas cuyos nombres nunca fueron registrados o se han perdido. Sus vidas importan incluso sin identidad — muchos fueron enterrados en tumbas sin nombre durante las ejecuciones masivas de presos políticos de 1988.",
};

const ENTRIES_LABEL: Record<string, string> = {
  en: "anonymous records", de: "anonyme Einträge", fa: "مورد ناشناس",
  ar: "سجلات مجهولة", fr: "entrées anonymes", it: "voci anonime", es: "entradas anónimas",
};

const SUBMIT_LABEL: Record<string, string> = {
  en: "Help identify someone →", de: "Hilf jemanden zu identifizieren →",
  fa: "به شناسایی کمک کنید ←", ar: "ساعد في التعرف على أحدهم ←",
  fr: "Aidez à identifier quelqu'un →", it: "Aiuta a identificare qualcuno →",
  es: "Ayudar a identificar a alguien →",
};

export default async function AnonymousVictimsPage({
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
  const result = await getAnonymousVictims(page);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-memorial-100 mb-3">
          {TITLES[locale] || TITLES.en}
        </h1>
        <p className="text-memorial-400 text-sm max-w-3xl leading-relaxed">
          {SUBTITLES[locale] || SUBTITLES.en}
        </p>
        <p className="text-memorial-500 text-xs mt-3">
          {formatNumber(result.total, locale as Locale)}{" "}
          {ENTRIES_LABEL[locale] || ENTRIES_LABEL.en}
        </p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-300 text-sm hover:bg-gold-500/20 transition-colors"
        >
          {SUBMIT_LABEL[locale] || SUBMIT_LABEL.en}
        </Link>
      </div>

      {result.victims.length === 0 ? (
        <div className="py-20 text-center text-memorial-400">
          <p>{locale === "de" ? "Keine Einträge gefunden." : "No entries found."}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            {result.victims.map((v) => (
              <VictimCard
                key={v.slug}
                slug={v.slug}
                nameLatin={v.nameLatin}
                nameFarsi={v.nameFarsi}
                dateOfDeath={v.dateOfDeath}
                placeOfDeath={v.placeOfDeath}
                causeOfDeath={v.causeOfDeath}
                photoUrl={v.photoUrl}
                locale={locale as Locale}
                verificationStatus={v.verificationStatus}
              />
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              {page > 1 && (
                <Link href={`/anonymous-victims?page=${page - 1}`} className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm">&larr;</Link>
              )}
              <span className="px-4 py-2 text-memorial-400 text-sm">
                {page} / {result.totalPages}
              </span>
              {page < result.totalPages && (
                <Link href={`/anonymous-victims?page=${page + 1}`} className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm">&rarr;</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
