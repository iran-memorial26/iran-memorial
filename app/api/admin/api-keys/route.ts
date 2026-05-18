import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHash, randomBytes } from "crypto";
import { isAdmin } from "@/lib/admin-auth";

function generateApiKey(): string {
  return `iran_mem_${randomBytes(24).toString("base64url")}`;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      email: true,
      description: true,
      rateLimit: true,
      isActive: true,
      createdBy: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      _count: { select: { usageLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Return masked key — full key was only shown once at creation
  const maskedKeys = keys.map(({ key, ...rest }) => ({
    ...rest,
    key_preview: `${key.slice(0, 14)}...${key.slice(-4)}`,
  }));

  console.log(JSON.stringify({
    audit: true,
    action: "apikey.listed",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    count: keys.length,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ keys: maskedKeys });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, email, description, rateLimit, expiresAt } = body;

  if (!name || typeof name !== "string" || name.length < 3) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  if (expiresAt !== undefined && expiresAt !== null) {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt date" }, { status: 400 });
    }
  }

  const user = request.headers.get("x-forwarded-user") || "admin";
  const key = generateApiKey();
  const keyHash = createHash("sha256").update(key).digest("hex");

  const apiKey = await prisma.apiKey.create({
    data: {
      key,
      keyHash,
      name: name.slice(0, 200),
      email: email?.slice(0, 254),
      description: description?.slice(0, 1000),
      rateLimit: rateLimit && Number.isInteger(rateLimit) ? rateLimit : 1000,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: user,
    },
  });

  console.log(JSON.stringify({
    audit: true,
    action: "apikey.created",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    resourceId: apiKey.id,
    name: apiKey.name,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ apiKey }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, isActive, rateLimit } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: {
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      rateLimit: rateLimit !== undefined && Number.isInteger(rateLimit) ? rateLimit : undefined,
    },
  });

  console.log(JSON.stringify({
    audit: true,
    action: "apikey.toggled",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    resourceId: updated.id,
    isActive: updated.isActive,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ apiKey: updated });
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  await prisma.apiKey.delete({ where: { id } });

  console.log(JSON.stringify({
    audit: true,
    action: "apikey.deleted",
    actor: request.headers.get("x-forwarded-user") || "unknown",
    resourceId: id,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
  }));

  return NextResponse.json({ success: true });
}
