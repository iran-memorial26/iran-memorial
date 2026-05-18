import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";

const PatchSchema = z.object({
  slug: z.string().min(1),
  nameLatin: z.string().min(1).max(200).optional(),
  nameFarsi: z.string().max(200).nullable().optional(),
  causeOfDeath: z.string().max(500).nullable().optional(),
  placeOfDeath: z.string().max(500).nullable().optional(),
  ageAtDeath: z.number().int().min(0).max(150).nullable().optional(),
  dateOfDeath: z.string().nullable().optional(), // ISO date string
  dateOfBirth: z.string().nullable().optional(),
  verificationStatus: z.enum(["verified", "unverified", "disputed"]).optional(),
  circumstancesEn: z.string().max(10000).nullable().optional(),
  circumstancesFa: z.string().max(10000).nullable().optional(),
  dataSource: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// GET /api/admin/victims?slug=... — fetch single victim for editing
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const victim = await prisma.victim.findUnique({
    where: { slug },
    select: {
      slug: true,
      nameLatin: true,
      nameFarsi: true,
      causeOfDeath: true,
      placeOfDeath: true,
      ageAtDeath: true,
      dateOfDeath: true,
      dateOfBirth: true,
      verificationStatus: true,
      circumstancesEn: true,
      circumstancesFa: true,
      dataSource: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!victim) {
    return NextResponse.json({ error: "Victim not found" }, { status: 404 });
  }

  return NextResponse.json({ victim });
}

// PATCH /api/admin/victims — update a victim's fields
export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const { slug, ...fields } = parsed.data;

  // Build update data — only include defined fields
  const updateData: Record<string, unknown> = {};
  if (fields.nameLatin !== undefined) updateData.nameLatin = fields.nameLatin;
  if (fields.nameFarsi !== undefined) updateData.nameFarsi = fields.nameFarsi;
  if (fields.causeOfDeath !== undefined) updateData.causeOfDeath = fields.causeOfDeath;
  if (fields.placeOfDeath !== undefined) updateData.placeOfDeath = fields.placeOfDeath;
  if (fields.ageAtDeath !== undefined) updateData.ageAtDeath = fields.ageAtDeath;
  if (fields.dateOfDeath !== undefined) {
    updateData.dateOfDeath = fields.dateOfDeath ? new Date(fields.dateOfDeath) : null;
  }
  if (fields.dateOfBirth !== undefined) {
    updateData.dateOfBirth = fields.dateOfBirth ? new Date(fields.dateOfBirth) : null;
  }
  if (fields.verificationStatus !== undefined) updateData.verificationStatus = fields.verificationStatus;
  if (fields.circumstancesEn !== undefined) updateData.circumstancesEn = fields.circumstancesEn;
  if (fields.circumstancesFa !== undefined) updateData.circumstancesFa = fields.circumstancesFa;
  if (fields.dataSource !== undefined) updateData.dataSource = fields.dataSource;
  if (fields.notes !== undefined) updateData.notes = fields.notes;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.victim.update({
      where: { slug },
      data: updateData,
      select: {
        slug: true,
        nameLatin: true,
        nameFarsi: true,
        causeOfDeath: true,
        placeOfDeath: true,
        ageAtDeath: true,
        dateOfDeath: true,
        dateOfBirth: true,
        verificationStatus: true,
        circumstancesEn: true,
        circumstancesFa: true,
        dataSource: true,
        notes: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ victim: updated });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Victim not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  nameLatin: z.string().min(1).max(200),
  nameFarsi: z.string().max(200).nullable().optional(),
  gender: z.enum(["male", "female", "unknown"]).optional(),
  dateOfBirth: z.string().nullable().optional(),
  dateOfDeath: z.string().nullable().optional(),
  ageAtDeath: z.number().int().min(0).max(150).nullable().optional(),
  placeOfDeath: z.string().max(500).nullable().optional(),
  causeOfDeath: z.string().max(500).nullable().optional(),
  verificationStatus: z.enum(["verified", "unverified", "disputed"]).optional(),
  circumstancesEn: z.string().max(10000).nullable().optional(),
  circumstancesFa: z.string().max(10000).nullable().optional(),
  dataSource: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// POST /api/admin/victims — create a new victim
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const { nameLatin, nameFarsi, gender, dateOfBirth, dateOfDeath, ageAtDeath,
          placeOfDeath, causeOfDeath, verificationStatus, circumstancesEn, circumstancesFa,
          dataSource, notes } = parsed.data;

  // Generate slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  const year = dateOfDeath ? new Date(dateOfDeath).getFullYear() : new Date().getFullYear();
  let baseSlug = `${generateSlug(nameLatin)}-${year}`;

  // Check for slug collision and add suffix if needed
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const existing = await prisma.victim.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
    if (attempt > 20) {
      return NextResponse.json({ error: "Slug collision limit exceeded" }, { status: 409 });
    }
  }

  try {
    const victim = await prisma.victim.create({
      data: {
        slug,
        nameLatin,
        nameFarsi: nameFarsi ?? null,
        gender: gender ?? "unknown",
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : null,
        ageAtDeath: ageAtDeath ?? null,
        placeOfDeath: placeOfDeath ?? null,
        causeOfDeath: causeOfDeath ?? null,
        verificationStatus: verificationStatus ?? "unverified",
        circumstancesEn: circumstancesEn ?? null,
        circumstancesFa: circumstancesFa ?? null,
        dataSource: dataSource ?? null,
        notes: notes ?? null,
      },
      select: { slug: true, nameLatin: true, id: true },
    });
    return NextResponse.json({ victim }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Creation failed" }, { status: 500 });
  }
}
