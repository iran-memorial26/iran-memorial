import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";
import { SITE_URL } from "@/lib/site-url";

const EXPORT_FIELDS = `
  v.slug, v.name_latin, v.name_farsi, v.aliases,
  v.date_of_birth, v.place_of_birth, v.gender, v.ethnicity, v.religion, v.photo_url,
  v.occupation_en, v.occupation_fa, v.education,
  v.date_of_death, v.age_at_death, v.place_of_death, v.province,
  v.cause_of_death, v.circumstances_en, v.circumstances_fa,
  v.event_context, v.responsible_forces,
  v.burial_location, v.verification_status, v.data_source
`.trim();

export async function GET(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const { success } = await rateLimit(ip, "export", 10, 3600); // 10 exports per hour

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") || "json";

  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { error: "Invalid format. Use ?format=json or ?format=csv" },
      { status: 400 }
    );
  }

  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT ${Prisma.raw(EXPORT_FIELDS)} FROM victims v ORDER BY v.date_of_death DESC NULLS LAST`
  );

  const mapped = rows.map((r) => ({
    slug: r.slug,
    name_latin: r.name_latin,
    name_farsi: r.name_farsi || "",
    aliases: Array.isArray(r.aliases) ? r.aliases.join("; ") : "",
    date_of_birth: r.date_of_birth ? new Date(r.date_of_birth).toISOString().split("T")[0] : "",
    place_of_birth: r.place_of_birth || "",
    gender: r.gender || "",
    ethnicity: r.ethnicity || "",
    religion: r.religion || "",
    photo_url: r.photo_url || "",
    occupation_en: r.occupation_en || "",
    occupation_fa: r.occupation_fa || "",
    education: r.education || "",
    date_of_death: r.date_of_death ? new Date(r.date_of_death).toISOString().split("T")[0] : "",
    age_at_death: r.age_at_death != null ? String(r.age_at_death) : "",
    place_of_death: r.place_of_death || "",
    province: r.province || "",
    cause_of_death: r.cause_of_death || "",
    circumstances_en: r.circumstances_en || "",
    circumstances_fa: r.circumstances_fa || "",
    event_context: r.event_context || "",
    responsible_forces: r.responsible_forces || "",
    burial_location: r.burial_location || "",
    verification_status: r.verification_status || "",
    data_source: r.data_source || "",
  }));

  if (format === "csv") {
    const headers = Object.keys(mapped[0] || {});
    const csvLines = [headers.join(",")];
    for (const row of mapped) {
      csvLines.push(
        headers
          .map((h) => {
            const val = (row as Record<string, string>)[h] || "";
            // Escape CSV: quote if contains comma, newline, or quote
            if (val.includes(",") || val.includes("\n") || val.includes('"')) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          })
          .join(",")
      );
    }
    return new NextResponse(csvLines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="iran-memorial-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  // JSON format
  return NextResponse.json(
    {
      meta: {
        total: mapped.length,
        exported_at: new Date().toISOString(),
        source: `Iran Memorial — ${SITE_URL.replace(/^https?:\/\//, "")}`,
        license: "CC BY-SA 4.0",
      },
      victims: mapped,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="iran-memorial-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    }
  );
}
