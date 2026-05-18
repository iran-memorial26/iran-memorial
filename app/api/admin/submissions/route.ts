import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerWebhooks } from "@/lib/webhooks";
import { isAdmin } from "@/lib/admin-auth";

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "pending"]),
  reviewerNotes: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "pending";

  const submissions = await prisma.submission.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ submissions });
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = PatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id, status, reviewerNotes } = parsed.data;
  const user = request.headers.get("x-forwarded-user") || "admin";

  try {
    const updated = await prisma.submission.update({
      where: { id },
      data: {
        status,
        reviewerNotes: reviewerNotes || null,
        reviewedBy: user,
        reviewedAt: new Date(),
      },
    });

    // Trigger webhook if approved
    if (status === "approved") {
      const victimData = updated.victimData as any;
      triggerWebhooks("submission.approved", {
        submissionId: updated.id,
        submitterName: updated.submitterName,
        submitterEmail: updated.submitterEmail,
        victimName: victimData?.name_latin || "Unknown",
        reviewedBy: user,
      }).catch((err) => console.error("[Submissions] Webhook trigger failed:", err));
    }

    return NextResponse.json({ submission: updated });
  } catch {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
}
