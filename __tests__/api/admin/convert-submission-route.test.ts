import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    submission: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    victim: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    source: {
      create: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/admin/submissions/[id]/convert/route";
import { prisma } from "@/lib/db";

const mockSubmissionFindUnique = vi.mocked(prisma.submission.findUnique);
const mockSubmissionUpdate = vi.mocked(prisma.submission.update);
const mockVictimFindUnique = vi.mocked(prisma.victim.findUnique);
const mockVictimCreate = vi.mocked(prisma.victim.create);
const mockSourceCreate = vi.mocked(prisma.source.create);

function createPostRequest(headers?: Record<string, string>) {
  return new NextRequest(
    new URL("/api/admin/submissions/sub-1/convert", "http://localhost:3000"),
    {
      method: "POST",
      headers: new Headers(headers || {}),
    }
  );
}

function createParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const mockSubmission = {
  id: "sub-1",
  status: "approved",
  victimData: {
    name_latin: "John Doe",
    name_farsi: "\u062C\u0627\u0646 \u062F\u0648",
    date_of_death: "2022-09-16",
    place_of_death: "Tehran",
    province: "Tehran",
    cause_of_death: "Police brutality",
    details: "Killed during protests near Azadi Square.",
    sources: "https://example.com/source1",
  },
  submitterName: "Reporter Name",
  submitterEmail: "reporter@example.com",
};

const mockCreatedVictim = {
  id: "victim-new",
  slug: "john-doe",
  nameLatin: "John Doe",
  nameFarsi: "\u062C\u0627\u0646 \u062F\u0648",
  dateOfDeath: new Date("2022-09-16"),
  placeOfDeath: "Tehran",
  province: "Tehran",
  causeOfDeath: "Police brutality",
  circumstancesEn: "Killed during protests near Azadi Square.",
  verificationStatus: "unverified",
  dataSource: "community_submission",
};

describe("POST /api/admin/submissions/[id]/convert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: slug is unique (no existing victim with same slug)
    mockVictimFindUnique.mockResolvedValue(null);
    mockSubmissionFindUnique.mockResolvedValue(mockSubmission as any);
    mockVictimCreate.mockResolvedValue(mockCreatedVictim as any);
    mockSubmissionUpdate.mockResolvedValue({} as any);
    mockSourceCreate.mockResolvedValue({} as any);
  });

  describe("Authentication", () => {
    it("returns 401 when x-forwarded-user header is missing", async () => {
      const res = await POST(createPostRequest(), createParams("sub-1"));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 401 when user is not in ADMIN_USERS list", async () => {
      const res = await POST(
        createPostRequest({ "x-forwarded-user": "not-an-admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("allows request when user is 'admin' (default ADMIN_USERS)", async () => {
      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(201);
    });
  });

  describe("Submission Lookup", () => {
    it("returns 404 when submission does not exist", async () => {
      mockSubmissionFindUnique.mockResolvedValue(null);

      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("nonexistent")
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Submission not found");
    });

    it("queries submission with correct ID", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockSubmissionFindUnique).toHaveBeenCalledWith({
        where: { id: "sub-1" },
      });
    });
  });

  describe("Status Validation", () => {
    it("returns 400 when submission status is pending", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...mockSubmission,
        status: "pending",
      } as any);

      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Only approved submissions can be converted");
    });

    it("returns 400 when submission status is rejected", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...mockSubmission,
        status: "rejected",
      } as any);

      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Only approved submissions can be converted");
    });

    it("returns 400 when submission status is converted", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...mockSubmission,
        status: "converted",
      } as any);

      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Only approved submissions can be converted");
    });

    it("proceeds when submission status is approved", async () => {
      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(201);
    });
  });

  describe("Slug Generation", () => {
    it("generates slug from name_latin", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: "john-doe",
        }),
      });
    });

    it("generates unique slug when base slug already exists", async () => {
      // First call: checking "john-doe" -> exists
      // Second call: checking "john-doe-1" -> not exists
      mockVictimFindUnique
        .mockResolvedValueOnce({ id: "existing" } as any)
        .mockResolvedValueOnce(null);

      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: "john-doe-1",
        }),
      });
    });

    it("increments counter until unique slug is found", async () => {
      // "john-doe" exists, "john-doe-1" exists, "john-doe-2" does not exist
      mockVictimFindUnique
        .mockResolvedValueOnce({ id: "existing-1" } as any)
        .mockResolvedValueOnce({ id: "existing-2" } as any)
        .mockResolvedValueOnce(null);

      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: "john-doe-2",
        }),
      });
    });

    it("handles special characters in name for slug", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...mockSubmission,
        victimData: {
          ...mockSubmission.victimData,
          name_latin: "Ali Reza-Zadeh (Jr.)",
        },
      } as any);

      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      // slugify: lowercase, remove non-word chars (except spaces and hyphens),
      // replace spaces with hyphens, collapse multiple hyphens
      const createdSlug = (mockVictimCreate.mock.calls[0][0] as any).data.slug;
      expect(createdSlug).not.toContain("(");
      expect(createdSlug).not.toContain(")");
      expect(createdSlug).not.toContain(".");
      expect(createdSlug).toBe("ali-reza-zadeh-jr");
    });
  });

  describe("Victim Creation", () => {
    it("creates victim with all mapped fields", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: {
          slug: "john-doe",
          nameLatin: "John Doe",
          nameFarsi: "\u062C\u0627\u0646 \u062F\u0648",
          dateOfDeath: expect.any(Date),
          placeOfDeath: "Tehran",
          province: "Tehran",
          causeOfDeath: "Police brutality",
          circumstancesEn: "Killed during protests near Azadi Square.",
          verificationStatus: "unverified",
          dataSource: "community_submission",
        },
      });
    });

    it("sets verificationStatus to 'unverified'", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verificationStatus: "unverified",
        }),
      });
    });

    it("sets dataSource to 'community_submission'", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dataSource: "community_submission",
        }),
      });
    });

    it("handles missing optional fields as null", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...mockSubmission,
        victimData: {
          name_latin: "Minimal Victim",
          details: "Some details",
        },
      } as any);

      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nameFarsi: null,
          dateOfDeath: null,
          placeOfDeath: null,
          province: null,
          causeOfDeath: null,
        }),
      });
    });

    it("uses details field as circumstancesEn", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockVictimCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          circumstancesEn: "Killed during protests near Azadi Square.",
        }),
      });
    });
  });

  describe("Source Creation", () => {
    it("creates source record when victimData has sources", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockSourceCreate).toHaveBeenCalledWith({
        data: {
          victimId: "victim-new",
          name: "Community Submission by Reporter Name",
          url: null,
          sourceType: "community",
        },
      });
    });

    it("uses 'Anonymous' when submitterName is null", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...mockSubmission,
        submitterName: null,
      } as any);

      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockSourceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Community Submission by Anonymous",
        }),
      });
    });

    it("does not create source when victimData has no sources field", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...mockSubmission,
        victimData: {
          name_latin: "John Doe",
          details: "Some details",
          // no sources field
        },
      } as any);

      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockSourceCreate).not.toHaveBeenCalled();
    });
  });

  describe("Submission Status Update", () => {
    it("updates submission status to 'converted'", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(mockSubmissionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: {
          status: "converted",
          reviewerNotes: "Converted to victim: john-doe",
        },
      });
    });

    it("includes victim slug in reviewerNotes", async () => {
      await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      const updateCall = mockSubmissionUpdate.mock.calls[0][0] as any;
      expect(updateCall.data.reviewerNotes).toContain("john-doe");
    });
  });

  describe("Successful Response", () => {
    it("returns 201 with victim object and success flag", async () => {
      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.victim).toBeDefined();
      expect(json.victim.id).toBe("victim-new");
      expect(json.victim.slug).toBe("john-doe");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 when victim creation fails", async () => {
      mockVictimCreate.mockRejectedValue(new Error("Database error"));

      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Failed to convert submission");
    });

    it("returns 500 when submission update fails", async () => {
      mockSubmissionUpdate.mockRejectedValue(new Error("Update failed"));

      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Failed to convert submission");
    });

    it("returns 500 when source creation fails", async () => {
      mockSourceCreate.mockRejectedValue(new Error("Source error"));

      const res = await POST(
        createPostRequest({ "x-forwarded-user": "admin" }),
        createParams("sub-1")
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Failed to convert submission");
    });
  });
});
