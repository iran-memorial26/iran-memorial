import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

// Per-source metadata. Kept inline rather than DB-backed because the list is
// curated, slow-moving, and benefits from being grep-able alongside the
// source-plugin code. Credibility maps to the three-tier model used on /about
// and surfaced to users via the legend at the top of this page.
type Tier = "HIGH" | "MEDIUM" | "COMMUNITY";

const SOURCE_INFO: Record<string, { fullName: string; url: string; credibility: Tier; description: string }> = {
  // High-credibility: NGO/UN reports + court documents
  hrana:             { fullName: "Human Rights Activists News Agency", url: "https://hra-news.org",            credibility: "HIGH",      description: "Iran-based human-rights news agency documenting arrests, executions, and protests since 2009." },
  amnesty:           { fullName: "Amnesty International",              url: "https://www.amnesty.org",         credibility: "HIGH",      description: "Global human-rights organization with a dedicated Iran team documenting political prisoners and executions." },
  ihr:               { fullName: "Iran Human Rights (IHR)",            url: "https://iranhr.net",              credibility: "HIGH",      description: "Norwegian NGO tracking every execution in Iran with detailed case documentation." },
  boroumand:         { fullName: "Abdorrahman Boroumand Center",       url: "https://www.iranrights.org",      credibility: "HIGH",      description: "US-based foundation maintaining a memorial database of political victims since 1979." },
  hengaw:            { fullName: "Hengaw Organization for Human Rights", url: "https://hengaw.net",            credibility: "HIGH",      description: "Kurdish human-rights organization documenting rights violations in Iranian Kurdistan." },
  ohchr:             { fullName: "UN Office of the High Commissioner for Human Rights", url: "https://www.ohchr.org", credibility: "HIGH", description: "UN body publishing reports and statements on human-rights violations in Iran." },
  igfm:              { fullName: "Internationale Gesellschaft für Menschenrechte (IGFM)", url: "https://www.igfm.de", credibility: "HIGH", description: "Frankfurt-based German human-rights organization with case-sponsorship for Iranian prisoners." },
  khrn:              { fullName: "Kurdistan Human Rights Network",     url: "https://kurdistanhumanrights.org", credibility: "HIGH",     description: "Kurdish human-rights monitor documenting political prisoners and journalists in Iran's Kurdish regions." },
  cpj:               { fullName: "Committee to Protect Journalists",   url: "https://cpj.org",                 credibility: "HIGH",      description: "Global press-freedom organization tracking journalists killed, imprisoned, or persecuted in Iran." },

  // Reputable
  iranvictims:       { fullName: "iranvictims.org / iranvictims.com",  url: "https://iranvictims.org",         credibility: "MEDIUM",    description: "Volunteer-maintained victim archive with photo-rich profiles and per-victim source pages." },
  iranrevolution:    { fullName: "iranrevolution.org",                 url: "https://iranrevolution.org",      credibility: "MEDIUM",    description: "Open archive of the 2022 Woman, Life, Freedom movement victims, with real-time updates." },
  iranmonitor:       { fullName: "Iran Monitor Memorial",              url: "https://iranmonitor.org",         credibility: "MEDIUM",    description: "Diaspora memorial site with structured victim data." },
  "iran-international": { fullName: "Iran International",              url: "https://www.iranintl.com",        credibility: "MEDIUM",    description: "London-based Persian-language broadcaster covering Iranian politics and human rights." },
  witness_report:    { fullName: "witness.report",                     url: "https://witness.report",          credibility: "MEDIUM",    description: "Open-source incident-documentation platform with global activist contributors." },

  // Community-verified
  wikipedia:         { fullName: "Wikipedia (verified entries)",       url: "https://wikipedia.org",           credibility: "COMMUNITY", description: "Crowd-sourced encyclopedia — entries cross-referenced against primary sources before import." },
  telegram_rtn:      { fullName: "@RememberTheirNames (Telegram)",     url: "https://t.me/RememberTheirNames", credibility: "COMMUNITY", description: "Persian-language Telegram channel curating victim photos and short biographies." },
  telegram_vahid:    { fullName: "@VahidOnline (Telegram)",            url: "https://t.me/VahidOnline",        credibility: "COMMUNITY", description: "Large Persian-language Telegram channel (934k subscribers) republishing victim documentation." },
  telegram:          { fullName: "Telegram channels (mixed)",          url: "https://telegram.org",            credibility: "COMMUNITY", description: "Various Persian-language Telegram channels documenting victims." },
  community:         { fullName: "Community submissions",              url: "/submit", credibility: "COMMUNITY", description: "Records submitted directly by families, witnesses, and the diaspora community via the /submit form." },
};

// Map any raw value of `victims.data_source` to a canonical SOURCE_INFO key.
//
// The DB column is free-text and accumulated organically across plugins —
// values include:
//   "iranvictims.com (#6902)"   — per-victim URL with id suffix
//   "boroumand-import"          — bulk-import marker
//   "hra-news (#1234)"          — HRANA scraper variant
//   "iranrevolution,ncri,...,"  — comma-list of multi-source attribution
//   "iran-memorial project"     — internal/manual entries
//
// We collapse all of these to short canonical keys so the page groups
// correctly. Comma-separated attribution takes the FIRST listed source as
// primary (mirrors how the enricher writes them).
function normalizeSourceKey(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Comma-separated multi-source attribution → take first
  if (s.includes(",")) s = s.split(",")[0]!.trim();
  // Strip "(#1234)" id suffix used by per-victim URL sources
  s = s.replace(/\s*\(#\d+\)\s*$/, "");
  // Strip common scheme + www
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");

  // Pattern-based remapping. Order matters — most-specific first.
  if (/^iranvictims/.test(s)) return "iranvictims";
  if (/^iranrevolution/.test(s)) return "iranrevolution";
  if (/^iranmonitor/.test(s)) return "iranmonitor";
  if (/^iranintl|^iran-international/.test(s)) return "iran-international";
  if (/^hrana|^hra-news/.test(s)) return "hrana";
  if (/^hengaw/.test(s)) return "hengaw";
  if (/^boroumand|^iranrights/.test(s)) return "boroumand";
  if (/^iranhr|^ihr-|^ihrngo$/.test(s)) return "ihr";
  if (/^amnesty/.test(s)) return "amnesty";
  if (/^ohchr/.test(s)) return "ohchr";
  if (/^igfm/.test(s)) return "igfm";
  if (/^khrn|^kurdistanhumanrights/.test(s)) return "khrn";
  if (/^cpj/.test(s)) return "cpj";
  if (/^witness/.test(s)) return "witness_report";
  if (/^wikipedia/.test(s)) return "wikipedia";
  // Telegram: keep two large channels separate, merge the rest
  if (/rtn|rememberthe?irnames/.test(s)) return "telegram_rtn";
  if (/vahid/.test(s)) return "telegram_vahid";
  if (/^telegram/.test(s)) return "telegram";
  // Internal / community markers
  if (/^iran-?memorial|^community|^submit/.test(s)) return "community";

  return s; // unmapped raw key — surfaces in the page as-is for follow-up
}

// Tier metadata: order matters (drives section sort), colors match the
// dot-legend on /about so the visual language is consistent across the site.
const TIERS: { key: Tier; label: { en: string; de: string; fa: string }; dot: string; chip: string }[] = [
  {
    key: "HIGH",
    label: { en: "High credibility", de: "Hohe Glaubwürdigkeit", fa: "اعتبار بالا" },
    dot: "bg-emerald-400",
    chip: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  },
  {
    key: "MEDIUM",
    label: { en: "Reputable", de: "Renommiert", fa: "معتبر" },
    dot: "bg-amber-400",
    chip: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  },
  {
    key: "COMMUNITY",
    label: { en: "Community-verified", de: "Community-verifiziert", fa: "تأیید شده توسط جامعه" },
    dot: "bg-memorial-500",
    chip: "text-memorial-300 bg-memorial-500/10 border-memorial-500/30",
  },
];

// Locale-literal strings. Keeping them in-file rather than messages/*.json
// because (a) the page-level wording rarely changes, (b) only three locales
// need real translation right now, (c) the larger i18n migration for the
// /sources namespace stays a separate roadmap item.
const COPY = {
  title:        { en: "Data sources",     de: "Datenquellen",  fa: "منابع داده" },
  lead:         {
    en: "The archive is compiled from independent human-rights data sources, each cross-referenced and annotated with a credibility tier. No record relies on a single source.",
    de: "Das Archiv wird aus unabhängigen Menschenrechts-Datenquellen zusammengestellt, jede einzeln gegengeprüft und mit einer Glaubwürdigkeitsstufe versehen. Kein Eintrag stützt sich auf eine einzige Quelle.",
    fa: "این آرشیو از منابع داده مستقل حقوق بشری گردآوری شده، هر یک گذرسنجی و با درجه اعتبار مشخص شده است. هیچ رکوردی بر یک منبع واحد متکی نیست.",
  },
  statSources:  { en: "Source organizations", de: "Quellen-Organisationen", fa: "سازمان‌های منبع" },
  statRecords:  { en: "Total records",        de: "Datensätze insgesamt",   fa: "کل رکوردها" },
  statVerified: { en: "Verified",             de: "Verifiziert",            fa: "تأیید شده" },
  statHigh:     { en: "High-credibility",     de: "Hohe Glaubwürdigkeit",   fa: "اعتبار بالا" },
  victimsLabel: { en: "records",              de: "Datensätze",             fa: "رکورد" },
  verifiedLabel:{ en: "verified",             de: "verifiziert",            fa: "تأیید شده" },
  methodology:  { en: "Methodology",          de: "Methodik",               fa: "روش‌شناسی" },
  methodologyText: {
    en: "Each entry is cross-referenced against at least two independent sources, including reports from human-rights organizations, news agencies, witness testimonies, and court documents. Records are marked as verified, unverified, or disputed — the tier is always shown openly on the profile.",
    de: "Jeder Eintrag wird mit mindestens zwei unabhängigen Quellen abgeglichen, darunter Berichte von Menschenrechtsorganisationen, Nachrichtenagenturen, Zeugenaussagen und Gerichtsdokumente. Einträge werden als verifiziert, unverifiziert oder umstritten markiert — die Stufe wird stets offen auf dem Profil dargestellt.",
    fa: "هر مورد در برابر حداقل دو منبع مستقل گذرسنجی می‌شود، از جمله گزارش‌های سازمان‌های حقوق بشری، خبرگزاری‌ها، شهادت شاهدان و اسناد دادگاهی. رکوردها به‌عنوان تأییدشده، تأییدنشده یا مورد اختلاف علامت‌گذاری می‌شوند — درجه همیشه به‌طور آشکار در پروفایل نمایش داده می‌شود.",
  },
  methodologyLink: { en: "Read the full methodology →", de: "Vollständige Methodik lesen →", fa: "مطالعه روش‌شناسی کامل →" },
} as const;

function pickLocale(map: { en: string; de: string; fa: string }, locale: Locale): string {
  if (locale === "de") return map.de;
  if (locale === "fa") return map.fa;
  return map.en;
}

function formatNumber(n: number, locale: Locale): string {
  return n.toLocaleString(locale === "fa" ? "fa-IR" : locale === "de" ? "de-DE" : "en-US");
}

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  // Per-source counts: total records + verified count. Cheap aggregate, but
  // we still cache via the revalidate window at the top of the file.
  const sourceCounts = await prisma.$queryRaw<
    { source: string; count: number; verified: number }[]
  >`
    SELECT
      data_source AS source,
      COUNT(*)::int           AS count,
      COUNT(*) FILTER (WHERE verification_status = 'verified')::int AS verified
    FROM victims
    WHERE data_source IS NOT NULL
    GROUP BY data_source
    ORDER BY count DESC
  `;

  // Re-aggregate the SQL groups by normalized source key. The DB stores
  // raw free-text values like "iranvictims.com (#6902)" per victim, so the
  // GROUP BY in SQL produces thousands of one-record sources. Normalizing
  // here collapses them onto the canonical SOURCE_INFO keys.
  type Agg = { count: number; verified: number };
  const grouped = new Map<string, Agg>();
  for (const r of sourceCounts) {
    const key = normalizeSourceKey(r.source);
    const existing = grouped.get(key) ?? { count: 0, verified: 0 };
    existing.count += Number(r.count);
    existing.verified += Number(r.verified);
    grouped.set(key, existing);
  }

  const decorated = Array.from(grouped, ([key, agg]) => {
    const info = SOURCE_INFO[key] || null;
    const tier: Tier = info?.credibility ?? "COMMUNITY";
    return { key, tier, info, count: agg.count, verified: agg.verified };
  }).sort((a, b) => b.count - a.count);

  // Bucket by tier so the page reads top-down: high credibility first, then
  // reputable, then community. Each bucket stays sorted by count desc.
  const byTier: Record<Tier, typeof decorated> = { HIGH: [], MEDIUM: [], COMMUNITY: [] };
  for (const r of decorated) byTier[r.tier].push(r);

  // Summary aggregates for the hero tile row.
  const totalRecords = decorated.reduce((s, r) => s + r.count, 0);
  const totalVerified = decorated.reduce((s, r) => s + r.verified, 0);
  const verifiedPercent = totalRecords > 0 ? Math.round((totalVerified / totalRecords) * 100) : 0;
  const highCredibilityRecords = byTier.HIGH.reduce((s, r) => s + r.count, 0);
  const highCredibilityPercent =
    totalRecords > 0 ? Math.round((highCredibilityRecords / totalRecords) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-memorial-100 mb-3">
          {pickLocale(COPY.title, locale)}
        </h1>
        <p className="text-memorial-400 max-w-2xl leading-relaxed">
          {pickLocale(COPY.lead, locale)}
        </p>
      </header>

      {/* Summary stat tiles — same visual language as /about */}
      <section className="mb-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl bg-memorial-800 overflow-hidden">
          <StatTile label={pickLocale(COPY.statSources, locale)} value={formatNumber(decorated.length, locale)} />
          <StatTile label={pickLocale(COPY.statRecords, locale)} value={formatNumber(totalRecords, locale)} />
          <StatTile
            label={pickLocale(COPY.statVerified, locale)}
            value={`${formatNumber(totalVerified, locale)} (${verifiedPercent}%)`}
          />
          <StatTile
            label={pickLocale(COPY.statHigh, locale)}
            value={`${formatNumber(highCredibilityRecords, locale)} (${highCredibilityPercent}%)`}
          />
        </div>
      </section>

      {/* Tier legend — three dots reused from /about so users learn the
          shared vocabulary in one place. Methodology link sits on the same
          row so people who want the deep dive can leave from here without
          scrolling past every source first. */}
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-memorial-500">
        {TIERS.map((t) => (
          <span key={t.key} className="inline-flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${t.dot}`} aria-hidden />
            {pickLocale(t.label, locale)}
          </span>
        ))}
        <span className="text-memorial-700" aria-hidden>·</span>
        <Link href="/about" className="hover:text-gold-400 transition-colors underline-offset-4 hover:underline">
          {pickLocale(COPY.methodologyLink, locale)}
        </Link>
      </div>

      {/* One section per tier, only rendered when non-empty */}
      <div className="space-y-12">
        {TIERS.map((tier) => {
          const rows = byTier[tier.key];
          if (rows.length === 0) return null;
          return (
            <section key={tier.key}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`inline-block w-2 h-2 rounded-full ${tier.dot}`} aria-hidden />
                <h2 className="text-sm font-semibold tracking-wide text-memorial-200 uppercase">
                  {pickLocale(tier.label, locale)}
                </h2>
                <span className="text-xs text-memorial-500 tabular-nums">
                  {rows.length}
                </span>
                <div className="h-px flex-1 bg-memorial-800" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rows.map((r) => (
                  <SourceCard
                    key={r.key}
                    name={r.info?.fullName || r.key}
                    description={r.info?.description}
                    url={r.info?.url}
                    count={r.count}
                    verified={r.verified}
                    tierChip={tier.chip}
                    tierLabel={pickLocale(tier.label, locale)}
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer methodology box — kept for users who scroll past every source
          and need the long-form explanation in context. */}
      <section className="mt-12 rounded-xl border border-memorial-800 bg-memorial-900/20 p-6">
        <h2 className="font-semibold text-memorial-200 mb-2">
          {pickLocale(COPY.methodology, locale)}
        </h2>
        <p className="text-sm text-memorial-400 leading-relaxed">
          {pickLocale(COPY.methodologyText, locale)}
        </p>
        <Link
          href="/about"
          className="text-sm text-gold-400 hover:text-gold-300 mt-3 inline-block underline-offset-4 hover:underline"
        >
          {pickLocale(COPY.methodologyLink, locale)}
        </Link>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-memorial-950 px-4 py-5 text-center">
      <div className="text-xl sm:text-2xl font-bold text-gold-400 tabular-nums leading-none">
        {value}
      </div>
      <div className="mt-2 text-xs text-memorial-500 leading-snug">{label}</div>
    </div>
  );
}

function SourceCard({
  name,
  description,
  url,
  count,
  verified,
  tierChip,
  tierLabel,
  locale,
}: {
  name: string;
  description?: string;
  url?: string;
  count: number;
  verified: number;
  tierChip: string;
  tierLabel: string;
  locale: Locale;
}) {
  const verifiedPercent = count > 0 ? Math.round((verified / count) * 100) : 0;
  return (
    <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/40 p-4 flex flex-col gap-3">
      {/* Header row: name + tier chip */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-memorial-100 leading-tight min-w-0">
          {name}
        </h3>
        <span
          className={`flex-shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border font-medium ${tierChip}`}
          title={tierLabel}
        >
          {tierLabel}
        </span>
      </div>

      {/* Optional one-line description, truncated to keep cards dense */}
      {description && (
        <p className="text-xs text-memorial-400 leading-relaxed line-clamp-2">
          {description}
        </p>
      )}

      {/* Footer row: counts + external link */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-1">
        <div>
          <div className="text-lg font-bold text-gold-400 tabular-nums leading-none">
            {count.toLocaleString(locale === "fa" ? "fa-IR" : locale === "de" ? "de-DE" : "en-US")}
          </div>
          <div className="mt-1 text-[11px] text-memorial-500 tabular-nums">
            {verified > 0
              ? `${verified.toLocaleString(locale === "fa" ? "fa-IR" : locale === "de" ? "de-DE" : "en-US")} ${
                  locale === "de" ? "verifiziert" : locale === "fa" ? "تأیید شده" : "verified"
                } (${verifiedPercent}%)`
              : locale === "de"
              ? "noch nicht verifiziert"
              : locale === "fa"
              ? "هنوز تأیید نشده"
              : "not yet verified"}
          </div>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gold-400/70 hover:text-gold-400 truncate max-w-[55%]"
            title={url}
          >
            {url.replace(/^https?:\/\//, "")} ↗
          </a>
        )}
      </div>
    </div>
  );
}
