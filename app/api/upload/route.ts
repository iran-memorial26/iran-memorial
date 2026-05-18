import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic-byte signatures — rejects MIME/extension spoofing (SVG-as-JPEG, PHP-as-PNG, etc.)
type Sig = { ext: string; mime: string; sig: number[]; offset?: number };
const SIGNATURES: Sig[] = [
  { ext: "jpg", mime: "image/jpeg", sig: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: "webp", mime: "image/webp", sig: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" after RIFF header
];

function detectFormat(buf: Buffer): Sig | null {
  for (const s of SIGNATURES) {
    const offset = s.offset ?? 0;
    if (buf.length < offset + s.sig.length) continue;
    let match = true;
    for (let i = 0; i < s.sig.length; i++) {
      if (buf[offset + i] !== s.sig[i]) { match = false; break; }
    }
    if (match) return s;
  }
  return null;
}

export async function POST(request: NextRequest) {
  // Auth: two-layer check (INTERNAL_AUTH_TOKEN + ADMIN_USERS allowlist)
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = request.headers.get("x-forwarded-user") ?? "admin";

  // Rate limit: 20 uploads per hour per user
  const { success: withinLimit } = await rateLimit(user, "upload", 20, 3600);
  if (!withinLimit) {
    return NextResponse.json({ error: "Upload rate limit exceeded (20/hr)" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const victimId = formData.get("victimId") as string | null;
  const caption = formData.get("caption") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!victimId) {
    return NextResponse.json({ error: "victimId required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  // Validate by magic bytes — never trust client-supplied MIME type or filename.
  // A PNG renamed to .jpg or an SVG with Content-Type: image/jpeg both fail here.
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectFormat(bytes.subarray(0, 32));
  if (!detected) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: jpg, png, webp" },
      { status: 400 },
    );
  }

  // Verify victim exists
  const victim = await prisma.victim.findUnique({ where: { id: victimId }, select: { id: true, slug: true } });
  if (!victim) {
    return NextResponse.json({ error: "Victim not found" }, { status: 404 });
  }

  // Create upload directory
  await mkdir(UPLOAD_DIR, { recursive: true });

  // Derive extension from magic bytes (never from filename or client MIME — avoids extension spoofing)
  const ext = detected.ext;
  const filename = `${victim.slug}-${Date.now()}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  // Write file
  await writeFile(filepath, bytes);

  // Create Photo record
  const existingPhotos = await prisma.photo.count({ where: { victimId } });
  const photo = await prisma.photo.create({
    data: {
      victimId,
      url: `/uploads/${filename}`,
      captionEn: caption || null,
      photoType: "portrait",
      isPrimary: existingPhotos === 0,
      sortOrder: existingPhotos,
    },
  });

  return NextResponse.json({
    id: photo.id,
    url: photo.url,
    isPrimary: photo.isPrimary,
  }, { status: 201 });
}
