import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/utils";
import { translateCause } from "@/lib/translate";
import { getCaseStatus, STATUS_CONFIG } from "@/lib/status";
import { MemorialPhoto } from "@/components/MemorialPhoto";

type VictimCardProps = {
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: Date | string | null;
  placeOfDeath: string | null;
  causeOfDeath: string | null;
  photoUrl: string | null;
  locale: Locale;
  ageAtDeath?: number | null;
  verificationStatus?: string;
  /** Free-text "Branch 15 of Tehran Revolutionary Court (Judge Salavati); ..."
   *  — when present, the card extracts and badges the named court/judge. */
  responsibleForces?: string | null;
};

/** Localized tooltip for the verified-checkmark chip. Kept as a small inline
 *  map to keep VictimCard a pure server component without a translation lookup. */
const VERIFIED_LABEL: Record<string, string> = {
  en: "Verified — corroborated by trusted sources",
  de: "Verifiziert — durch vertrauenswürdige Quellen bestätigt",
  fa: "تأیید شده — توسط منابع معتبر تأیید شده است",
  ar: "موثَّق — مؤكَّد من مصادر موثوقة",
  fr: "Vérifié — corroboré par des sources fiables",
  it: "Verificato — confermato da fonti affidabili",
  es: "Verificado — corroborado por fuentes confiables",
};

/** Pull the most distinctive court / judge mention from a responsible_forces
 *  string. Returns null for generic phrases like "Islamic Republic security
 *  forces" so the card stays clean. */
function extractAccountabilityBadge(rf: string | null | undefined): { label: string; icon: string } | null {
  if (!rf) return null;
  // Prefer judge — most actionable for sanctions
  const judge = rf.match(/Judge\s+([A-Z][a-zA-Z\-' ]+?)(?:\)|;|,|$)/);
  if (judge) {
    const tokens = judge[1].trim().split(/\s+/);
    return { label: `Judge ${tokens[tokens.length - 1]}`, icon: "👤" };
  }
  const branch = rf.match(/(Branch\s+\d+\s+(?:of\s+)?[A-Z][a-zA-Z\- ]+?\s+Revolutionary Court)/);
  if (branch) return { label: branch[1], icon: "⚖" };
  const court = rf.match(/((?:Islamic\s+)?Revolutionary Court of\s+[A-Z][a-zA-Z\- ]+)/);
  if (court) return { label: court[1], icon: "⚖" };
  return null;
}

export function VictimCard({
  slug,
  nameLatin,
  nameFarsi,
  dateOfDeath,
  placeOfDeath,
  causeOfDeath,
  photoUrl,
  locale,
  ageAtDeath,
  verificationStatus,
  responsibleForces,
}: VictimCardProps) {
  const displayName = locale === "fa" && nameFarsi ? nameFarsi : nameLatin;
  const caseStatus = getCaseStatus(causeOfDeath, dateOfDeath);
  const statusCfg = STATUS_CONFIG[caseStatus];
  const isAlive = !dateOfDeath;
  const accountability = extractAccountabilityBadge(responsibleForces);

  return (
    <Link
      href={`/victims/${slug}`}
      className="group block rounded-lg border border-memorial-800 bg-memorial-900/50 p-4 transition-all hover:border-memorial-600 hover:bg-memorial-800/50 shadow-sm shadow-black/10 hover:shadow-md hover:shadow-black/20"
    >
      <div className="flex items-start gap-4">
        {/* Photo — candle fallback on missing / failed load */}
        <MemorialPhoto
          src={photoUrl}
          alt={nameLatin}
          sizes="64px"
          className={`h-16 w-16 flex-shrink-0 ring-1 ${isAlive ? "ring-amber-500/50" : "ring-memorial-700/50"}`}
        />

        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-memorial-100 group-hover:text-gold-400 transition-colors truncate flex items-center gap-1.5">
            {displayName}
            {verificationStatus === "verified" && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex-shrink-0"
                title={VERIFIED_LABEL[locale] || VERIFIED_LABEL.en}
                aria-label={VERIFIED_LABEL[locale] || VERIFIED_LABEL.en}
              >
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 6.5l2.5 2.5 4.5-5" />
                </svg>
              </span>
            )}
          </h3>
          {locale !== "fa" && nameFarsi && (
            <p className="text-sm text-memorial-400 mt-0.5" dir="rtl">{nameFarsi}</p>
          )}

          {/* Case status badge — shape is redundant with color for
              color-blind users; both are aria-hidden because the visible
              label carries the same information for screen readers. */}
          <span className={`inline-flex items-center gap-1 mt-1 text-xs px-1.5 py-0.5 rounded ${statusCfg.bgColor} ${statusCfg.borderColor} ${statusCfg.color} border`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} aria-hidden />
            <span aria-hidden className="font-bold leading-none">{statusCfg.shape}</span>
            {statusCfg.label[locale] || statusCfg.label.en}
          </span>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-memorial-500">
            {dateOfDeath ? (
              <span>{formatDate(dateOfDeath, locale)}</span>
            ) : (
              <span className="text-amber-500/70 text-xs">–</span>
            )}
            {ageAtDeath && <span>({ageAtDeath})</span>}
            {placeOfDeath && <span>{placeOfDeath}</span>}
          </div>
          {causeOfDeath && (
            <p className="mt-1 text-xs text-blood-400">{translateCause(causeOfDeath, locale)}</p>
          )}
          {accountability && (
            <p className="mt-1 text-xs text-memorial-500" title={responsibleForces || undefined}>
              <span className="me-1">{accountability.icon}</span>
              {accountability.label}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
