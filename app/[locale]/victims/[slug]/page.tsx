import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getVictimBySlug, getRelatedVictims, getSlugRedirect, getVictimPivots, getAccountabilityAggregates, localized } from "@/lib/queries";
import { partySlug } from "@/lib/accountability";
import { MemorialPhoto } from "@/components/MemorialPhoto";
import { SITE_URL } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/safe-json-ld";
import { PhotoGallery } from "@/components/PhotoGallery";
import { CommentSection } from "@/components/CommentSection";
import { ShareButtons } from "@/components/ShareButtons";
import { CitationBlock } from "@/components/CitationBlock";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CiteRefs } from "@/components/CiteRefs";
import { AccountabilityChips } from "@/components/AccountabilityChips";
import { VictimPivots } from "@/components/VictimPivots";
import { LetterGenerator } from "@/components/LetterGenerator";
import { SocialLinks } from "@/components/SocialLinks";
import { formatDate } from "@/lib/utils";
import { translateCause } from "@/lib/translate";
import { getCaseStatus, STATUS_CONFIG } from "@/lib/status";
import { badgeForSource } from "@/lib/credibility";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

const metaFallback: Record<string, string> = {
  en: "Memorial page for",
  de: "Gedenkseite für",
  fa: "صفحه یادبود",
};

// One-off inline label maps for the Education section heading + fields. Inline
// rather than message-file because (a) this is a single section, (b) the i18n
// file is currently owned by a parallel agent, (c) matches the existing
// inline-literal pattern (see "Prominent Victims" in app/[locale]/page.tsx).
const EDUCATION_HEADING: Record<string, string> = {
  en: "Education", de: "Ausbildung", fa: "تحصیلات", ar: "التعليم",
  fr: "Études", it: "Istruzione", es: "Educación", he: "השכלה",
  ru: "Образование", tr: "Eğitim", ckb: "خوێندن", hi: "शिक्षा",
  ur: "تعلیم", sv: "Utbildning", nl: "Opleiding", zh: "教育",
};

const EDUCATION_LABELS = {
  field: {
    en: "Field of study", de: "Studienfach", fa: "رشته تحصیلی", ar: "مجال الدراسة",
    fr: "Domaine d'études", it: "Campo di studio", es: "Campo de estudio", he: "תחום לימודים",
    ru: "Область обучения", tr: "Çalışma alanı", ckb: "بواری خوێندن", hi: "अध्ययन क्षेत्र",
    ur: "شعبہ تعلیم", sv: "Studieområde", nl: "Studierichting", zh: "研究领域",
  } as Record<string, string>,
  university: {
    en: "University", de: "Universität", fa: "دانشگاه", ar: "الجامعة",
    fr: "Université", it: "Università", es: "Universidad", he: "אוניברסיטה",
    ru: "Университет", tr: "Üniversite", ckb: "زانکۆ", hi: "विश्वविद्यालय",
    ur: "یونیورسٹی", sv: "Universitet", nl: "Universiteit", zh: "大学",
  } as Record<string, string>,
  city: {
    en: "City", de: "Stadt", fa: "شهر", ar: "المدينة",
    fr: "Ville", it: "Città", es: "Ciudad", he: "עיר",
    ru: "Город", tr: "Şehir", ckb: "شار", hi: "शहर",
    ur: "شہر", sv: "Stad", nl: "Stad", zh: "城市",
  } as Record<string, string>,
  degree: {
    en: "Degree", de: "Abschluss", fa: "مدرک", ar: "الدرجة",
    fr: "Diplôme", it: "Titolo", es: "Título", he: "תואר",
    ru: "Степень", tr: "Derece", ckb: "بڕوانامە", hi: "डिग्री",
    ur: "ڈگری", sv: "Examen", nl: "Diploma", zh: "学位",
  } as Record<string, string>,
  graduation: {
    en: "Graduation year", de: "Abschlussjahr", fa: "سال فارغ‌التحصیلی", ar: "سنة التخرج",
    fr: "Année de diplôme", it: "Anno di laurea", es: "Año de graduación", he: "שנת סיום",
    ru: "Год выпуска", tr: "Mezuniyet yılı", ckb: "ساڵی دەرچوون", hi: "स्नातक वर्ष",
    ur: "سنِ فراغت", sv: "Examensår", nl: "Afstudeerjaar", zh: "毕业年份",
  } as Record<string, string>,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const victim = await getVictimBySlug(slug);
    if (!victim) return { title: "Not Found" };
    const name = locale === "fa" && victim.nameFarsi ? victim.nameFarsi : victim.nameLatin;
    const secondaryName = locale === "fa" ? victim.nameLatin : victim.nameFarsi;
    const circumstances = localized(victim, "circumstances", locale as Locale);
    const desc = circumstances?.slice(0, 200) || `${metaFallback[locale] || metaFallback.en} ${name}`;

    // Status prefix for OG/Twitter title — drives engagement on social shares
    const cause = (victim.causeOfDeath || "").toLowerCase();
    let statusPrefix = "";
    if (cause.includes("execution") || cause.includes("hanging")) {
      statusPrefix = locale === "de" ? "Hingerichtet: " : locale === "fa" ? "اعدام شده: " : "Executed: ";
    } else if (cause.includes("imprisoned")) {
      statusPrefix = locale === "de" ? "Inhaftiert: " : locale === "fa" ? "زندانی: " : "Imprisoned: ";
    } else if (cause.includes("disappear")) {
      statusPrefix = locale === "de" ? "Verschwunden: " : locale === "fa" ? "ناپدید شده: " : "Disappeared: ";
    } else if (victim.dateOfDeath) {
      statusPrefix = locale === "de" ? "Im Gedenken: " : locale === "fa" ? "به یاد: " : "In Memory: ";
    }

    // Dynamic OG image card composed at /og/victim/[slug] — branded layout
    // with photo, name, dates, status badge, tagline. Always 1200x630, always
    // a memorial impression (no plain photo crops, no missing-image fallback).
    const ogImage = `${SITE_URL}/og/victim/${slug}?lang=${locale}`;
    return {
      title: `${name}${secondaryName ? ` — ${secondaryName}` : ""}`,
      description: desc,
      openGraph: {
        title: `${statusPrefix}${name}`,
        description: desc,
        url: `${SITE_URL}/${locale}/victims/${slug}`,
        siteName: "Iran Memorial",
        type: "profile",
        locale: locale === "fa" ? "fa_IR" : locale === "de" ? "de_DE" : locale === "ar" ? "ar_IR" : "en_US",
        images: [{ url: ogImage, alt: name, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: `${statusPrefix}${name}`,
        description: desc,
        // site: "@iran_memorial" omitted until the handle is claimed
        // (see lib/features.ts ENABLE_TWITTER_INTEGRATION).
        images: [ogImage],
      },
      alternates: {
        canonical: `${SITE_URL}/${locale}/victims/${slug}`,
        languages: {
          en: `${SITE_URL}/en/victims/${slug}`,
          de: `${SITE_URL}/de/victims/${slug}`,
          fa: `${SITE_URL}/fa/victims/${slug}`,
        },
      },
    };
  } catch {
    return { title: "Victim" };
  }
}

export default async function VictimPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  let victim: any;
  try {
    victim = await getVictimBySlug(slug);
  } catch {
    notFound();
  }
  if (!victim) {
    // Slug miss — check if this is a known redirect from a merged duplicate
    // or a renamed slug. permanentRedirect issues a 308 which preserves the
    // method and is treated as permanent by every modern crawler.
    const redirect = await getSlugRedirect(slug);
    if (redirect) {
      permanentRedirect(`/${locale}/victims/${redirect.toSlug}`);
    }
    notFound();
  }

  // Load related victims (same event) + pivot counts + accountability
  // aggregates in parallel. Aggregates feed AccountabilityChips, which
  // turns judge/court names mentioned in responsibleForces into links
  // when a matching /accountability/<slug> page exists.
  const [relatedVictims, pivots, accountabilityAggregates] = await Promise.all([
    victim.event
      ? getRelatedVictims(victim.event.id, victim.slug, 6)
      : Promise.resolve([]),
    getVictimPivots(victim).catch(() => ({
      province: null,
      year: null,
      yearCaseType: null,
    })),
    getAccountabilityAggregates().catch(() => ({ courts: [], judges: [] })),
  ]);

  // Build a Set of slugs for which an accountability profile exists, so the
  // chips component can suppress chips that would 404.
  const knownPerpSlugs = new Set<string>([
    ...accountabilityAggregates.courts.map((c: { name: string }) => partySlug(c.name)),
    ...accountabilityAggregates.judges.map((j: { name: string }) => partySlug(j.name)),
    // Also add the surname slugs for judges — extractPerpetrators uses
    // surname-only matching to stay tolerant of full-name variation.
    ...accountabilityAggregates.judges.map((j: { name: string }) =>
      partySlug(j.name.split(/\s+/).pop() || "")
    ),
  ]);

  // JSON-LD structured data for SEO
  const baseUrl = SITE_URL;
  const canonicalUrl = `${baseUrl}/${locale}/victims/${victim.slug}`;
  // Build sameAs from sources + social/web links. rel="me"-style identity
  // verification on the page itself is the user-facing side; schema.org sameAs
  // is the machine-readable counterpart. Cap at 10 to keep payload lean.
  const sourceUrls: string[] = (victim.sources ?? [])
    .map((s: any) => s.url)
    .filter((u: unknown): u is string => typeof u === "string" && u.length > 0);
  const socialUrls: string[] = [
    victim.instagramHandle && `https://www.instagram.com/${String(victim.instagramHandle).replace(/^@/, "")}`,
    victim.xHandle && `https://x.com/${String(victim.xHandle).replace(/^@/, "")}`,
    victim.githubHandle && `https://github.com/${String(victim.githubHandle).replace(/^@/, "")}`,
    victim.telegramHandle && `https://t.me/${String(victim.telegramHandle).replace(/^@/, "")}`,
    victim.facebookUrl,
    victim.youtubeChannelUrl,
    victim.websiteUrl,
    victim.linkedinUrl,
  ].filter((u: unknown): u is string => typeof u === "string" && u.length > 0);
  const sameAs: string[] = Array.from(new Set([...sourceUrls, ...socialUrls])).slice(0, 10);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": canonicalUrl,
    name: victim.nameLatin,
    url: canonicalUrl,
    nationality: { "@type": "Country", name: "Iran" },
  };
  if (victim.nameFarsi) jsonLd.alternateName = victim.nameFarsi;
  if (victim.dateOfBirth) {
    jsonLd.birthDate = new Date(victim.dateOfBirth).toISOString().split("T")[0];
  }
  if (victim.dateOfDeath) {
    jsonLd.deathDate = new Date(victim.dateOfDeath).toISOString().split("T")[0];
  }
  const deathPlace = victim.city
    ? `${victim.city.nameEn}${victim.city.province ? `, ${victim.city.province.nameEn}` : ""}`
    : victim.placeOfDeath;
  if (deathPlace) {
    jsonLd.deathPlace = { "@type": "Place", name: deathPlace };
  }
  if (victim.gender) {
    // Schema.org accepts "Male"/"Female" strings or GenderType URLs
    const g = String(victim.gender).toLowerCase();
    if (g === "male" || g === "female") {
      jsonLd.gender = g === "male" ? "Male" : "Female";
    }
  }
  const image = victim.photos?.[0]?.url || victim.photoUrl;
  if (image) jsonLd.image = image;
  const desc = localized(victim, "circumstances", locale as Locale)?.slice(0, 200);
  if (desc) jsonLd.description = desc;
  if (sameAs.length) jsonLd.sameAs = sameAs;

  // Occupation — schema.org hasOccupation. Locale-aware fallback.
  const occupationName: string | undefined =
    victim.occupationEn ?? victim.occupationFa ?? victim.occupationDe;
  if (occupationName) {
    jsonLd.hasOccupation = { "@type": "Occupation", name: occupationName };
  }

  // Education — alumniOf as EducationalOrganization. universityCity gets
  // wrapped in PostalAddress with IR country code (all Iranian universities).
  if (victim.universityName) {
    const alumniOf: Record<string, unknown> = {
      "@type": "EducationalOrganization",
      name: victim.universityName,
    };
    if (victim.universityCity) {
      alumniOf.address = {
        "@type": "PostalAddress",
        addressLocality: victim.universityCity,
        addressCountry: "IR",
      };
    }
    jsonLd.alumniOf = alumniOf;
  }

  // Field of study → knowsAbout (schema.org array of strings/Things).
  if (victim.fieldOfStudy) {
    jsonLd.knowsAbout = [victim.fieldOfStudy];
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <VictimDetail victim={victim} locale={locale as Locale} relatedVictims={relatedVictims} pivots={pivots} knownPerpSlugs={knownPerpSlugs} />
    </>
  );
}

function VictimDetail({ victim, locale, relatedVictims = [], pivots, knownPerpSlugs }: { victim: any; locale: Locale; relatedVictims?: any[]; pivots?: { province: any; year: any; yearCaseType: any } | null; knownPerpSlugs?: Set<string> }) {
  const t = useTranslations("victim");
  const tc = useTranslations("common");

  const name = locale === "fa" && victim.nameFarsi ? victim.nameFarsi : victim.nameLatin;
  const secondaryName = locale === "fa" ? victim.nameLatin : victim.nameFarsi;
  const circumstances = localized(victim, "circumstances", locale);
  const dreams = localized(victim, "dreams", locale);
  const beliefs = localized(victim, "beliefs", locale);
  const personality = localized(victim, "personality", locale);
  const occupation = localized(victim, "occupation", locale);
  const burialCircumstances = localized(victim, "burialCircumstances", locale);
  const familyPersecution = localized(victim, "familyPersecution", locale);

  const statusColors: Record<string, string> = {
    verified: "text-green-400 border-green-400/30 bg-green-400/10",
    unverified: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    disputed: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  const caseStatus = getCaseStatus(victim.causeOfDeath, victim.dateOfDeath);
  const caseStatusCfg = STATUS_CONFIG[caseStatus];
  const isAlive = !victim.dateOfDeath;

  const pageUrl = `${SITE_URL}/${locale}/victims/${victim.slug}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tc("victims"), href: "/victims" },
          { label: victim.nameLatin },
        ]}
      />

      {/* Header */}
      <div className="mb-12 rounded-xl bg-gradient-to-b from-memorial-900/60 to-transparent p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
          {/* Photo section */}
          {victim.photos && victim.photos.length > 0 ? (
            <div className="flex-shrink-0">
              <PhotoGallery
                photos={victim.photos}
                name={name}
                locale={locale}
                labels={{
                  photoOf: t("photoOf"),
                  photoCredit: t("photoCredit"),
                  closeGallery: t("closeGallery"),
                  previousPhoto: t("previousPhoto"),
                  nextPhoto: t("nextPhoto"),
                }}
              />
            </div>
          ) : (
            <MemorialPhoto
              src={victim.photoUrl}
              alt={victim.nameLatin}
              sizes="(min-width: 640px) 128px, 96px"
              className="h-24 w-24 sm:h-32 sm:w-32 flex-shrink-0 ring-2 ring-memorial-700/50"
            />
          )}

          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-memorial-50">{name}</h1>
            {secondaryName && (
              <p className={`text-lg text-memorial-400 mt-1 ${locale !== "fa" ? "dir-rtl" : ""}`} dir={locale !== "fa" ? "rtl" : undefined}>
                {secondaryName}
              </p>
            )}
            {victim.aliases.length > 0 && (
              <p className="text-sm text-memorial-500 mt-1">
                {victim.aliases.join(", ")}
              </p>
            )}
            <span className={`inline-block mt-3 text-xs px-2 py-1 rounded border ${statusColors[victim.verificationStatus] || statusColors.unverified}`}>
              {t(victim.verificationStatus as any)}
            </span>

            {/* Case status badge */}
            <span className={`inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-full border font-medium ${caseStatusCfg.bgColor} ${caseStatusCfg.borderColor} ${caseStatusCfg.color}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${caseStatusCfg.dotColor}`} aria-hidden />
              <span aria-hidden className="font-bold leading-none">{caseStatusCfg.shape}</span>
              {caseStatusCfg.label[locale] || caseStatusCfg.label.en}
            </span>

            {/* Inline citation refs — anchors to the numbered bibliography at
                #sources. Trust signal for researchers / journalists landing
                from a deep link. */}
            {victim.sources && victim.sources.length > 0 && (
              <div className="mt-3">
                <CiteRefs count={victim.sources.length} locale={locale} />
              </div>
            )}
          </div>
        </div>

        {/* Dates bar */}
        {(victim.dateOfBirth || victim.dateOfDeath) && (
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-memorial-300 border-b border-memorial-800 pb-4">
            {victim.dateOfBirth && (
              <span>
                <span className="text-memorial-500">{t("born")}:</span>{" "}
                {formatDate(victim.dateOfBirth, locale)}
                {victim.placeOfBirth && `, ${victim.placeOfBirth}`}
              </span>
            )}
            {victim.dateOfDeath && (
              <span>
                <span className="text-memorial-500">{t("died")}:</span>{" "}
                {formatDate(victim.dateOfDeath, locale)}
                {victim.ageAtDeath && ` (${victim.ageAtDeath})`}
              </span>
            )}
          </div>
        )}

        {/* Currently imprisoned notice */}
        {isAlive && (
          <div className="mt-4 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-300 text-sm">
            {locale === "de" ? "Diese Person ist nach aktuellem Kenntnisstand noch am Leben und in Haft." :
             locale === "fa" ? "این شخص تا آنجا که می‌دانیم هنوز در حال بازداشت است." :
             "This person is, to the best of our knowledge, currently alive and imprisoned."}
          </div>
        )}

        {/* Online presence — rendered last in the header so identity links sit
            next to the person's name and dates. Component returns null when
            no fields are set, so no empty row. */}
        <SocialLinks victim={victim} />
      </div>

      {/* Share buttons */}
      <ShareButtons url={pageUrl} name={victim.nameLatin} locale={locale} />

      {/* Citation block — researchers, NGOs, court briefs need machine-stable
          citations beyond a copy-link. Toggle reveals APA/MLA/Chicago/BibTeX. */}
      <CitationBlock
        name={victim.nameLatin}
        url={pageUrl}
        yearKnown={
          victim.dateOfDeath
            ? new Date(victim.dateOfDeath).getUTCFullYear()
            : victim.dateOfBirth
            ? new Date(victim.dateOfBirth).getUTCFullYear()
            : null
        }
      />

      {/* Letter generator — only for executed or death-row cases (where action is meaningful) */}
      {(caseStatus === "executed" || (isAlive && (victim.causeOfDeath || "").toLowerCase().includes("sentenced"))) && (
        <div className="mt-4">
          <LetterGenerator
            victim={{
              nameLatin: victim.nameLatin,
              nameFarsi: victim.nameFarsi,
              causeOfDeath: victim.causeOfDeath,
              placeOfDeath: victim.placeOfDeath,
              ageAtDeath: victim.ageAtDeath,
              responsibleForces: victim.responsibleForces,
              legalProceedings: victim.legalProceedings,
              slug: victim.slug,
            }}
            locale={locale}
            caseType={caseStatus === "executed" ? "executed" : "deathRow"}
          />
        </div>
      )}

      {/* Life Section */}
      {(occupation || dreams || beliefs || personality || victim.quotes.length > 0) && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gold-400 mb-6 flex items-center gap-2">
            <span className="h-px flex-1 bg-memorial-800" />
            {t("life")}
            <span className="h-px flex-1 bg-memorial-800" />
          </h2>
          <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-6">
            {occupation && <Field label={t("occupation")} value={occupation} />}
            {victim.education && <Field label={t("education")} value={victim.education} />}
            {victim.familyInfo && formatFamily(victim.familyInfo, t("children")) && (
              <Field label={t("family")} value={formatFamily(victim.familyInfo, t("children"))} />
            )}
            {dreams && <Field label={t("dreams")} value={dreams} />}
            {beliefs && <Field label={t("beliefs")} value={beliefs} />}
            {personality && <Field label={t("personality")} value={personality} />}
            {victim.quotes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-memorial-400 mb-2">{t("quotes")}</h3>
                <div className="space-y-2">
                  {victim.quotes.map((q: string, i: number) => (
                    <blockquote key={i} className="border-s-2 border-gold-500/50 ps-4 text-memorial-200 italic">
                      &ldquo;{q}&rdquo;
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Education Section — university-level details beyond the generic
          `education` free-text field rendered in the Life block above. */}
      {(victim.fieldOfStudy || victim.universityName || victim.universityCity || victim.degreeLevel || victim.graduationYear) && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gold-400 mb-6 flex items-center gap-2">
            <span className="h-px flex-1 bg-memorial-800" />
            {EDUCATION_HEADING[locale] || EDUCATION_HEADING.en}
            <span className="h-px flex-1 bg-memorial-800" />
          </h2>
          <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {victim.fieldOfStudy && <Field label={EDUCATION_LABELS.field[locale] || EDUCATION_LABELS.field.en} value={victim.fieldOfStudy} />}
            {victim.degreeLevel && <Field label={EDUCATION_LABELS.degree[locale] || EDUCATION_LABELS.degree.en} value={victim.degreeLevel} />}
            {victim.universityName && <Field label={EDUCATION_LABELS.university[locale] || EDUCATION_LABELS.university.en} value={victim.universityName} />}
            {victim.universityCity && <Field label={EDUCATION_LABELS.city[locale] || EDUCATION_LABELS.city.en} value={victim.universityCity} />}
            {victim.graduationYear && <Field label={EDUCATION_LABELS.graduation[locale] || EDUCATION_LABELS.graduation.en} value={String(victim.graduationYear)} />}
          </div>
        </section>
      )}

      {/* Death Section */}
      {(victim.placeOfDeath || victim.city || victim.causeOfDeath || victim.responsibleForces || circumstances || victim.event) && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-blood-400 mb-6 flex items-center gap-2">
            <span className="h-px flex-1 bg-memorial-800" />
            {t("death")}
            <span className="h-px flex-1 bg-memorial-800" />
          </h2>
          <div className="rounded-lg border border-memorial-800/60 bg-gradient-to-b from-blood-600/5 to-memorial-900/30 p-6 space-y-6">
            {(victim.city || victim.placeOfDeath) && (
              <Field
                label={t("placeOfDeath")}
                value={
                  victim.city
                    ? `${localized(victim.city, "name", locale)}${victim.city.province ? `, ${localized(victim.city.province, "name", locale)}` : ""}`
                    : victim.placeOfDeath!
                }
              />
            )}
            {victim.causeOfDeath && <Field label={t("causeOfDeath")} value={translateCause(victim.causeOfDeath, locale) || victim.causeOfDeath} />}
            {victim.responsibleForces && (
              <div>
                <Field label={t("responsibleForces")} value={victim.responsibleForces} />
                {knownPerpSlugs && (
                  <AccountabilityChips
                    responsibleForces={victim.responsibleForces}
                    knownSlugs={knownPerpSlugs}
                    locale={locale}
                  />
                )}
              </div>
            )}
            {circumstances && (
              <div>
                <h3 className="text-sm font-medium text-memorial-400 mb-2">{t("circumstances")}</h3>
                <div className="space-y-3">
                  {splitCircumstances(circumstances).map((paragraph: string, i: number) => (
                    <p key={i} className="text-memorial-200 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {victim.event && (
              <div>
                <h3 className="text-sm font-medium text-memorial-400 mb-1">{t("relatedEvent")}</h3>
                <Link
                  href={`/events/${victim.event.slug}`}
                  className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
                >
                  {localized(victim.event, "title", locale)}
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Aftermath Section */}
      {(victim.burialLocation || familyPersecution || victim.legalProceedings || victim.tributes.length > 0) && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-memorial-300 mb-6 flex items-center gap-2">
            <span className="h-px flex-1 bg-memorial-800" />
            {t("aftermath")}
            <span className="h-px flex-1 bg-memorial-800" />
          </h2>
          <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-6">
            {victim.burialLocation && (
              <div>
                <h3 className="text-sm font-medium text-memorial-400 mb-2">{t("burial")}</h3>
                <p className="text-memorial-200">{victim.burialLocation}</p>
                {victim.burialDate && (
                  <p className="text-sm text-memorial-400 mt-1">{formatDate(victim.burialDate, locale)}</p>
                )}
                {burialCircumstances && (
                  <div className="mt-2 space-y-3">
                    {burialCircumstances.split('\n\n').map((paragraph: string, i: number) => (
                      <p key={i} className="text-memorial-300 leading-relaxed">
                        {paragraph.trim()}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {familyPersecution && (
              <div>
                <h3 className="text-sm font-medium text-memorial-400 mb-2">{t("familyPersecution")}</h3>
                <div className="space-y-3">
                  {familyPersecution.split('\n\n').map((paragraph: string, i: number) => (
                    <p key={i} className="text-memorial-200 leading-relaxed">
                      {paragraph.trim()}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {victim.legalProceedings && (
              <div>
                <h3 className="text-sm font-medium text-memorial-400 mb-2">{t("legalProceedings")}</h3>
                <div className="space-y-3">
                  {victim.legalProceedings.split('\n\n').map((paragraph: string, i: number) => (
                    <p key={i} className="text-memorial-200 leading-relaxed">
                      {paragraph.trim()}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {victim.tributes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-memorial-400 mb-2">{t("tributes")}</h3>
                <ul className="list-disc list-inside space-y-1 text-memorial-200">
                  {victim.tributes.map((tribute: string, i: number) => (
                    <li key={i}>{tribute}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Comment Section */}
      <CommentSection victimId={victim.id} locale={locale} />

      {/* Investigation pivots — same-province + same-year + same-year-and-case-type
          drill-downs. Lets journalists and researchers jump from one profile into
          related queries without going back to a list page. */}
      {pivots && (
        <VictimPivots
          pivots={pivots}
          locale={locale}
          numberFormatLocale={
            locale === "fa" ? "fa-IR" : locale === "ar" ? "ar-EG" : locale
          }
        />
      )}

      {/* Related Victims */}
      {relatedVictims.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-memorial-300 mb-6 flex items-center gap-2">
            <span className="h-px flex-1 bg-memorial-800" />
            {t("relatedVictims")}
            <span className="h-px flex-1 bg-memorial-800" />
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {relatedVictims.map((rv: any) => (
              <Link
                key={rv.slug}
                href={`/victims/${rv.slug}`}
                className="group flex items-center gap-3 rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-3 hover:border-gold-500/30 hover:bg-memorial-800/30 transition-colors"
              >
                <MemorialPhoto
                  src={rv.photoUrl}
                  alt={rv.nameLatin}
                  sizes="36px"
                  className="w-9 h-9 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-memorial-200 group-hover:text-gold-400 transition-colors truncate">
                    {locale === "fa" && rv.nameFarsi ? rv.nameFarsi : rv.nameLatin}
                  </p>
                  {rv.dateOfDeath && (
                    <p className="text-xs text-memorial-500">{formatDate(rv.dateOfDeath, locale)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {victim.event && (
            <div className="mt-4 text-center">
              <Link
                href={`/events/${victim.event.slug}`}
                className="text-sm text-gold-400 hover:text-gold-300 underline underline-offset-2"
              >
                {t("seeAllFromEvent")}
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Sources — numbered bibliography. Each <li> carries id="source-N"
          so the CiteRefs [N] superscript anchors at the top scroll here.
          Outer <section id="sources"> is the "N sources →" tail target. */}
      {victim.sources.length > 0 && (
        <section id="sources" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-semibold text-memorial-300 mb-6 flex items-center gap-2">
            <span className="h-px flex-1 bg-memorial-800" />
            {t("sources")}
            <span className="h-px flex-1 bg-memorial-800" />
          </h2>
          <ol className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-3 list-none">
            {victim.sources.map((source: any, idx: number) => {
              const badge = badgeForSource(source);
              const n = idx + 1;
              return (
                <li
                  key={source.id}
                  id={`source-${n}`}
                  className="text-sm flex flex-wrap items-baseline gap-x-2 gap-y-1 scroll-mt-24 target:bg-gold-500/5 target:ring-1 target:ring-gold-500/30 rounded px-1 -mx-1"
                >
                  <span className="inline-flex items-center justify-center min-w-[1.6rem] h-5 px-1 text-xs tabular-nums rounded border border-memorial-700 bg-memorial-900/70 text-memorial-400">
                    {n}
                  </span>
                  <SourceBadge tier={badge.tier} icon={badge.icon} className={badge.className} />
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
                    >
                      {source.name}
                    </a>
                  ) : (
                    <span className="text-memorial-200">{source.name}</span>
                  )}
                  {source.sourceType && (
                    <span className="text-memorial-500 text-xs">({source.sourceType})</span>
                  )}
                  {source.publishedDate && (
                    <span className="text-memorial-500 text-xs">
                      {formatDate(source.publishedDate, locale)}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-memorial-500">
            <Link href="/methodology" className="hover:text-memorial-300 underline underline-offset-2">
              {t("methodologyLink")}
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-memorial-400 mb-1">{label}</h3>
      <p className="text-memorial-200">{value}</p>
    </div>
  );
}

function SourceBadge({ tier, icon, className }: { tier: string; icon: string; className: string }) {
  const t = useTranslations("credibility");
  return (
    <span
      title={t(`${tier}_tooltip` as any)}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      <span aria-hidden>{icon}</span>
      <span>{t(`${tier}_label` as any)}</span>
    </span>
  );
}

function formatFamily(info: any, childrenLabel: string): string {
  if (!info) return "";
  const parts: string[] = [];
  if (info.marital_status) parts.push(info.marital_status);
  if (info.children) parts.push(`${info.children} ${childrenLabel}`);
  if (info.notes) parts.push(info.notes);
  return parts.join(". ");
}

/** Split long circumstances text into readable paragraphs.
 *  Boroumand texts are one long block with section headers like
 *  "Arrest and detention", "Trial", "Charges", etc. embedded inline. */
function splitCircumstances(text: string): string[] {
  // First try normal paragraph splits
  const byNewline = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  // For single-block Boroumand texts: split before known section headers
  const sectionHeaders = /(?=\s(?:Arrest and [Dd]etention|Trial|Charges?|Evidence of [Gg]uilt|Defense|Judgment|Sentence|Background|Execution|(?:The )?(?:Mojahedin|Kurdish|Baha.i|Workers?.|Democratic|People.s)|International [Hh]uman [Rr]ights)\s)/g;

  const parts = text.split(sectionHeaders).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;

  // Fallback: split every ~500 chars at sentence boundaries
  if (text.length > 600) {
    const sentences = text.split(/(?<=\.)\s+/);
    const paragraphs: string[] = [];
    let current = "";
    for (const s of sentences) {
      if (current.length + s.length > 500 && current.length > 200) {
        paragraphs.push(current.trim());
        current = s;
      } else {
        current += (current ? " " : "") + s;
      }
    }
    if (current.trim()) paragraphs.push(current.trim());
    if (paragraphs.length > 1) return paragraphs;
  }

  return [text];
}
