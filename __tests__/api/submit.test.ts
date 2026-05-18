import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreate, mockRateLimit } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    submission: {
      create: mockCreate,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

import { POST } from "@/app/api/submit/route";

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

const validSubmission = {
  name_latin: "Test Victim",
  details:
    "This is a test submission with enough detail to pass the 10 character minimum validation.",
};

const fullSubmission = {
  name_latin: "Mahsa Amini",
  name_farsi: "مهسا امینی",
  date_of_birth: "2000-09-21",
  date_of_death: "2022-09-16",
  place_of_death: "Tehran",
  province: "Tehran",
  cause_of_death: "Head injuries",
  details:
    "Detailed circumstances of the victim's death during protests in Tehran.",
  sources: "https://example.com/source",
  submitter_email: "test@example.com",
  submitter_name: "Test Submitter",
};

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

  describe("Rate Limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 1800000,
      });
      const res = await POST(createPostRequest(validSubmission));
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error).toContain("Too many submissions");
    });

    it("includes Retry-After header on 429", async () => {
      const resetAt = Date.now() + 1800000;
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt,
      });
      const res = await POST(createPostRequest(validSubmission));
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });

    it("includes X-RateLimit-Remaining: 0 on 429", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 3600000,
      });
      const res = await POST(createPostRequest(validSubmission));
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("extracts IP from x-forwarded-for header", async () => {
      await POST(
        createPostRequest(validSubmission, {
          "x-forwarded-for": "1.2.3.4",
        })
      );
      expect(mockRateLimit).toHaveBeenCalledWith(
        "1.2.3.4",
        "submit",
        5,
        3600
      );
    });

    it("uses 'unknown' when no IP header present", async () => {
      await POST(createPostRequest(validSubmission));
      expect(mockRateLimit).toHaveBeenCalledWith(
        "unknown",
        "submit",
        5,
        3600
      );
    });

    it("does not create submission when rate limited", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 3600000,
      });
      await POST(createPostRequest(validSubmission));
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("Input Validation", () => {
    it("returns 400 for missing required fields", async () => {
      const res = await POST(createPostRequest({ name_latin: "Name" }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid submission data");
      expect(json.details).toBeUndefined();
    });

    it("returns 400 for empty name_latin", async () => {
      const res = await POST(
        createPostRequest({ name_latin: "", details: "Valid details here with more than ten characters." })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing name_latin", async () => {
      const res = await POST(
        createPostRequest({ details: "Valid details here with more than ten characters." })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for details too short (< 10 chars)", async () => {
      const res = await POST(
        createPostRequest({ name_latin: "Name", details: "short" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
      const res = await POST(
        createPostRequest({
          ...validSubmission,
          submitter_email: "invalid-email",
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for name_latin exceeding 200 characters", async () => {
      const res = await POST(
        createPostRequest({
          name_latin: "x".repeat(201),
          details: "Valid details here with more than ten characters.",
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for details exceeding 5000 characters", async () => {
      const res = await POST(
        createPostRequest({
          name_latin: "Name",
          details: "x".repeat(5001),
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for sources exceeding 2000 characters", async () => {
      const res = await POST(
        createPostRequest({
          ...validSubmission,
          sources: "x".repeat(2001),
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns no field details on validation failure (schema hardening)", async () => {
      const res = await POST(
        createPostRequest({ name_latin: "", details: "short" })
      );
      const json = await res.json();
      expect(json.error).toBe("Invalid submission data");
      expect(json.details).toBeUndefined();
    });

    it("accepts details with exactly 10 characters", async () => {
      const res = await POST(
        createPostRequest({ name_latin: "Name", details: "1234567890" })
      );
      expect(res.status).toBe(200);
    });

    it("accepts null submitter_email", async () => {
      const res = await POST(
        createPostRequest({
          ...validSubmission,
          submitter_email: null,
        })
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Successful Submission", () => {
    it("creates submission with valid minimal data", async () => {
      const res = await POST(createPostRequest(validSubmission));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe("new-submission-id");
      expect(json.status).toBe("pending");
    });

    it("includes X-RateLimit-Remaining header on success", async () => {
      const res = await POST(createPostRequest(validSubmission));
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    });

    it("stores validated victim data in submission", async () => {
      await POST(createPostRequest(fullSubmission));
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          victimData: expect.objectContaining({
            name_latin: "Mahsa Amini",
            name_farsi: "مهسا امینی",
            details: fullSubmission.details,
          }),
          submitterEmail: "test@example.com",
          submitterName: "Test Submitter",
        },
      });
    });

    it("passes submitterEmail as null when not provided", async () => {
      await POST(createPostRequest(validSubmission));
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          submitterEmail: null,
          submitterName: null,
        }),
      });
    });

    it("stores optional fields when provided", async () => {
      await POST(createPostRequest(fullSubmission));
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          victimData: expect.objectContaining({
            date_of_birth: "2000-09-21",
            date_of_death: "2022-09-16",
            place_of_death: "Tehran",
            province: "Tehran",
            cause_of_death: "Head injuries",
            sources: "https://example.com/source",
          }),
          submitterEmail: "test@example.com",
          submitterName: "Test Submitter",
        },
      });
    });

    it("accepts submission with only required fields", async () => {
      const res = await POST(
        createPostRequest({
          name_latin: "Only Required",
          details: "Minimum details for a valid submission here.",
        })
      );
      expect(res.status).toBe(200);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("accepts Farsi name", async () => {
      const res = await POST(
        createPostRequest({
          name_latin: "Name",
          name_farsi: "نام فارسی",
          details: "Valid details more than ten chars.",
        })
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      mockCreate.mockRejectedValue(new Error("DB connection failed"));
      const res = await POST(createPostRequest(validSubmission));
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Failed to submit");
    });

    it("returns 500 on unexpected database error", async () => {
      mockCreate.mockRejectedValue(new Error("Unique constraint violation"));
      const res = await POST(createPostRequest(validSubmission));
      expect(res.status).toBe(500);
    });
  });
});
