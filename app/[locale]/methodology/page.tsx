import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { TIER_BADGE, type CredibilityTier } from "@/lib/credibility";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const titles: Record<string, string> = {
    en: "Verification Methodology — Iran Memorial",
    de: "Verifizierungs-Methodik — Iran Memorial",
    fa: "روش تأیید — یادبود ایران",
  };
  const desc: Record<string, string> = {
    en: "How Iran Memorial verifies victim records: source tiers, deduplication, auto-update workflow, and the criteria behind the verified count.",
    de: "Wie Iran Memorial Opfer-Einträge verifiziert: Quellen-Tiers, Deduplikation, Auto-Update-Workflow und die Kriterien hinter der verifizierten Zahl.",
    fa: "چگونه یادبود ایران سوابق قربانیان را تأیید می‌کند: سطوح منابع، حذف موارد تکراری، گردش کار به‌روزرسانی خودکار.",
  };
  return {
    title: titles[locale] || titles.en,
    description: desc[locale] || desc.en,
    alternates: {
      canonical: `${SITE_URL}/${locale}/methodology`,
    },
  };
}

interface DataSourceRow {
  slug: string;
  name: string;
  url: string | null;
  credibility: string;
  sourceType: string | null;
  countryCode: string | null;
}

async function loadData() {
  const [dataSources, victimCount, verifiedCount, sourceCount, photoCount] = await Promise.all([
    prisma.dataSource.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        name: true,
        url: true,
        credibility: true,
        sourceType: true,
        countryCode: true,
      },
      orderBy: [{ credibility: "asc" }, { slug: "asc" }],
    }),
    prisma.victim.count(),
    prisma.victim.count({ where: { verificationStatus: "verified" } }),
    prisma.source.count(),
    prisma.photo.count(),
  ]);
  return { dataSources, victimCount, verifiedCount, sourceCount, photoCount };
}

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await loadData();
  return <MethodologyContent locale={locale as Locale} {...data} />;
}

function MethodologyContent({
  locale,
  dataSources,
  victimCount,
  verifiedCount,
  sourceCount,
  photoCount,
}: {
  locale: Locale;
  dataSources: DataSourceRow[];
  victimCount: number;
  verifiedCount: number;
  sourceCount: number;
  photoCount: number;
}) {
  const t = useTranslations("methodology");
  const tc = useTranslations("credibility");

  // Group sources by tier
  const grouped: Record<CredibilityTier, DataSourceRow[]> = {
    high: [],
    reputable: [],
    community: [],
    unknown: [],
  };
  for (const ds of dataSources) {
    const t: CredibilityTier =
      ds.credibility === "HIGH"
        ? "high"
        : ds.credibility === "MEDIUM"
        ? "reputable"
        : "community";
    grouped[t].push(ds);
  }

  const verifiedPct = victimCount ? Math.round((verifiedCount / victimCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-widest text-gold-400 mb-3">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-memorial-100 mb-4">
          {t("title")}
        </h1>
        <p className="text-lg text-memorial-300 leading-relaxed">{t("intro")}</p>
      </header>

      {/* Live counts */}
      <section className="mb-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label={t("statVictims")} value={formatNumber(victimCount, locale)} />
        <Stat
          label={t("statVerified")}
          value={`${formatNumber(verifiedCount, locale)} (${verifiedPct}%)`}
          accent
        />
        <Stat label={t("statSources")} value={formatNumber(sourceCount, locale)} />
        <Stat label={t("statPhotos")} value={formatNumber(photoCount, locale)} />
      </section>

      {/* Verification tiers */}
      <Section title={t("tiersTitle")}>
        <p className="text-memorial-300 mb-6 leading-relaxed">{t("tiersIntro")}</p>
        <div className="space-y-4">
          <TierCard
            tier="high"
            title={t("tierHighTitle")}
            body={t("tierHighBody")}
            count={grouped.high.length}
          />
          <TierCard
            tier="reputable"
            title={t("tierReputableTitle")}
            body={t("tierReputableBody")}
            count={grouped.reputable.length}
          />
          <TierCard
            tier="community"
            title={t("tierCommunityTitle")}
            body={t("tierCommunityBody")}
            count={grouped.community.length}
          />
        </div>
      </Section>

      {/* Auto-verification rule */}
      <Section title={t("autoVerifyTitle")}>
        <p className="text-memorial-300 mb-4 leading-relaxed">{t("autoVerifyIntro")}</p>
        <ul className="space-y-3 text-memorial-300">
          <RuleItem letter="A">{t("autoVerifyRuleA")}</RuleItem>
          <RuleItem letter="B">{t("autoVerifyRuleB")}</RuleItem>
          <RuleItem letter="C">{t("autoVerifyRuleC")}</RuleItem>
        </ul>
        <p className="mt-5 text-sm text-memorial-400 italic">{t("autoVerifyNote")}</p>
      </Section>

      {/* Source registry table */}
      <Section title={t("registryTitle")}>
        <p className="text-memorial-300 mb-6 leading-relaxed">{t("registryIntro")}</p>
        <div className="overflow-x-auto rounded-lg border border-memorial-800/60">
          <table className="w-full text-sm">
            <thead className="bg-memorial-900/60 text-xs uppercase tracking-wide text-memorial-400">
              <tr>
                <th className="px-4 py-3 text-start">{t("colSource")}</th>
                <th className="px-4 py-3 text-start">{t("colTier")}</th>
                <th className="px-4 py-3 text-start">{t("colType")}</th>
                <th className="px-4 py-3 text-start">{t("colCountry")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-memorial-800/40">
              {dataSources.map((ds) => {
                const tier: CredibilityTier =
                  ds.credibility === "HIGH"
                    ? "high"
                    : ds.credibility === "MEDIUM"
                    ? "reputable"
                    : "community";
                const badge = TIER_BADGE[tier];
                return (
                  <tr key={ds.slug} className="hover:bg-memorial-900/30">
                    <td className="px-4 py-3">
                      {ds.url ? (
                        <a
                          href={ds.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
                        >
                          {ds.name}
                        </a>
                      ) : (
                        <span className="text-memorial-200">{ds.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${badge.className}`}
                      >
                        <span aria-hidden>{badge.icon}</span>
                        <span>{tc(`${tier}_label`)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-memorial-400 text-xs">
                      {ds.sourceType ? ds.sourceType.replace(/_/g, " ").toLowerCase() : "—"}
                    </td>
                    <td className="px-4 py-3 text-memorial-400 text-xs">
                      {ds.countryCode || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Deduplication */}
      <Section title={t("dedupTitle")}>
        <p className="text-memorial-300 mb-4 leading-relaxed">{t("dedupIntro")}</p>
        <ul className="space-y-2 text-memorial-300">
          <BulletItem>{t("dedupBullet1")}</BulletItem>
          <BulletItem>{t("dedupBullet2")}</BulletItem>
          <BulletItem>{t("dedupBullet3")}</BulletItem>
          <BulletItem>{t("dedupBullet4")}</BulletItem>
        </ul>
      </Section>

      {/* Photo provenance & storage */}
      <Section title={t("photoTitle")}>
        <p className="text-memorial-300 mb-4 leading-relaxed">{t("photoIntro")}</p>
        <ul className="space-y-2 text-memorial-300">
          <BulletItem>{t("photoBullet1")}</BulletItem>
          <BulletItem>{t("photoBullet2")}</BulletItem>
          <BulletItem>{t("photoBullet3")}</BulletItem>
          <BulletItem>{t("photoBullet4")}</BulletItem>
          <BulletItem>{t("photoBullet5")}</BulletItem>
        </ul>
      </Section>

      {/* Auto-update workflow */}
      <Section title={t("workflowTitle")}>
        <p className="text-memorial-300 mb-6 leading-relaxed">{t("workflowIntro")}</p>
        <div className="space-y-3">
          <CronRow time="02:30 UTC" name="witness.report" body={t("cronWitness")} />
          <CronRow time="04:30 UTC" name="HRANA" body={t("cronHrana")} />
          <CronRow time="05:00 UTC" name="Hengaw" body={t("cronHengaw")} />
        </div>
        <p className="mt-5 text-sm text-memorial-400">{t("workflowNote")}</p>
      </Section>

      {/* Limitations */}
      <Section title={t("limitsTitle")}>
        <p className="text-memorial-300 mb-4 leading-relaxed">{t("limitsIntro")}</p>
        <ul className="space-y-2 text-memorial-300">
          <BulletItem>{t("limitsBullet1")}</BulletItem>
          <BulletItem>{t("limitsBullet2")}</BulletItem>
          <BulletItem>{t("limitsBullet3")}</BulletItem>
        </ul>
      </Section>

      {/* Citation */}
      <Section title={t("citeTitle")}>
        <p className="text-memorial-300 mb-4 leading-relaxed">{t("citeIntro")}</p>
        <pre className="rounded-lg border border-memorial-800/60 bg-memorial-900/40 p-4 text-xs text-memorial-300 overflow-x-auto whitespace-pre-wrap">
{`Iran Memorial. (${new Date().getFullYear()}). Memorial database for victims
of the Islamic Republic of Iran (1979–present). Retrieved from
${SITE_URL}`}
        </pre>
        <p className="mt-4 text-sm text-memorial-400">
          {t("citeLicense")}{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
      </Section>

      {/* Cross-links */}
      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/sources"
          className="rounded-lg border border-memorial-700/60 bg-memorial-900/40 px-4 py-2 text-sm text-memorial-200 hover:bg-memorial-800/60"
        >
          {t("linkSources")}
        </Link>
        <Link
          href="/developers"
          className="rounded-lg border border-memorial-700/60 bg-memorial-900/40 px-4 py-2 text-sm text-memorial-200 hover:bg-memorial-800/60"
        >
          {t("linkDevelopers")}
        </Link>
        <Link
          href="/about"
          className="rounded-lg border border-memorial-700/60 bg-memorial-900/40 px-4 py-2 text-sm text-memorial-200 hover:bg-memorial-800/60"
        >
          {t("linkAbout")}
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <div className="flex items-center gap-4 mb-5">
        <h2 className="text-lg font-semibold text-gold-400 flex-shrink-0">{title}</h2>
        <div className="h-px flex-1 bg-memorial-800" />
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/40 px-4 py-4">
      <div className={`text-2xl font-bold tabular-nums ${accent ? "text-emerald-400" : "text-memorial-100"}`}>
        {value}
      </div>
      <div className="text-xs text-memorial-400 mt-1">{label}</div>
    </div>
  );
}

function TierCard({
  tier,
  title,
  body,
  count,
}: {
  tier: CredibilityTier;
  title: string;
  body: string;
  count: number;
}) {
  const badge = TIER_BADGE[tier];
  const t = useTranslations("methodology");
  return (
    <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
          >
            <span aria-hidden>{badge.icon}</span>
            <span>{title}</span>
          </span>
        </div>
        <span className="text-xs text-memorial-500">
          {count} {t("sourcesShort")}
        </span>
      </div>
      <p className="text-sm text-memorial-300 leading-relaxed">{body}</p>
    </div>
  );
}

function RuleItem({ letter, children }: { letter: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-xs font-semibold text-gold-400">
        {letter}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-400" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function CronRow({ time, name, body }: { time: string; name: string; body: string }) {
  return (
    <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 flex items-start gap-4">
      <div className="flex-shrink-0 text-xs font-mono text-gold-400 tabular-nums w-20">{time}</div>
      <div>
        <div className="text-sm font-medium text-memorial-200">{name}</div>
        <div className="text-xs text-memorial-400 mt-1">{body}</div>
      </div>
    </div>
  );
}
