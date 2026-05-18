import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    submission: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { POST } from "@/app/api/submit/route";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const mockCreate = vi.mocked(prisma.submission.create);
const mockRateLimit = vi.mocked(rateLimit);

function createPostRequest(body: any, headers?: Record<string, string>) {
  return new NextRequest(new URL("/api/submit", "http://localhost:3000"), {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      resetAt: Date.now() + 3600000,
    });
    mockCreate.mockResolvedValue({
      id: "new-submission-id",
      status: "pending",
    } as any);
  });

  it("creates submission with valid minimal data", async () => {
    const res = await POST(
      createPostRequest({
        name_latin: "Test Victim",
        details:
          "This has enough detail to pass the 10 character minimum validation.",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("new-submission-id");
    expect(json.status).toBe("pending");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(createPostRequest({ name_latin: "Name" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid submission data");
    expect(json.details).toBeUndefined();
  });

  it("returns 400 for details too short", async () => {
    const res = await POST(
      createPostRequest({ name_latin: "Name", details: "short" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      createPostRequest({
        name_latin: "Name",
        details: "Valid details more than ten chars long.",
        submitter_email: "invalid-email",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 1800000,
    });
    const res = await POST(
      createPostRequest({
        name_latin: "Name",
        details: "Valid details more than ten chars long.",
      })
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many submissions");
  });

  it("includes X-RateLimit-Remaining header on success", async () => {
    const res = await POST(
      createPostRequest({
        name_latin: "Name",
        details: "Valid details more than ten chars long.",
      })
    );
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  it("returns 500 on database error", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection failed"));
    const res = await POST(
      createPostRequest({
        name_latin: "Name",
        details: "Valid details more than ten chars long.",
      })
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to submit");
  });

  it("passes submitterEmail as null when not provided", async () => {
    await POST(
      createPostRequest({
        name_latin: "Name",
        details: "Valid details more than ten chars long.",
      })
    );
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submitterEmail: null,
        submitterName: null,
      }),
    });
  });

  it("calls rate limit with correct parameters", async () => {
    await POST(
      createPostRequest(
        {
          name_latin: "Name",
          details: "Valid details more than ten chars long.",
        },
        { "x-forwarded-for": "1.2.3.4" }
      )
    );
    expect(mockRateLimit).toHaveBeenCalledWith("1.2.3.4", "submit", 5, 3600);
  });

  it("stores validated victim data in submission", async () => {
    await POST(
      createPostRequest({
        name_latin: "Full Name",
        name_farsi: "نام کامل",
        details: "Detailed circumstances of the death.",
        submitter_email: "user@example.com",
      })
    );
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        victimData: expect.objectContaining({
          name_latin: "Full Name",
          name_farsi: "نام کامل",
        }),
        submitterEmail: "user@example.com",
        submitterName: null,
      },
    });
  });
});
