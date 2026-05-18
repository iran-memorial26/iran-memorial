import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { z } from "zod";

// Handle regex: alphanumerics, dot, underscore, dash — most platforms allow this set.
// Matches Instagram/X/GitHub/Telegram rules; the upper bound 30 covers all four.
const HANDLE_RE = /^[A-Za-z0-9._-]{1,30}$/;

const SubmissionSchema = z.object({
  name_latin: z.string().min(1).max(200),
  name_farsi: z.string().max(200).optional(),
  date_of_birth: z.string().max(50).optional(),
  date_of_death: z.string().max(50).optional(),
  place_of_death: z.string().max(200).optional(),
  province: z.string().max(100).optional(),
  cause_of_death: z.string().max(200).optional(),
  details: z.string().min(10).max(5000),
  sources: z.string().max(2000).optional(),
  submitter_email: z.string().email().max(254).optional().nullable(),
  submitter_name: z.string().max(200).optional().nullable(),
  // Server-issued URLs from /api/submit/upload. Must be under /uploads/
  // so a malicious client can't smuggle external URLs into the submission.
  media_urls: z.array(z.string().regex(/^\/uploads\/pending\/[a-f0-9]{2}\/[a-f0-9-]+\.[a-z0-9]+$/)).max(5).optional(),

  // Personal (already in schema, newly exposed to the form)
  occupation_en: z.string().max(500).optional(),
  occupation_fa: z.string().max(500).optional(),
  age_at_death: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  ethnicity: z.string().max(200).optional(),
  religion: z.string().max(200).optional(),
  place_of_birth: z.string().max(200).optional(),
  aliases: z.array(z.string().min(1).max(200)).max(20).optional(),
  quotes: z.array(z.string().min(1).max(1000)).max(20).optional(),

  // Education (new migration 20260512210000)
  field_of_study: z.string().max(200).optional(),
  university_name: z.string().max(200).optional(),
  university_city: z.string().max(200).optional(),
  degree_level: z.enum(["undergraduate", "bachelor", "master", "phd"]).optional(),
  graduation_year: z.coerce.number().int().min(1900).max(2100).optional(),

  // Online presence (new migration 20260512210000)
  instagram_handle: z.string().regex(HANDLE_RE).optional(),
  x_handle: z.string().regex(HANDLE_RE).optional(),
  linkedin_url: z.string().url().max(500).optional(),
  github_handle: z.string().regex(HANDLE_RE).optional(),
  telegram_handle: z.string().regex(HANDLE_RE).optional(),
  facebook_url: z.string().url().max(500).optional(),
  youtube_channel_url: z.string().url().max(500).optional(),
  website_url: z.string().url().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 submissions per hour per IP
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
    const { success, remaining, resetAt } = await rateLimit(ip, "submit", 5, 3600);

    if (!success) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Validate input
    const body = await request.json();
    const result = SubmissionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid submission data" },
        { status: 400 }
      );
    }

    const validated = result.data;

    const submission = await prisma.submission.create({
      data: {
        victimData: validated,
        submitterEmail: validated.submitter_email || null,
        submitterName: validated.submitter_name || null,
      },
    });

    // Notify via webhook (fire and forget)
    notify({
      type: "submission",
      title: "New Victim Submission",
      details: `Name: ${validated.name_latin}${validated.submitter_name ? `\nSubmitted by: ${validated.submitter_name}` : ""}`,
    });

    return NextResponse.json(
      { id: submission.id, status: "pending" },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500 }
    );
  }
}
