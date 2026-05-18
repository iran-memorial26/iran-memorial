import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    victim: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { GET, POST } from "@/app/api/comments/route";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const mockFindMany = vi.mocked(prisma.comment.findMany);
const mockCreate = vi.mocked(prisma.comment.create);
const mockVictimFindUnique = vi.mocked(prisma.victim.findUnique);
const mockRateLimit = vi.mocked(rateLimit);

function createGetRequest(searchParams: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/comments");
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

function createPostRequest(body: any, headers?: Record<string, string>) {
  return new NextRequest(new URL("/api/comments", "http://localhost:3000"), {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

const mockComments = [
  {
    id: "comment-1",
    authorName: "John Doe",
    content: "Rest in peace",
    createdAt: new Date("2024-01-15T10:00:00Z"),
  },
  {
    id: "comment-2",
    authorName: null,
    content: "We will never forget",
    createdAt: new Date("2024-01-14T08:30:00Z"),
  },
];

describe("GET /api/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue(mockComments as any);
  });

  it("returns 400 when victimId is missing", async () => {
    const res = await GET(createGetRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("victimId required");
  });

  it("returns approved comments for a given victimId", async () => {
    const res = await GET(createGetRequest({ victimId: "victim-123" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.comments).toHaveLength(2);
    expect(json.comments[0].id).toBe("comment-1");
    expect(json.comments[0].authorName).toBe("John Doe");
    expect(json.comments[0].content).toBe("Rest in peace");
  });

  it("queries only approved comments", async () => {
    await GET(createGetRequest({ victimId: "victim-123" }));
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { victimId: "victim-123", status: "approved" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        authorName: true,
        content: true,
        createdAt: true,
      },
    });
  });

  it("returns empty array when no comments exist", async () => {
    mockFindMany.mockResolvedValue([]);
    const res = await GET(createGetRequest({ victimId: "victim-456" }));
    const json = await res.json();
    expect(json.comments).toEqual([]);
  });
});

describe("POST /api/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      resetAt: Date.now() + 3600000,
    });
    mockVictimFindUnique.mockResolvedValue({ id: "victim-123" } as any);
    mockCreate.mockResolvedValue({
      id: "new-comment-id",
      createdAt: new Date("2024-01-16T12:00:00Z"),
    } as any);
  });

  describe("Rate Limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 3600000,
      });

      const res = await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "A comment",
        })
      );
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error).toContain("Too many comments");
    });

    it("includes X-RateLimit-Remaining header on 429", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 3600000,
      });

      const res = await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "A comment",
        })
      );
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("extracts IP from x-forwarded-for header", async () => {
      await POST(
        createPostRequest(
          { victimId: "victim-123", content: "A comment" },
          { "x-forwarded-for": "10.0.0.1" }
        )
      );
      expect(mockRateLimit).toHaveBeenCalledWith(
        "10.0.0.1",
        "comment",
        10,
        3600
      );
    });

    it("uses 'unknown' when no IP header present", async () => {
      await POST(
        createPostRequest({ victimId: "victim-123", content: "A comment" })
      );
      expect(mockRateLimit).toHaveBeenCalledWith(
        "unknown",
        "comment",
        10,
        3600
      );
    });
  });

  describe("Input Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const req = new NextRequest(
        new URL("/api/comments", "http://localhost:3000"),
        {
          method: "POST",
          headers: new Headers({ "Content-Type": "application/json" }),
          body: "not valid json",
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid JSON");
    });

    it("returns 400 when victimId is missing", async () => {
      const res = await POST(
        createPostRequest({ content: "A comment" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("victimId required");
    });

    it("returns 400 when victimId is not a string", async () => {
      const res = await POST(
        createPostRequest({ victimId: 123, content: "A comment" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("victimId required");
    });

    it("returns 400 when content is missing", async () => {
      const res = await POST(
        createPostRequest({ victimId: "victim-123" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Content must be at least 3 characters");
    });

    it("returns 400 when content is too short", async () => {
      const res = await POST(
        createPostRequest({ victimId: "victim-123", content: "ab" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Content must be at least 3 characters");
    });

    it("returns 400 when content is not a string", async () => {
      const res = await POST(
        createPostRequest({ victimId: "victim-123", content: 12345 })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Content must be at least 3 characters");
    });

    it("returns 400 when content exceeds 2000 characters", async () => {
      const res = await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "a".repeat(2001),
        })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Content too long");
    });

    it("accepts content at exactly 2000 characters", async () => {
      const res = await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "a".repeat(2000),
        })
      );
      // Should pass validation (victim exists mock is set)
      expect(res.status).toBe(201);
    });
  });

  describe("Victim Existence Check", () => {
    it("returns 404 when victim does not exist", async () => {
      mockVictimFindUnique.mockResolvedValue(null);

      const res = await POST(
        createPostRequest({
          victimId: "nonexistent",
          content: "A comment",
        })
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Victim not found");
    });

    it("queries victim with correct ID", async () => {
      await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "A comment",
        })
      );
      expect(mockVictimFindUnique).toHaveBeenCalledWith({
        where: { id: "victim-123" },
        select: { id: true },
      });
    });
  });

  describe("Successful Comment Creation", () => {
    it("returns 201 with comment id and pending status", async () => {
      const res = await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "Rest in peace",
        })
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBe("new-comment-id");
      expect(json.status).toBe("pending");
    });

    it("creates comment with status pending", async () => {
      await POST(
        createPostRequest({
          victimId: "victim-123",
          authorName: "John Doe",
          content: "Rest in peace",
        })
      );
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          victimId: "victim-123",
          authorName: "John Doe",
          content: "Rest in peace",
          status: "pending",
        },
        select: { id: true, createdAt: true },
      });
    });

    it("sets authorName to null when not provided", async () => {
      await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "Anonymous comment",
        })
      );
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          authorName: null,
        }),
        select: { id: true, createdAt: true },
      });
    });

    it("trims content before storing", async () => {
      await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "  Trimmed content  ",
        })
      );
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: "Trimmed content",
        }),
        select: { id: true, createdAt: true },
      });
    });

    it("truncates authorName to 100 characters", async () => {
      const longName = "A".repeat(150);
      await POST(
        createPostRequest({
          victimId: "victim-123",
          authorName: longName,
          content: "A comment",
        })
      );
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          authorName: "A".repeat(100),
        }),
        select: { id: true, createdAt: true },
      });
    });

    it("truncates content to 2000 characters", async () => {
      // Note: The route truncates content at 2000 chars with .slice(0, 2000)
      // But it also rejects content > 2000 chars before reaching create.
      // The .slice(0, 2000) is a safety net for edge cases.
      // With exactly 2000 chars, slice keeps them all.
      await POST(
        createPostRequest({
          victimId: "victim-123",
          content: "B".repeat(2000),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: "B".repeat(2000),
        }),
        select: { id: true, createdAt: true },
      });
    });
  });
});
