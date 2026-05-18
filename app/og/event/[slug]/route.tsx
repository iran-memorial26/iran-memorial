import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEventBySlug, localized } from "@/lib/queries";
import type { Locale } from "@/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

const TAGLINE: Record<string, string> = {
  en: "Every victim has a name.",
  de: "Jedes Opfer hat einen Namen.",
  fa: "هر قربانی نامی دارد.",
  ar: "لكل ضحية اسم.",
  fr: "Chaque victime a un nom.",
  it: "Ogni vittima ha un nome.",
  es: "Cada víctima tiene un nombre.",
};

const KILLED_LABEL: Record<string, string> = {
  en: "killed",
  de: "getötet",
  fa: "کشته شده",
  ar: "قُتل",
  fr: "tués",
  it: "uccisi",
  es: "asesinados",
};

const DOCUMENTED_LABEL: Record<string, string> = {
  en: "documented",
  de: "dokumentiert",
  fa: "ثبت شده",
  ar: "موثَّق",
  fr: "documentés",
  it: "documentati",
  es: "documentados",
};

// Same Vazirmatn loader pattern as /og/victim/[slug] so RTL titles render
// with proper Arabic letter joining. Cached per process.
let cachedFonts:
  | { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
  | null = null;

async function loadFonts() {
  if (cachedFonts) return cachedFonts;
  const dir = path.join(process.cwd(), "public", "fonts");
  const [reg, bold] = await Promise.all([
    readFile(path.join(dir, "Vazirmatn-Regular.ttf")),
    readFile(path.join(dir, "Vazirmatn-Bold.ttf")),
  ]);
  const toAb = (b: Buffer): ArrayBuffer =>
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  cachedFonts = [
    { name: "Vazirmatn", data: toAb(reg), weight: 400, style: "normal" },
    { name: "Vazirmatn", data: toAb(bold), weight: 700, style: "normal" },
  ];
  return cachedFonts;
}

function formatYearRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  const s = start ? new Date(start).getUTCFullYear() : null;
  const e = end ? new Date(end).getUTCFullYear() : null;
  if (s && e && s !== e) return `${s}–${e}`;
  if (s) return `${s}`;
  return "";
}

function formatKilled(low: number | null, high: number | null): string | null {
  if (low == null && high == null) return null;
  if (low != null && high != null && low !== high) {
    return `${low.toLocaleString()}–${high.toLocaleString()}`;
  }
  const n = high ?? low ?? 0;
  return n.toLocaleString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await params;
  const lang = (request.nextUrl.searchParams.get("lang") || "en") as Locale;
  const siteDomain = (process.env.NEXT_PUBLIC_SITE_URL || "localhost:3000").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const event = await getEventBySlug(slug);
  if (!event) return new Response("Not found", { status: 404 });

  const title = localized(event, "title", lang) || (event as any).titleEn || slug;
  const description =
    localized(event, "description", lang) ||
    (event as any).descriptionEn ||
    "";
  const years = formatYearRange((event as any).dateStart, (event as any).dateEnd);
  const killed = formatKilled(
    (event as any).estimatedKilledLow,
    (event as any).estimatedKilledHigh
  );
  const documented = (event as any).totalVictims;

  // Truncate description to fit the card without overflow.
  const shortDesc =
    description.length > 180 ? description.slice(0, 177) + "…" : description;

  const tagline = TAGLINE[lang] || TAGLINE.en;
  const killedLabel = KILLED_LABEL[lang] || KILLED_LABEL.en;
  const documentedLabel = DOCUMENTED_LABEL[lang] || DOCUMENTED_LABEL.en;

  // Pick a font family stack — Vazirmatn covers Latin too, but lighter
  // system-ui is crisper for Latin headings.
  const fonts = await loadFonts();
  const isRtl = lang === "fa" || lang === "ar" || lang === "he" || lang === "ckb" || lang === "ur";
  const titleFontFamily = isRtl ? "Vazirmatn" : "system-ui, sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0d12",
          color: "#e8eaed",
          fontFamily: "system-ui, sans-serif",
          padding: "56px 72px",
          position: "relative",
        }}
      >
        {/* Atmospheric blood-red radial wash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, rgba(160, 30, 30, 0.10) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Header: brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 28,
            color: "#cba35a",
            letterSpacing: 1.5,
          }}
        >
          <span style={{ fontSize: 36 }}>🕯</span>
          <span style={{ color: "#e8eaed", fontWeight: 600 }}>
            Iran Memorial
          </span>
        </div>

        {/* Body: title, dates, description, stats */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 18,
            marginTop: 16,
          }}
        >
          {years && (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: "#cba35a",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {years}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#fafbfc",
              fontFamily: titleFontFamily,
              direction: isRtl ? "rtl" : "ltr",
            }}
          >
            {title}
          </div>
          {shortDesc && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: "#a8aebb",
                lineHeight: 1.35,
                maxWidth: 980,
                fontFamily: isRtl ? "Vazirmatn" : "system-ui, sans-serif",
                direction: isRtl ? "rtl" : "ltr",
              }}
            >
              {shortDesc}
            </div>
          )}

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 28,
              marginTop: 10,
            }}
          >
            {killed && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "14px 24px",
                  borderRadius: 12,
                  border: "2px solid rgba(239, 68, 68, 0.45)",
                  backgroundColor: "rgba(239, 68, 68, 0.10)",
                }}
              >
                <span
                  style={{
                    fontSize: 38,
                    fontWeight: 700,
                    color: "#ef4444",
                    lineHeight: 1,
                  }}
                >
                  {killed}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    color: "#a8aebb",
                    marginTop: 6,
                  }}
                >
                  {killedLabel}
                </span>
              </div>
            )}
            {typeof documented === "number" && documented > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "14px 24px",
                  borderRadius: 12,
                  border: "2px solid rgba(203, 163, 90, 0.45)",
                  backgroundColor: "rgba(203, 163, 90, 0.10)",
                }}
              >
                <span
                  style={{
                    fontSize: 38,
                    fontWeight: 700,
                    color: "#cba35a",
                    lineHeight: 1,
                  }}
                >
                  {documented.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    color: "#a8aebb",
                    marginTop: 6,
                  }}
                >
                  {documentedLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer tagline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#7c8493",
            borderTop: "1px solid #2a2f3a",
            paddingTop: 18,
          }}
        >
          <span style={{ fontStyle: "italic", fontFamily: isRtl ? "Vazirmatn" : "system-ui, sans-serif" }}>{tagline}</span>
          <span style={{ color: "#5a6373" }}>{siteDomain}</span>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
