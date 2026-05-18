import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET: Fetch approved comments for a victim
export async function GET(request: NextRequest) {
  const victimId = request.nextUrl.searchParams.get("victimId");
  if (!victimId) {
    return NextResponse.json({ error: "victimId required" }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: { victimId, status: "approved" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      authorName: true,
      content: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ comments });
}

// POST: Submit a new comment (pending moderation)
export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const { success, remaining } = await rateLimit(ip, "comment", 10, 3600);
  if (!success) {
    return NextResponse.json(
      { error: "Too many comments. Please try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }

  let body: { victimId?: string; authorName?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { victimId, authorName, content } = body;

  if (!victimId || typeof victimId !== "string") {
    return NextResponse.json({ error: "victimId required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length < 3) {
    return NextResponse.json({ error: "Content must be at least 3 characters" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Content too long (max 2000 chars)" }, { status: 400 });
  }

  // Verify victim exists
  const victim = await prisma.victim.findUnique({ where: { id: victimId }, select: { id: true } });
  if (!victim) {
    return NextResponse.json({ error: "Victim not found" }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: {
      victimId,
      authorName: authorName?.slice(0, 100) || null,
      content: content.trim().slice(0, 2000),
      status: "pending",
    },
    select: { id: true, createdAt: true },
  });

  // Notify via webhook (fire and forget)
  notify({
    type: "comment",
    title: "New Comment Posted",
    details: `By: ${authorName || "Anonymous"}\nVictim ID: ${victimId}\nContent: ${content.trim().slice(0, 200)}`,
  });

  return NextResponse.json({ id: comment.id, status: "pending" }, { status: 201 });
}
