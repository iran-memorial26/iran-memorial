import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Match = {
  photoId: string;
  url: string;
  victimId: string | null;
  victimSlug: string | null;
  victimName: string | null;
  victimNameFa: string | null;
  distance: number;
};

/** GET /api/admin/photo-similar?phash=<int64>&max=8&limit=50
 *  GET /api/admin/photo-similar?photo_id=<uuid>&max=8
 *
 * Returns photos with perceptual hash within Hamming distance `max` of either
 * the supplied pHash integer or the pHash of an existing photo by id.
 * Hamming-distance computed via pg14 bit_count(p.phash # $1).
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const maxDistance = Math.min(Math.max(parseInt(url.searchParams.get("max") || "8", 10), 0), 32);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const phashParam = url.searchParams.get("phash");
  const photoIdParam = url.searchParams.get("photo_id");

  let target: bigint | null = null;

  if (phashParam) {
    try {
      target = BigInt(phashParam);
    } catch {
      return NextResponse.json({ error: "Invalid phash" }, { status: 400 });
    }
  } else if (photoIdParam) {
    const row = await prisma.photo.findUnique({
      where: { id: photoIdParam },
      select: { phash: true },
    });
    if (!row?.phash) {
      return NextResponse.json({ error: "Photo not found or not hashed" }, { status: 404 });
    }
    target = row.phash;
  } else {
    return NextResponse.json(
      { error: "Provide either `phash` (int64) or `photo_id` (uuid)" },
      { status: 400 },
    );
  }

  const rows = await prisma.$queryRaw<
    {
      id: string;
      url: string;
      victim_id: string | null;
      slug: string | null;
      name_latin: string | null;
      name_farsi: string | null;
      distance: number;
    }[]
  >`
    SELECT p.id::text AS id,
           p.url,
           p.victim_id::text AS victim_id,
           v.slug,
           v.name_latin,
           v.name_farsi,
           bit_count(p.phash # ${target})::int AS distance
      FROM photos p
      LEFT JOIN victims v ON v.id = p.victim_id
     WHERE p.phash IS NOT NULL
       AND bit_count(p.phash # ${target}) <= ${maxDistance}
     ORDER BY distance ASC
     LIMIT ${limit}
  `;

  const matches: Match[] = rows.map((r) => ({
    photoId: r.id,
    url: r.url,
    victimId: r.victim_id,
    victimSlug: r.slug,
    victimName: r.name_latin,
    victimNameFa: r.name_farsi,
    distance: r.distance,
  }));

  return NextResponse.json({ target: String(target), maxDistance, total: matches.length, matches });
}
