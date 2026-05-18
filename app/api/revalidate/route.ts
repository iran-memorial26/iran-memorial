/** ISR cache invalidation endpoint.
 *  POST { secret, path? }  — revalidates a specific path
 *  POST { secret, paths: [] } — revalidates multiple paths
 *  POST { secret }  — revalidates the homepage and key list pages
 *
 *  Used by the enricher pipeline after `enrich --resume` completes
 *  to push freshly imported victims into the cached pages.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const DEFAULT_PATHS = [
  "/",
  "/[locale]",
  "/[locale]/statistics",
  "/[locale]/executions",
  "/[locale]/imprisoned",
  "/[locale]/death-row",
  "/[locale]/anonymous-victims",
  "/[locale]/map",
  "/feed.xml",
  "/feed.json",
  "/sitemap.xml",
];

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "REVALIDATE_SECRET not configured" }, { status: 500 });
  }

  let body: { secret?: string; path?: string; paths?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paths = body.paths ?? (body.path ? [body.path] : DEFAULT_PATHS);
  const revalidated: string[] = [];
  for (const p of paths) {
    try {
      revalidatePath(p, p.includes("[") ? "page" : undefined);
      revalidated.push(p);
    } catch {
      // continue on individual failures
    }
  }

  return NextResponse.json({ revalidated, count: revalidated.length });
}
