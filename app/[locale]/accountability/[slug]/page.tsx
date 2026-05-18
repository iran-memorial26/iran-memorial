import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { VictimCard } from "@/components/VictimCard";
import { getAccountabilityAggregates, getVictimsByResponsibleParty } from "@/lib/queries";
import { findPartyBySlug } from "@/lib/accountability";
import { getJudgeProfile } from "@/lib/judges-profiles";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

const BACK_LBL: Record<string, string> = {
  en: "← Back to Accountability", de: "← Zurück zu Rechenschaft",
  fa: "→ بازگشت به پاسخگویی", ar: "→ العودة إلى المساءلة",
  fr: "← Retour à la responsabilité", it: "← Torna a Responsabilità", es: "← Volver a Rendición",
};
const CASES_LBL: Record<string, string> = {
  en: "documented cases", de: "dokumentierte Fälle",
  fa: "مورد مستند", ar: "حالات موثقة",
  fr: "cas documentés", it: "casi documentati", es: "casos documentados",
};
const CASES_HEADING_LBL: Record<string, string> = {
  en: "Documented cases on this memorial",
  de: "Dokumentierte Fälle auf diesem Mahnmal",
  fa: "موارد مستند در این یادبود",
};

const FLAGS: Record<string, string> = {
  US: "🇺🇸", EU: "🇪🇺", UK: "🇬🇧", Canada: "🇨🇦", Switzerland: "🇨🇭",
};

export default async function AccountabilityPartyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const aggregates = await getAccountabilityAggregates();
  const party = findPartyBySlug(slug, aggregates);
  if (!party) notFound();

  const page = Math.max(1, Number(sp.page) || 1);
  const result = await getVictimsByResponsibleParty(party.name, page);

  const isCourt = party.kind === "court";
  const heading = isCourt ? party.name : `Judge ${party.name}`;
  const judgeProfile = !isCourt ? getJudgeProfile(slug) : undefined;

  const bio =
    judgeProfile && (locale === "de" && judgeProfile.bioDe ? judgeProfile.bioDe : judgeProfile.bio);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link
        href="/accountability"
        className="text-sm text-memorial-500 hover:text-memorial-200 mb-6 inline-block"
      >
        {BACK_LBL[locale] || BACK_LBL.en}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row gap-6 items-start">
        {judgeProfile?.photoUrl && (
          <div className="relative h-32 w-32 sm:h-40 sm:w-40 flex-shrink-0 rounded-lg overflow-hidden ring-1 ring-memorial-700/50 bg-memorial-800">
            <Image
              src={judgeProfile.photoUrl}
              alt={judgeProfile.fullName}
              fill
              sizes="160px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="inline-block px-2 py-0.5 rounded text-xs uppercase tracking-wider bg-blood-400/10 text-blood-300 border border-blood-400/30 mb-3">
            {party.kind === "court" ? "⚖ Court" : "👤 Judge"}
          </span>
          <h1 className="text-3xl font-bold text-memorial-100 mb-1">{heading}</h1>
          {judgeProfile && (
            <p className="text-memorial-400 text-sm mb-2">{judgeProfile.role}</p>
          )}
          {judgeProfile?.tagline && (
            <p className="text-memorial-300 text-sm italic mb-3 max-w-3xl">{judgeProfile.tagline}</p>
          )}
          {judgeProfile?.born && (
            <p className="text-xs text-memorial-500">
              Born {judgeProfile.born}
              {judgeProfile.birthplace ? ` · ${judgeProfile.birthplace}` : ""}
              {judgeProfile.aliases.length > 0 && (
                <span className="ms-3">Aliases: {judgeProfile.aliases.join(", ")}</span>
              )}
            </p>
          )}
          <p className="text-memorial-400 text-sm mt-3">
            <span className="text-memorial-500">{CASES_LBL[locale] || CASES_LBL.en}:</span>{" "}
            <strong className="text-memorial-200">{formatNumber(result.total, locale as Locale)}</strong>
          </p>
        </div>
      </div>

      {/* Sanctions block — only for judges with profile */}
      {judgeProfile && judgeProfile.sanctions.length > 0 && (
        <section className="mb-10 rounded-xl border border-blood-400/30 bg-blood-400/5 p-5">
          <h2 className="text-sm uppercase tracking-wider text-blood-300 font-semibold mb-3">
            International Sanctions
          </h2>
          <ul className="space-y-2">
            {judgeProfile.sanctions.map((s) => (
              <li key={`${s.jurisdiction}-${s.listedOn}`} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-2xl leading-none">{FLAGS[s.jurisdiction] || "🏳"}</span>
                <strong className="text-memorial-100">{s.jurisdiction}</strong>
                <span className="text-memorial-500">listed {s.listedOn}</span>
                <span className="text-memorial-300">— {s.program}</span>
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gold-400 hover:underline"
                >
                  source ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bio */}
      {bio && (
        <section className="mb-10 max-w-3xl">
          <h2 className="text-sm uppercase tracking-wider text-memorial-400 font-semibold mb-3">
            Biography
          </h2>
          <div className="text-memorial-200 text-sm leading-relaxed space-y-3">
            {bio.split(/\n\n+/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {/* Notable cases beyond what's in our DB */}
      {judgeProfile && judgeProfile.notableCases.length > 0 && (
        <section className="mb-10 max-w-3xl">
          <h2 className="text-sm uppercase tracking-wider text-memorial-400 font-semibold mb-3">
            Notable Trials &amp; Verdicts
          </h2>
          <ul className="space-y-2 text-sm text-memorial-300">
            {judgeProfile.notableCases.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-gold-400 font-mono text-xs w-12 flex-shrink-0 mt-0.5">{c.year}</span>
                <span>{c.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* External sources */}
      {judgeProfile && judgeProfile.externalSources.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wider text-memorial-400 font-semibold mb-3">
            External Profiles
          </h2>
          <ul className="flex flex-wrap gap-2">
            {judgeProfile.externalSources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-memorial-700 text-memorial-300 text-xs hover:bg-memorial-800 hover:text-gold-400 transition-colors"
                >
                  {s.name} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cases */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-memorial-400 font-semibold mb-4">
          {CASES_HEADING_LBL[locale] || CASES_HEADING_LBL.en} ({formatNumber(result.total, locale as Locale)})
        </h2>
        {result.victims.length === 0 ? (
          <p className="text-memorial-400 py-12 text-center">No cases found.</p>
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
                  <Link href={`/accountability/${slug}?page=${page - 1}`} className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm">&larr;</Link>
                )}
                <span className="px-4 py-2 text-memorial-400 text-sm">{page} / {result.totalPages}</span>
                {page < result.totalPages && (
                  <Link href={`/accountability/${slug}?page=${page + 1}`} className="px-3 py-2 rounded-md border border-memorial-700 text-memorial-300 hover:bg-memorial-800 text-sm">&rarr;</Link>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
