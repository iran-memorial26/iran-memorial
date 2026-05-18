import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhooks } from "@/lib/webhooks";
import { notify } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site-url";
import { isAdmin } from "@/lib/admin-auth";

function safeParsDate(val: unknown): Date | null {
  if (!val || typeof val !== "string") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get submission
    const submission = await prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved submissions can be converted" },
        { status: 400 }
      );
    }

    const data = submission.victimData as any;

    // Generate slug
    const baseSlug = slugify(data.name_latin);
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await prisma.victim.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create victim
    const victim = await prisma.victim.create({
      data: {
        slug,
        nameLatin: data.name_latin,
        nameFarsi: data.name_farsi || null,
        dateOfDeath: safeParsDate(data.date_of_death),
        placeOfDeath: data.place_of_death || null,
        province: data.province || null,
        causeOfDeath: data.cause_of_death || null,
        circumstancesEn: data.details || null,
        verificationStatus: "unverified",
        dataSource: "community_submission",
      },
    });

    // Create source linking to submission
    if (data.sources) {
      await prisma.source.create({
        data: {
          victimId: victim.id,
          name: `Community Submission by ${submission.submitterName || "Anonymous"}`,
          url: null,
          sourceType: "community",
        },
      });
    }

    // Mark submission as converted
    await prisma.submission.update({
      where: { id },
      data: {
        status: "converted",
        reviewerNotes: `Converted to victim: ${victim.slug}`,
      },
    });

    // Trigger database-driven webhooks (fire and forget)
    triggerWebhooks("victim.created", {
      victimId: victim.id,
      slug: victim.slug,
      nameLatin: victim.nameLatin,
      nameFarsi: victim.nameFarsi,
      source: "community_submission",
    }).catch((err) => console.error("[Convert] Webhook trigger failed:", err));

    // Trigger environment-based notification (fire and forget)
    notify({
      type: "conversion",
      title: "Submission Converted to Victim",
      details: `${victim.nameLatin}${victim.nameFarsi ? ` (${victim.nameFarsi})` : ""}\nSlug: ${victim.slug}`,
      url: `${SITE_URL}/en/victims/${victim.slug}`,
    });

    return NextResponse.json({ victim, success: true }, { status: 201 });
  } catch (err) {
    console.error("Failed to convert submission:", err);
    return NextResponse.json(
      { error: "Failed to convert submission" },
      { status: 500 }
    );
  }
}
