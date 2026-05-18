/** Embeddable live counter widget for Iran Memorial.
 *
 *  Usage:
 *    <iframe src="<SITE_URL>/embed?theme=dark&size=md"
 *            width="100%" height="180" frameborder="0"
 *            title="Iran Memorial — Live Counter" loading="lazy"></iframe>
 *
 *  Query params:
 *    theme = dark | light  (default: dark)
 *    size  = sm | md       (default: md)
 *    locale = en | de | fa | ar | fr | it | es  (default: en)
 *
 *  No conditional logic, no client JS. CC BY-SA 4.0 — attribution baked in. */
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site-url";

const ATTRIBUTION = SITE_URL.replace(/^https?:\/\//, "");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Iran Memorial — Live Counter",
  robots: { index: false, follow: false },
};

const COPY: Record<string, Record<string, string>> = {
  en: {
    documented: "Documented victims",
    verified: "Verified",
    awaiting: "Awaiting verification",
    executions: "Executions",
    in_year: "in",
    cta: "View memorial →",
    attribution: ATTRIBUTION,
  },
  de: {
    documented: "Dokumentierte Opfer",
    verified: "Verifiziert",
    awaiting: "Verifizierung ausstehend",
    executions: "Hinrichtungen",
    in_year: "in",
    cta: "Zum Gedenken →",
    attribution: ATTRIBUTION,
  },
  fa: {
    documented: "قربانیان مستند",
    verified: "تأییدشده",
    awaiting: "در انتظار تأیید",
    executions: "اعدام‌ها",
    in_year: "در",
    cta: "مشاهده یادبود ←",
    attribution: ATTRIBUTION,
  },
  ar: {
    documented: "الضحايا الموثقون",
    verified: "موثَّق",
    awaiting: "بانتظار التحقق",
    executions: "إعدامات",
    in_year: "في",
    cta: "عرض النصب التذكاري ←",
    attribution: ATTRIBUTION,
  },
  fr: {
    documented: "Victimes documentées",
    verified: "Vérifiées",
    awaiting: "En attente de vérification",
    executions: "Exécutions",
    in_year: "en",
    cta: "Voir le mémorial →",
    attribution: ATTRIBUTION,
  },
  it: {
    documented: "Vittime documentate",
    verified: "Verificate",
    awaiting: "In attesa di verifica",
    executions: "Esecuzioni",
    in_year: "nel",
    cta: "Visita il memoriale →",
    attribution: ATTRIBUTION,
  },
  es: {
    documented: "Víctimas documentadas",
    verified: "Verificadas",
    awaiting: "Pendientes de verificación",
    executions: "Ejecuciones",
    in_year: "en",
    cta: "Ver el memorial →",
    attribution: ATTRIBUTION,
  },
};

const RTL_LOCALES = new Set(["fa", "ar"]);

function fmt(n: number, locale: string) {
  try {
    return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale).format(n);
  } catch {
    return n.toLocaleString("en-US");
  }
}

async function loadCounts(year: number) {
  try {
    const [total, verified, executionsThisYear] = await Promise.all([
      prisma.victim.count(),
      prisma.victim.count({ where: { verificationStatus: "verified" } }),
      prisma.victim.count({
        where: {
          dateOfDeath: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          },
          causeOfDeath: { contains: "Execution", mode: "insensitive" },
        },
      }),
    ]);
    return { total, verified, executionsThisYear };
  } catch {
    return { total: 0, verified: 0, executionsThisYear: 0 };
  }
}

export default async function EmbedWidget({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; size?: string; locale?: string }>;
}) {
  const params = await searchParams;
  const theme = params.theme === "light" ? "light" : "dark";
  const size = params.size === "sm" ? "sm" : "md";
  const locale = (params.locale && COPY[params.locale]) ? params.locale : "en";
  const t = COPY[locale];
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";

  const year = new Date().getUTCFullYear();
  const { total, verified, executionsThisYear } = await loadCounts(year);
  const awaiting = Math.max(total - verified, 0);

  const palette =
    theme === "light"
      ? {
          bg: "#fafaf9",
          fg: "#1c1917",
          muted: "#57534e",
          accent: "#a16207", // gold-700
          verified: "#047857", // emerald-700
          execution: "#b91c1c", // red-700
          ring: "#e7e5e4",
        }
      : {
          bg: "#0c0a09",
          fg: "#f5f5f4",
          muted: "#a8a29e",
          accent: "#facc15", // gold-400
          verified: "#34d399", // emerald-400
          execution: "#fb7185", // rose-400
          ring: "#1c1917",
        };

  const numFontSize = size === "sm" ? "1.5rem" : "2rem";
  const labelFontSize = size === "sm" ? "0.625rem" : "0.7rem";
  const padding = size === "sm" ? "12px 16px" : "16px 20px";

  return (
    <div
      dir={dir}
      style={{
        boxSizing: "border-box",
        width: "100%",
        margin: 0,
        padding,
        background: palette.bg,
        color: palette.fg,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        border: `1px solid ${palette.ring}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: size === "sm" ? 8 : 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <Stat
          value={fmt(total, locale)}
          label={t.documented}
          color={palette.accent}
          numFontSize={numFontSize}
          labelFontSize={labelFontSize}
          mutedColor={palette.muted}
        />
        <Stat
          value={fmt(verified, locale)}
          label={t.verified}
          color={palette.verified}
          numFontSize={numFontSize}
          labelFontSize={labelFontSize}
          mutedColor={palette.muted}
        />
        <Stat
          value={fmt(executionsThisYear, locale)}
          label={`${t.executions} ${t.in_year} ${year}`}
          color={palette.execution}
          numFontSize={numFontSize}
          labelFontSize={labelFontSize}
          mutedColor={palette.muted}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.7rem",
          color: palette.muted,
          paddingTop: 6,
          borderTop: `1px solid ${palette.ring}`,
        }}
      >
        <span>
          {fmt(awaiting, locale)} {t.awaiting}
        </span>
        <a
          href={`${SITE_URL}/${locale}`}
          target="_top"
          rel="noopener"
          style={{
            color: palette.accent,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          {t.cta}
        </a>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  color,
  numFontSize,
  labelFontSize,
  mutedColor,
}: {
  value: string;
  label: string;
  color: string;
  numFontSize: string;
  labelFontSize: string;
  mutedColor: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: numFontSize,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: labelFontSize,
          color: mutedColor,
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
