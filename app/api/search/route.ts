import { NextRequest, NextResponse } from "next/server";
import { searchVictims } from "@/lib/queries";
import { rateLimit } from "@/lib/rate-limit";
import { getVictimsIndex, type VictimDoc } from "@/lib/meili";

const MEILI_TIMEOUT_MS = 800;

interface SearchResult {
  id: string;
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: Date | string | null;
  placeOfDeath: string | null;
}

async function searchViaMeili(q: string, limit: number): Promise<SearchResult[] | null> {
  const index = getVictimsIndex();
  if (!index) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MEILI_TIMEOUT_MS);
    const res = await Promise.race([
      index.search<VictimDoc>(q, { limit }),
      new Promise<never>((_, reject) => {
        ctrl.signal.addEventListener("abort", () => reject(new Error("meili-timeout")));
      }),
    ]);
    clearTimeout(timer);
    return res.hits.map((h) => ({
      id: h.id,
      slug: h.slug,
      nameLatin: h.nameLatin,
      nameFarsi: h.nameFarsi,
      dateOfDeath: h.dateOfDeath ? new Date(h.dateOfDeath * 1000).toISOString() : null,
      placeOfDeath: h.placeOfDeath ?? h.cityNameEn ?? null,
    }));
  } catch {
    return null; // signal fallback to tsvector
  }
}

async function searchViaPg(q: string, limit: number): Promise<SearchResult[]> {
  const results = await searchVictims(q, limit);
  return results.map((v) => ({
    id: v.id,
    slug: v.slug,
    nameLatin: v.nameLatin,
    nameFarsi: v.nameFarsi,
    dateOfDeath: v.dateOfDeath,
    placeOfDeath: v.placeOfDeath,
  }));
}

export async function GET(request: NextRequest) {
  // Rate limit: 100 requests per minute per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success } = await rateLimit(ip, "search", 100, 60);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") || "";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Try Meili (fast, typo-tolerant, multi-script). Fallback to tsvector if
    // Meili is down/unconfigured — search must never go fully unavailable.
    const meiliHits = await searchViaMeili(q, limit);
    if (meiliHits !== null) {
      return NextResponse.json({ results: meiliHits, engine: "meili" });
    }
    const pgHits = await searchViaPg(q, limit);
    return NextResponse.json({ results: pgHits, engine: "pg" });
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
