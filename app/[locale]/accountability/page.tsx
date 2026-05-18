import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAccountabilityAggregates } from "@/lib/queries";
import { partySlug } from "@/lib/accountability";
import { HISTORICAL_PERPETRATOR_SLUGS, getJudgeProfile } from "@/lib/judges-profiles";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  en: "Accountability", de: "Rechenschaft", fa: "پاسخگویی",
  ar: "المساءلة", fr: "Responsabilité", it: "Responsabilità", es: "Rendición de cuentas",
};
const SUBTITLES: Record<string, string> = {
  en: "Iranian courts and judges with documented responsibility for executions, organized for sanctions advocacy and journalistic research. Each entry links to the cases attributed to that court or judge.",
  de: "Iranische Gerichte und Richter mit dokumentierter Verantwortung für Hinrichtungen, geordnet für Sanktions-Advocacy und journalistische Recherche. Jeder Eintrag verlinkt zu den ihm zugeordneten Fällen.",
  fa: "دادگاه‌ها و قضات ایرانی با مسئولیت مستند شده در اعدام‌ها، سازماندهی شده برای دفاع از تحریم‌ها و تحقیقات روزنامه‌نگاری.",
  ar: "المحاكم والقضاة الإيرانيون ذوو المسؤولية الموثقة عن الإعدامات.",
  fr: "Tribunaux et juges iraniens dont la responsabilité dans les exécutions est documentée.",
  it: "Tribunali e giudici iraniani con responsabilità documentata nelle esecuzioni.",
  es: "Tribunales y jueces iraníes con responsabilidad documentada en las ejecuciones.",
};
const COURTS_HEADING: Record<string, string> = {
  en: "Courts", de: "Gerichte", fa: "دادگاه‌ها", ar: "المحاكم",
  fr: "Tribunaux", it: "Tribunali", es: "Tribunales",
};
const JUDGES_HEADING: Record<string, string> = {
  en: "Judges", de: "Richter", fa: "قضات", ar: "القضاة",
  fr: "Juges", it: "Giudici", es: "Jueces",
};
const CASES_LBL: Record<string, string> = {
  en: "cases", de: "Fälle", fa: "مورد", ar: "حالات",
  fr: "cas", it: "casi", es: "casos",
};

export default async function AccountabilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getAccountabilityAggregates();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-memorial-100 mb-2">
          ⚖ {TITLES[locale] || TITLES.en}
        </h1>
        <p className="text-memorial-400 text-sm max-w-3xl leading-relaxed">
          {SUBTITLES[locale] || SUBTITLES.en}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Courts */}
        <section>
          <h2 className="text-xl font-semibold text-gold-400 mb-4">
            {COURTS_HEADING[locale] || COURTS_HEADING.en}{" "}
            <span className="text-memorial-500 text-sm font-normal">({data.courts.length})</span>
          </h2>
          <ul className="space-y-2">
            {data.courts.map((c) => (
              <li key={c.name}>
                <Link
                  href={`/accountability/${partySlug(c.name)}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-memorial-800 bg-memorial-900/50 hover:bg-memorial-800/50 hover:border-blood-400/40 transition-colors group"
                >
                  <span className="text-sm text-memorial-200 group-hover:text-blood-200">
                    {c.name}
                  </span>
                  <span className="text-xs text-memorial-500 tabular-nums whitespace-nowrap">
                    {formatNumber(c.count, locale as Locale)} {CASES_LBL[locale] || CASES_LBL.en}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Judges */}
        <section>
          <h2 className="text-xl font-semibold text-gold-400 mb-4">
            {JUDGES_HEADING[locale] || JUDGES_HEADING.en}{" "}
            <span className="text-memorial-500 text-sm font-normal">({data.judges.length})</span>
          </h2>
          {data.judges.length === 0 ? (
            <p className="text-memorial-400 text-sm">
              {locale === "de" ? "Keine spezifischen Richter dokumentiert." : "No specific judges documented yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {data.judges.map((j) => (
                <li key={j.name}>
                  <Link
                    href={`/accountability/${partySlug(j.name)}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-blood-400/20 bg-blood-400/5 hover:bg-blood-400/10 hover:border-blood-400/40 transition-colors group"
                  >
                    <span className="text-sm text-blood-200 group-hover:text-blood-100 font-medium">
                      Judge {j.name}
                    </span>
                    <span className="text-xs text-memorial-500 tabular-nums whitespace-nowrap">
                      {formatNumber(j.count, locale as Locale)} {CASES_LBL[locale] || CASES_LBL.en}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Notable Historical Perpetrators — judges with hand-curated profiles
          who don't appear in the auto-extracted list because per-victim
          attribution doesn't exist in our records. */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-blood-300 mb-2">
          {locale === "de" ? "Bekannte historische Täter" : "Notable Historical Perpetrators"}
        </h2>
        <p className="text-memorial-400 text-sm max-w-3xl mb-4">
          {locale === "de"
            ? "Die vier Mitglieder der Teheraner \"Todeskommission\" von 1988 — kollektiv verantwortlich für 2.800-5.000 Hinrichtungen jenes Sommers (Schätzung Amnesty / HRW). Die Boroumand-Daten enthalten keine richterspezifische Zuordnung pro Opfer; deshalb sind sie hier separat aufgeführt."
            : "The four members of Tehran's 1988 \"Death Commission\" — collectively responsible for 2,800-5,000 executions that summer (Amnesty / HRW estimate). The Boroumand corpus does not record per-victim judge attribution; they are listed separately here."}
        </p>
        <ul className="grid sm:grid-cols-2 gap-2">
          {HISTORICAL_PERPETRATOR_SLUGS.map((slug) => {
            const p = getJudgeProfile(slug);
            if (!p) return null;
            return (
              <li key={slug}>
                <Link
                  href={`/accountability/${slug}`}
                  className="flex flex-col gap-1 px-3 py-2 rounded-md border border-blood-400/20 bg-blood-400/5 hover:bg-blood-400/10 hover:border-blood-400/40 transition-colors group"
                >
                  <span className="text-sm text-blood-200 group-hover:text-blood-100 font-medium">
                    {p.fullName}
                  </span>
                  <span className="text-xs text-memorial-500">{p.role}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-12 p-4 rounded-lg border border-memorial-800 bg-memorial-900/40 text-xs text-memorial-500 max-w-3xl">
        <strong className="text-memorial-300">
          {locale === "de" ? "Anmerkung zur Methodik:" : "Methodology note:"}
        </strong>{" "}
        {locale === "de"
          ? "Die obere Aggregation basiert auf dem Feld responsible_forces unserer verifizierten Profile. Generische Begriffe (\"Sicherheitskräfte der Islamischen Republik\") werden ausgespart. Historische Täter ohne per-Opfer-Zuordnung sind im Block \"Bekannte historische Täter\" handgepflegt aufgeführt."
          : "The top aggregation is extracted from the responsible_forces field of our verified profiles. Generic terms (\"Islamic Republic security forces\") are excluded. Historical perpetrators without per-victim attribution are listed in the curated \"Notable Historical Perpetrators\" block."}
      </div>
    </div>
  );
}
