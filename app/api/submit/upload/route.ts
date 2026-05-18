import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Files for *pending* submissions land in a shard folder by UUID prefix so a
// single directory never grows unbounded (mirrors the /var/photos pattern).
// Path is unguessable but still publicly servable via the existing /uploads
// Next.js static-serve — admin moderation will copy approved media to a
// stable location during the convert-to-victim step.
const UPLOAD_ROOT = join(process.cwd(), "public", "uploads", "pending");

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Magic-byte check rejects extension/MIME spoofing. Format: {ext, sig, offset}
// where sig is matched at byte offset (most signatures start at 0).
type Sig = { ext: string; mime: string; sig: number[]; offset?: number };
const SIGNATURES: Sig[] = [
  // images
  { ext: "jpg", mime: "image/jpeg", sig: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: "webp", mime: "image/webp", sig: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" after RIFF header
  { ext: "gif", mime: "image/gif", sig: [0x47, 0x49, 0x46, 0x38] },
  // videos (all use the ISO base media file format with "ftyp" at offset 4)
  { ext: "mp4", mime: "video/mp4", sig: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { ext: "mov", mime: "video/quicktime", sig: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { ext: "webm", mime: "video/webm", sig: [0x1a, 0x45, 0xdf, 0xa3] },
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
  // Per-IP rate limit: 3 uploads/hour for public submissions. Tighter than
  // the /api/submit endpoint (5/hr) because file uploads are a heavier abuse
  // vector (DoS via disk fill, illegal-content hosting).
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const { success, remaining, resetAt } = await rateLimit(ip, "submit-upload", 3, 3600);
  if (!success) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  // Validate by file content, not by the client-sent MIME or filename.
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectFormat(bytes.subarray(0, 32));
  if (!detected) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: jpg, png, webp, gif, mp4, mov, webm" },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const shard = id.slice(0, 2);
  const filename = `${id}.${detected.ext}`;
  const relDir = join("uploads", "pending", shard);
  const absDir = join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  const absPath = join(absDir, filename);
  await writeFile(absPath, bytes);

  // Returned URL is what the form will store in the submission JSON's
  // media_urls field, so admins can preview the file during review.
  return NextResponse.json(
    {
      url: `/${relDir}/${filename}`,
      mime: detected.mime,
      size: file.size,
    },
    { status: 201, headers: { "X-RateLimit-Remaining": String(remaining) } },
  );
}
