import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVictimBySlug } from "@/lib/queries";
import { getCaseStatus } from "@/lib/status";

// Vazirmatn font binaries are read once per process and cached. Without an
// RTL font Satori cannot perform Arabic letter joining and Persian names
// render as visually-broken isolated glyphs. Bundled in public/fonts/.
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
  // Node Buffer is a Uint8Array view — slice to a clean ArrayBuffer for Satori.
  const toAb = (b: Buffer): ArrayBuffer =>
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  cachedFonts = [
    { name: "Vazirmatn", data: toAb(reg), weight: 400, style: "normal" },
    { name: "Vazirmatn", data: toAb(bold), weight: 700, style: "normal" },
  ];
  return cachedFonts;
}

// Status -> hex color. STATUS_CONFIG.color from lib/status is a Tailwind
// utility (e.g. "text-blood-400") and cannot be used in ImageResponse's
// inline-styles renderer. Mirror the design tokens here.
const STATUS_COLOR: Record<string, string> = {
  executed: "#ef4444",
  imprisoned: "#cba35a",
  death_in_custody: "#ef4444",
  killed: "#ef4444",
  deceased: "#cba35a",
};

// Node runtime so we can reach Prisma (Postgres + photo table).
export const runtime = "nodejs";
// Cache aggressively — OG images change only when the victim record does.
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

const STATUS_LABEL: Record<string, Record<string, string>> = {
  en: { executed: "Executed", imprisoned: "Imprisoned", death_in_custody: "Died in custody", killed: "Killed", deceased: "Deceased" },
  de: { executed: "Hingerichtet", imprisoned: "Inhaftiert", death_in_custody: "In Haft verstorben", killed: "Getötet", deceased: "Verstorben" },
  fa: { executed: "اعدام شده", imprisoned: "زندانی", death_in_custody: "درگذشته در بازداشت", killed: "کشته شده", deceased: "درگذشته" },
};

const TAGLINE: Record<string, string> = {
  en: "Every victim has a name.",
  de: "Jedes Opfer hat einen Namen.",
  fa: "هر قربانی نامی دارد.",
  ar: "لكل ضحية اسم.",
  fr: "Chaque victime a un nom.",
  it: "Ogni vittima ha un nome.",
  es: "Cada víctima tiene un nombre.",
};

function pickStatusLabel(status: string, lang: string): string {
  return (
    STATUS_LABEL[lang]?.[status] ||
    STATUS_LABEL.en[status] ||
    STATUS_LABEL.en.deceased
  );
}

function formatYearRange(birth: Date | string | null, death: Date | string | null): string {
  const b = birth ? new Date(birth).getUTCFullYear() : null;
  const d = death ? new Date(death).getUTCFullYear() : null;
  if (b && d) return `${b}–${d}`;
  if (d) return `${d}`;
  if (b) return `${b}–`;
  return "";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await params;
  const lang = request.nextUrl.searchParams.get("lang") || "en";

  const victim = await getVictimBySlug(slug);
  if (!victim) {
    return new Response("Not found", { status: 404 });
  }

  const status = getCaseStatus(victim.causeOfDeath, victim.dateOfDeath);
  const statusLabel = pickStatusLabel(status, lang);
  const statusColor = STATUS_COLOR[status] || "#cba35a";

  const name = victim.nameLatin;
  const nameFa = victim.nameFarsi;
  const years = formatYearRange(victim.dateOfBirth, victim.dateOfDeath);
  const placeRaw =
    (victim as any).city?.nameEn ||
    (victim as any).placeOfDeath ||
    "";

  const photoUrl =
    (victim as any).photos?.[0]?.url || (victim as any).photoUrl || null;

  // Absolute URL for the photo — ImageResponse fetches it from the edge.
  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const absolutePhoto = photoUrl
    ? photoUrl.startsWith("http")
      ? photoUrl
      : `${siteBase}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`
    : null;

  const tagline = TAGLINE[lang] || TAGLINE.en;
  const fonts = await loadFonts();

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
        {/* Subtle radial gradient — blood-red wash like the site hero */}
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

        {/* Body */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: "56px",
            marginTop: 24,
          }}
        >
          {/* Photo or candle fallback */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 360,
              height: 360,
              borderRadius: 16,
              backgroundColor: "#141821",
              border: "2px solid #2a2f3a",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {absolutePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={absolutePhoto}
                width={360}
                height={360}
                style={{ objectFit: "cover", width: 360, height: 360 }}
                alt=""
              />
            ) : (
              <span style={{ fontSize: 160 }}>🕯</span>
            )}
          </div>

          {/* Text column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 60,
                fontWeight: 700,
                lineHeight: 1.05,
                color: "#fafbfc",
              }}
            >
              {name}
            </div>
            {nameFa && (
              <div
                style={{
                  display: "flex",
                  fontSize: 38,
                  color: "#a8aebb",
                  lineHeight: 1.1,
                  fontFamily: "Vazirmatn",
                  direction: "rtl",
                }}
              >
                {nameFa}
              </div>
            )}
            {years && (
              <div
                style={{
                  display: "flex",
                  fontSize: 32,
                  color: "#7c8493",
                  marginTop: 8,
                }}
              >
                {years}
                {placeRaw ? `  ·  ${placeRaw}` : ""}
              </div>
            )}

            {/* Status badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                padding: "10px 22px",
                borderRadius: 999,
                backgroundColor: "rgba(203, 163, 90, 0.10)",
                border: `2px solid ${statusColor}`,
                color: statusColor,
                fontSize: 26,
                fontWeight: 600,
                marginTop: 16,
              }}
            >
              {statusLabel}
            </div>
          </div>
        </div>

        {/* Footer tagline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "#7c8493",
            borderTop: "1px solid #2a2f3a",
            paddingTop: 20,
          }}
        >
          <span style={{ fontStyle: "italic" }}>{tagline}</span>
          <span style={{ color: "#5a6373" }}>{siteBase.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts,
      headers: {
        // Edge + CDN cache. Re-fetch only after revalidate window.
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
