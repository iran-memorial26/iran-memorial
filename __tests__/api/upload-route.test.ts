import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRateLimit } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    victim: {
      findUnique: vi.fn(),
    },
    photo: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const { mockWriteFileFn, mockMkdirFn } = vi.hoisted(() => ({
  mockWriteFileFn: vi.fn().mockResolvedValue(undefined),
  mockMkdirFn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("fs/promises", () => {
  const mocked = {
    writeFile: mockWriteFileFn,
    mkdir: mockMkdirFn,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

import { POST } from "@/app/api/upload/route";
import { prisma } from "@/lib/db";

const mockVictimFindUnique = vi.mocked(prisma.victim.findUnique);
const mockPhotoCount = vi.mocked(prisma.photo.count);
const mockPhotoCreate = vi.mocked(prisma.photo.create);
const mockWriteFile = mockWriteFileFn;
const mockMkdir = mockMkdirFn;

// Magic-byte prefixes matching the signatures in the route
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // WebP: "RIFF????WEBP" — bytes 0-3 = RIFF, 8-11 = WEBP
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
};

/**
 * Create a mock File object with real magic bytes so magic-byte validation passes.
 * Optionally pass type="" to get a zero-filled buffer (for invalid-type tests).
 */
function createMockFile(
  name: string,
  type: string,
  sizeBytes: number
): File {
  const headerBytes = MAGIC_BYTES[type] ?? [];
  const totalSize = Math.max(Math.min(sizeBytes, 64), headerBytes.length);
  const buf = new Uint8Array(totalSize);
  buf.set(headerBytes, 0);
  const file = new File([buf], name, { type });
  // Override size property for large file tests
  if (sizeBytes !== totalSize) {
    Object.defineProperty(file, "size", { value: sizeBytes });
  }
  return file;
}

/**
 * Create a NextRequest with a mocked formData() method to avoid
 * jsdom issues with multipart parsing in the test environment.
 */
function createUploadRequest(
  formDataEntries: Record<string, File | string | null>,
  headers?: Record<string, string>
): NextRequest {
  const req = new NextRequest(
    new URL("/api/upload", "http://localhost:3000"),
    {
      method: "POST",
      headers: new Headers(headers || {}),
    }
  );

  // Mock formData() to return a FormData-like object
  const formData = new FormData();
  Object.entries(formDataEntries).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value);
    }
  });

  // Replace the formData method with our mock
  vi.spyOn(req, "formData").mockResolvedValue(formData);

  return req;
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true, remaining: 19, resetAt: Date.now() + 3600000 });
    mockVictimFindUnique.mockResolvedValue({
      id: "victim-123",
      slug: "amini-mahsa",
    } as any);
    mockPhotoCount.mockResolvedValue(0);
    mockPhotoCreate.mockResolvedValue({
      id: "photo-1",
      url: "/uploads/amini-mahsa-1234567890.jpg",
      isPrimary: true,
    } as any);
  });

  describe("Authentication", () => {
    it("returns 401 when x-forwarded-user header is missing", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest({ file, victimId: "victim-123" })
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 401 when x-forwarded-user header is empty", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "" }
        )
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("allows request when x-forwarded-user is present", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(201);
    });
  });

  describe("Input Validation", () => {
    it("returns 400 when no file is provided", async () => {
      const res = await POST(
        createUploadRequest(
          { victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("No file provided");
    });

    it("returns 400 when victimId is missing", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest({ file }, { "x-forwarded-user": "admin" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("victimId required");
    });

    it("returns 400 for invalid file type", async () => {
      const file = createMockFile("document.pdf", "application/pdf", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Unsupported file type");
      expect(json.error).toContain("jpg");
      expect(json.error).toContain("png");
      expect(json.error).toContain("webp");
    });

    it("returns 400 for file exceeding 5MB", async () => {
      const file = createMockFile(
        "large-photo.jpg",
        "image/jpeg",
        6 * 1024 * 1024
      );
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("File too large");
      expect(json.error).toContain("5MB");
    });

    it("accepts image/jpeg", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(201);
    });

    it("accepts image/png", async () => {
      const file = createMockFile("photo.png", "image/png", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(201);
    });

    it("accepts image/webp", async () => {
      const file = createMockFile("photo.webp", "image/webp", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(201);
    });

    it("accepts file at exactly 5MB", async () => {
      const file = createMockFile(
        "max-size.jpg",
        "image/jpeg",
        5 * 1024 * 1024
      );
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(201);
    });
  });

  describe("Victim Existence Check", () => {
    it("returns 404 when victim does not exist", async () => {
      mockVictimFindUnique.mockResolvedValue(null);

      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "nonexistent" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Victim not found");
    });

    it("queries victim with correct ID and select fields", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockVictimFindUnique).toHaveBeenCalledWith({
        where: { id: "victim-123" },
        select: { id: true, slug: true },
      });
    });
  });

  describe("File Writing", () => {
    it("creates upload directory with recursive option", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining("uploads"),
        { recursive: true }
      );
    });

    it("writes file to disk with buffer data", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const filepath = mockWriteFile.mock.calls[0][0] as string;
      expect(filepath).toContain("uploads");
      expect(filepath).toContain("amini-mahsa-");
    });

    it("generates filename using victim slug and timestamp", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      const filepath = mockWriteFile.mock.calls[0][0] as string;
      // Filename should be like: amini-mahsa-1234567890.jpg
      expect(filepath).toMatch(/amini-mahsa-\d+\.jpg$/);
    });

    it("preserves file extension from original filename", async () => {
      const file = createMockFile("photo.png", "image/png", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      const filepath = mockWriteFile.mock.calls[0][0] as string;
      expect(filepath).toMatch(/\.png$/);
    });
  });

  describe("Photo Record Creation", () => {
    it("creates photo record with correct data", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockPhotoCreate).toHaveBeenCalledWith({
        data: {
          victimId: "victim-123",
          url: expect.stringMatching(/^\/uploads\/amini-mahsa-\d+\.jpg$/),
          captionEn: null,
          photoType: "portrait",
          isPrimary: true,
          sortOrder: 0,
        },
      });
    });

    it("sets isPrimary to true when victim has no existing photos", async () => {
      mockPhotoCount.mockResolvedValue(0);

      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockPhotoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isPrimary: true,
          sortOrder: 0,
        }),
      });
    });

    it("sets isPrimary to false when victim already has photos", async () => {
      mockPhotoCount.mockResolvedValue(3);

      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockPhotoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isPrimary: false,
          sortOrder: 3,
        }),
      });
    });

    it("stores caption when provided", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123", caption: "Portrait from 2019" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockPhotoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          captionEn: "Portrait from 2019",
        }),
      });
    });

    it("sets captionEn to null when no caption provided", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(mockPhotoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          captionEn: null,
        }),
      });
    });
  });

  describe("Successful Response", () => {
    it("returns 201 with photo id, url, and isPrimary", async () => {
      const file = createMockFile("photo.jpg", "image/jpeg", 1024);
      const res = await POST(
        createUploadRequest(
          { file, victimId: "victim-123" },
          { "x-forwarded-user": "admin" }
        )
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBe("photo-1");
      expect(json.url).toContain("/uploads/");
      expect(json.isPrimary).toBe(true);
    });
  });
});
