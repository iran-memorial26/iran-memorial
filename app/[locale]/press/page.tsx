import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getStats } from "@/lib/queries";
import { prismaReadOnly } from "@/lib/db-readonly";
import { SITE_URL } from "@/lib/site-url";
import { CONTACT_EMAIL } from "@/lib/contact";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";

// force-dynamic: avoid build-time DB access; the page is cheap to render
// per-request and stats should always be fresh for journalists.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "de"
        ? "Press Kit — Iran Memorial"
        : "Press Kit — Iran Memorial",
    description:
      "Citable statistics, embeddable widgets, photography credits, contact for journalists and human-rights organizations covering the Iran Memorial.",
    alternates: { canonical: `${SITE_URL}/${locale}/press` },
  };
}

export default async function PressPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [stats, latestVictims] = await Promise.all([
    getStats(prismaReadOnly),
    prismaReadOnly.victim.findMany({
      where: { verificationStatus: "verified" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        dateOfDeath: true,
        placeOfDeath: true,
        causeOfDeath: true,
      },
    }),
  ]);

  return <PressContent locale={locale as Locale} stats={stats} latest={latestVictims} />;
}

type Stats = Awaited<ReturnType<typeof getStats>>;
type LatestVictim = {
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: Date | null;
  placeOfDeath: string | null;
  causeOfDeath: string | null;
};

function PressContent({
  locale,
  stats,
  latest,
}: {
  locale: Locale;
  stats: Stats;
  latest: LatestVictim[];
}) {
  const t = useTranslations("press");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-widest text-gold-400 mb-3">
          {t("eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-memorial-100 mb-4">{t("title")}</h1>
        <p className="text-lg text-memorial-300 leading-relaxed max-w-2xl">
          {t("intro")}
        </p>
      </header>

      {/* Boilerplate / one-liner */}
      <Section title={t("boilerplateTitle")}>
        <p className="text-memorial-200 leading-relaxed mb-3">
          <strong className="text-memorial-100">Iran Memorial</strong>{" "}
          {t("boilerplate1")}
        </p>
        <p className="text-memorial-300 leading-relaxed">{t("boilerplate2")}</p>
        <CopyBox
          label={t("copyOneLiner")}
          text={t("oneLiner", {
            count: stats.victimCount.toLocaleString("en-US"),
          })}
        />
      </Section>

      {/* Live stats */}
      <Section title={t("statsTitle")}>
        <p className="text-memorial-300 mb-6 max-w-2xl">{t("statsIntro")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatTile label={t("statVictims")} value={fmt(stats.victimCount)} />
          <StatTile label={t("statSources")} value={fmt(stats.sourceCount)} />
          <StatTile label={t("statEvents")} value={fmt(stats.eventCount)} />
          <StatTile
            label={t("statYears")}
            value={fmt(stats.yearsOfRepression)}
          />
        </div>
        <p className="text-sm text-memorial-400">
          {t("statsApi")}{" "}
          <a
            className="text-gold-400 hover:text-gold-300 underline"
            href={`${SITE_URL}/api/mcp/statistics`}
            target="_blank"
            rel="noreferrer"
          >
            /api/mcp/statistics
          </a>
        </p>
      </Section>

      {/* Embeddable counter widget */}
      <Section title={t("widgetTitle")} pill={t("widgetPill")}>
        <p className="text-memorial-300 mb-6 max-w-2xl">{t("widgetIntro")}</p>

        <div className="rounded-lg border border-memorial-800/60 bg-memorial-950 p-4 mb-4">
          <iframe
            src={`${SITE_URL}/embed?theme=dark&size=md&locale=${locale}`}
            width="100%"
            height={170}
            frameBorder={0}
            loading="lazy"
            title="Iran Memorial — Live Counter"
            className="block"
          />
        </div>

        <CodeBlock>
          {`<iframe
  src="${SITE_URL}/embed?theme=dark&size=md&locale=${locale}"
  width="100%"
  height="170"
  frameborder="0"
  loading="lazy"
  title="Iran Memorial — Live Counter"></iframe>`}
        </CodeBlock>

        <p className="text-sm text-memorial-400 mt-3">
          {t("widgetMore")}{" "}
          <Link href="/embed-preview" className="text-gold-400 hover:text-gold-300">
            /embed-preview
          </Link>
        </p>
      </Section>

      {/* Latest victims (for "what's new" stories) */}
      <Section title={t("latestTitle")}>
        <p className="text-memorial-300 mb-6 max-w-2xl">{t("latestIntro")}</p>
        <ul className="divide-y divide-memorial-800/40 rounded-lg border border-memorial-800/40 bg-memorial-900/30">
          {latest.map((v) => (
            <li key={v.slug} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-memorial-100 truncate">
                  <Link
                    href={`/victims/${v.slug}`}
                    className="hover:text-gold-300"
                  >
                    {v.nameLatin}
                  </Link>
                  {v.nameFarsi && (
                    <span className="text-memorial-400 mx-2">·</span>
                  )}
                  {v.nameFarsi && (
                    <span className="text-memorial-300" dir="rtl">
                      {v.nameFarsi}
                    </span>
                  )}
                </p>
                <p className="text-xs text-memorial-500 truncate">
                  {[
                    v.dateOfDeath
                      ? new Date(v.dateOfDeath).toLocaleDateString(
                          locale === "fa" ? "fa-IR" : locale,
                        )
                      : null,
                    v.placeOfDeath,
                    v.causeOfDeath,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-memorial-400 mt-3">
          {t("latestFeed")}{" "}
          <a
            href="/feed.xml"
            className="text-gold-400 hover:text-gold-300 underline"
          >
            RSS
          </a>{" "}
          ·{" "}
          <a
            href="/feed.json"
            className="text-gold-400 hover:text-gold-300 underline"
          >
            JSON Feed
          </a>
        </p>
      </Section>

      {/* Brand assets */}
      <Section title={t("brandTitle")}>
        <p className="text-memorial-300 mb-4 max-w-2xl">{t("brandIntro")}</p>
        <ul className="text-memorial-300 space-y-1 text-sm">
          <li>
            <strong className="text-memorial-100">{t("brandName")}:</strong> Iran
            Memorial
          </li>
          <li>
            <strong className="text-memorial-100">{t("brandUrl")}:</strong>{" "}
            <a
              href={SITE_URL}
              className="text-gold-400 hover:text-gold-300 underline"
            >
              {SITE_URL.replace(/^https?:\/\//, "")}
            </a>
          </li>
          <li>
            <strong className="text-memorial-100">{t("brandSteward")}:</strong>{" "}
            Woman Life Freedom e.V.
          </li>
          <li>
            <strong className="text-memorial-100">{t("brandLicense")}:</strong>{" "}
            Code MIT · Data CC BY-SA 4.0
          </li>
        </ul>
      </Section>

      {/* Citation */}
      <Section title={t("citationTitle")}>
        <p className="text-memorial-300 mb-4 max-w-2xl">{t("citationIntro")}</p>
        <CodeBlock>
          {`Iran Memorial Project. (${new Date().getFullYear()}). Iran Memorial — Database of victims of the Islamic Republic of Iran (1979–present). Retrieved ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}, from ${SITE_URL}`}
        </CodeBlock>
        <p className="text-sm text-memorial-400 mt-3">
          {t("citationDoi")}{" "}
          <Link href="/methodology" className="text-gold-400 hover:text-gold-300">
            /methodology
          </Link>
        </p>
      </Section>

      {/* Press contact */}
      <Section title={t("contactTitle")}>
        <p className="text-memorial-200 leading-relaxed mb-4 max-w-2xl">
          {t("contactIntro")}
        </p>
        <ul className="space-y-2 text-memorial-300">
          <li>
            <strong className="text-memorial-100">{t("contactEmail")}:</strong>{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-gold-400 hover:text-gold-300 underline"
            >
              {CONTACT_EMAIL}
            </a>
          </li>
          <li>
            <strong className="text-memorial-100">{t("contactSignal")}:</strong>{" "}
            {t("contactSignalNote")}
          </li>
          <li>
            <strong className="text-memorial-100">{t("contactResponse")}:</strong>{" "}
            {t("contactResponseNote")}
          </li>
        </ul>
        <p className="text-sm text-memorial-400 mt-6">{t("contactConfidential")}</p>
      </Section>

      {/* For developers / data partners */}
      <Section title={t("devPartnerTitle")}>
        <p className="text-memorial-300 mb-4 max-w-2xl">{t("devPartnerIntro")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PartnerCard
            href="/developers"
            title={t("devCardApi")}
            desc={t("devCardApiDesc")}
          />
          <PartnerCard
            href="/methodology"
            title={t("devCardMethod")}
            desc={t("devCardMethodDesc")}
          />
          <PartnerCard
            href="/sources"
            title={t("devCardSources")}
            desc={t("devCardSourcesDesc")}
          />
        </div>
      </Section>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function Section({
  title,
  pill,
  children,
}: {
  title: string;
  pill?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h2 className="text-xl font-semibold text-memorial-100">{title}</h2>
        {pill && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gold-700/20 text-gold-300 border border-gold-700/40">
            {pill}
          </span>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4">
      <p className="text-2xl font-bold text-gold-400 tabular-nums">{value}</p>
      <p className="text-xs text-memorial-400 mt-1">{label}</p>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-memorial-950 border border-memorial-800 rounded-lg p-4 text-xs text-memorial-200 overflow-x-auto">
      {children}
    </pre>
  );
}

function CopyBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4">
      <p className="text-xs text-memorial-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="bg-memorial-950 border border-memorial-800 rounded-lg p-3 text-sm text-memorial-200">
        {text}
      </div>
    </div>
  );
}

function PartnerCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-memorial-800 bg-memorial-900/40 hover:bg-memorial-800/60 hover:border-gold-700/40 p-4 transition-colors"
    >
      <p className="font-semibold text-memorial-100 mb-1">{title}</p>
      <p className="text-sm text-memorial-300 leading-snug">{desc}</p>
    </Link>
  );
}
