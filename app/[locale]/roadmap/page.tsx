import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site-url";
import { CONTACT_EMAIL } from "@/lib/contact";
import {
  ROADMAP,
  ROADMAP_LAST_REVIEWED,
  type RoadmapItem,
  type RoadmapStatus,
  type RoadmapDependency,
} from "@/data/roadmap";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Roadmap — Iran Memorial",
    description:
      "What Iran Memorial is working on now, what is committed for next quarter, and what is on the radar. Public so partners and donors can plan around it.",
    alternates: { canonical: `${SITE_URL}/${locale}/roadmap` },
  };
}

const STATUS_ORDER: RoadmapStatus[] = ["now", "next", "later", "done"];

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RoadmapContent locale={locale as Locale} />;
}

function RoadmapContent({ locale }: { locale: Locale }) {
  const t = useTranslations("roadmap");

  const grouped = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = ROADMAP.filter((i) => i.status === status);
      return acc;
    },
    {} as Record<RoadmapStatus, RoadmapItem[]>,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-widest text-gold-400 mb-3">
          {t("eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-memorial-100 mb-4">{t("title")}</h1>
        <p className="text-lg text-memorial-300 leading-relaxed max-w-2xl">
          {t("intro")}
        </p>
        <p className="text-sm text-memorial-500 mt-4">
          {t("lastReviewed")}{" "}
          <time dateTime={ROADMAP_LAST_REVIEWED}>
            {new Date(ROADMAP_LAST_REVIEWED).toLocaleDateString(
              locale === "fa" ? "fa-IR" : locale,
              { year: "numeric", month: "long", day: "numeric" },
            )}
          </time>
        </p>
      </header>

      <ColumnSection
        status="now"
        title={t("nowTitle")}
        intro={t("nowIntro")}
        items={grouped.now}
        locale={locale}
      />
      <ColumnSection
        status="next"
        title={t("nextTitle")}
        intro={t("nextIntro")}
        items={grouped.next}
        locale={locale}
      />
      <ColumnSection
        status="later"
        title={t("laterTitle")}
        intro={t("laterIntro")}
        items={grouped.later}
        locale={locale}
      />
      <ColumnSection
        status="done"
        title={t("doneTitle")}
        intro={t("doneIntro")}
        items={grouped.done}
        locale={locale}
      />

      <section className="mt-16 rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6">
        <h2 className="text-lg font-semibold text-memorial-100 mb-3">
          {t("supportTitle")}
        </h2>
        <p className="text-memorial-300 mb-4">{t("supportIntro")}</p>
        <ul className="space-y-2 text-sm text-memorial-300">
          <li>
            <strong className="text-memorial-100">{t("supportFunding")}:</strong>{" "}
            {t("supportFundingDesc")}
          </li>
          <li>
            <strong className="text-memorial-100">{t("supportPartners")}:</strong>{" "}
            {t("supportPartnersDesc")}
          </li>
          <li>
            <strong className="text-memorial-100">{t("supportVolunteers")}:</strong>{" "}
            {t("supportVolunteersDesc")}{" "}
            <Link
              href="/submit"
              className="text-gold-400 hover:text-gold-300 underline"
            >
              {t("supportVolunteersLink")}
            </Link>
            .
          </li>
        </ul>
        <p className="text-sm text-memorial-400 mt-4">
          {t("supportContact")}{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-gold-400 hover:text-gold-300 underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <p className="text-sm text-memorial-500 mt-8">
        {t("sourceNote")}{" "}
        <a
          href="https://github.com/iran-memorial26/iran-memorial/blob/main/data/roadmap.ts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-400 hover:text-gold-300 font-mono"
        >
          data/roadmap.ts
        </a>
      </p>
    </div>
  );
}

function ColumnSection({
  status,
  title,
  intro,
  items,
  locale,
}: {
  status: RoadmapStatus;
  title: string;
  intro: string;
  items: RoadmapItem[];
  locale: Locale;
}) {
  if (items.length === 0) return null;

  const accent = {
    now: "border-emerald-700/40 bg-emerald-900/10",
    next: "border-gold-700/40 bg-gold-900/10",
    later: "border-memorial-700/40 bg-memorial-900/30",
    done: "border-memorial-700/30 bg-memorial-900/20 opacity-80",
  }[status];

  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="text-2xl font-semibold text-memorial-100">{title}</h2>
        <span className="text-xs text-memorial-500">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <p className="text-sm text-memorial-400 mb-5 max-w-2xl">{intro}</p>

      <div className="space-y-3">
        {items.map((item, i) => (
          <article
            key={i}
            className={`rounded-lg border ${accent} px-4 py-3 transition-colors`}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
              <h3 className="text-base font-semibold text-memorial-100">
                {item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gold-300"
                  >
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </h3>
              <DependencyTags deps={item.dependencies} />
            </div>
            <p className="text-sm text-memorial-300 leading-relaxed">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

const DEP_LABEL: Record<RoadmapDependency, string> = {
  funding: "needs funding",
  partners: "needs partner",
  volunteers: "needs volunteer",
  tech: "tech",
  regulatory: "needs legal",
};

const DEP_COLOR: Record<RoadmapDependency, string> = {
  funding: "bg-rose-900/30 text-rose-300 border-rose-700/40",
  partners: "bg-blue-900/30 text-blue-300 border-blue-700/40",
  volunteers: "bg-emerald-900/30 text-emerald-300 border-emerald-700/40",
  tech: "bg-memorial-800 text-memorial-300 border-memorial-700/60",
  regulatory: "bg-amber-900/30 text-amber-300 border-amber-700/40",
};

function DependencyTags({ deps }: { deps: RoadmapDependency[] }) {
  if (deps.length === 0)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-300 border border-emerald-700/40">
        shipped
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {deps.map((d) => (
        <span
          key={d}
          className={`text-xs px-2 py-0.5 rounded-full border ${DEP_COLOR[d]}`}
        >
          {DEP_LABEL[d]}
        </span>
      ))}
    </div>
  );
}
