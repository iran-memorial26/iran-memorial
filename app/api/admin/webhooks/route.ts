import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { isBlockedUrl } from "@/lib/webhook-url-guard";
import { isAdmin } from "@/lib/admin-auth";

function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}


// GET /api/admin/webhooks — List all webhooks
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const apiKeyId = searchParams.get("apiKeyId");

  const webhooks = await prisma.webhook.findMany({
    where: apiKeyId ? { apiKeyId } : undefined,
    select: {
      id: true,
      apiKeyId: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      apiKey: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(JSON.stringify({
    audit: true,
    action: "webhook.listed",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    count: webhooks.length,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ webhooks });
}

// POST /api/admin/webhooks — Create new webhook
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { apiKeyId, url, events } = body;

  // Validation
  if (!apiKeyId || typeof apiKeyId !== "string") {
    return NextResponse.json({ error: "Invalid apiKeyId" }, { status: 400 });
  }

  if (!url || typeof url !== "string" || isBlockedUrl(url)) {
    return NextResponse.json({ error: "Invalid or disallowed webhook URL. Must be a public HTTPS URL." }, { status: 400 });
  }

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "Events array required" }, { status: 400 });
  }

  const validEvents = ["victim.created", "submission.approved"];
  const invalidEvents = events.filter((e) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return NextResponse.json(
      { error: `Invalid events: ${invalidEvents.join(", ")}` },
      { status: 400 }
    );
  }

  // Check if API key exists
  const apiKey = await prisma.apiKey.findUnique({ where: { id: apiKeyId } });
  if (!apiKey) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  const secret = generateSecret();

  const webhook = await prisma.webhook.create({
    data: {
      apiKeyId,
      url,
      events,
      secret,
    },
    include: {
      apiKey: {
        select: { name: true },
      },
    },
  });

  console.log(JSON.stringify({
    audit: true,
    action: "webhook.created",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    resourceId: webhook.id,
    url: webhook.url,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ webhook }, { status: 201 });
}

// PATCH /api/admin/webhooks — Update webhook (toggle active)
export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, isActive } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const updated = await prisma.webhook.update({
    where: { id },
    data: {
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    },
    select: {
      id: true,
      apiKeyId: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      apiKey: { select: { name: true } },
    },
  });

  console.log(JSON.stringify({
    audit: true,
    action: "webhook.toggled",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    resourceId: updated.id,
    isActive: updated.isActive,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ webhook: updated });
}

// DELETE /api/admin/webhooks — Delete webhook
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.webhook.delete({ where: { id } });

  console.log(JSON.stringify({
    audit: true,
    action: "webhook.deleted",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    resourceId: id,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ success: true });
}
