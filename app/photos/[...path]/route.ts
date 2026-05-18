import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

// Mounted from the host as a read-only volume — see docker-compose.yml.
// All mirrored victim photos live under PHOTO_STORE/{aa}/{filename} where
// {aa} is the first two chars of the photo id, to keep any one directory
// under a few thousand files.
const PHOTO_STORE = process.env.PHOTO_STORE || "/app/photos-store";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Defense-in-depth: reject any segment containing path-traversal artifacts
  // before resolution. Resolved path must also stay under PHOTO_STORE.
  for (const s of segments) {
    if (!s || s === "." || s === ".." || s.includes("\0") || s.includes("/")) {
      return new Response("Bad path", { status: 400 });
    }
  }
  const rel = path.posix.join(...segments);
  const abs = path.resolve(PHOTO_STORE, rel);
  if (!abs.startsWith(path.resolve(PHOTO_STORE) + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  let stats;
  try {
    stats = await stat(abs);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stats.isFile()) return new Response("Not found", { status: 404 });

  const ext = path.extname(abs).toLowerCase();
  const stream = createReadStream(abs);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": MIME[ext] || "application/octet-stream",
      "content-length": String(stats.size),
      // 1 year — id-keyed paths are immutable.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
