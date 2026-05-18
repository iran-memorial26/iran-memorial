import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/events/route";
import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/api-auth");
vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
    },
  },
}));

const mockVerifyApiKey = vi.mocked(verifyApiKey);
const mockCheckRateLimit = vi.mocked(checkApiKeyRateLimit);
const mockLogUsage = vi.mocked(logApiUsage);
const mockEventFindMany = vi.mocked(prisma.event.findMany);

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers({
      authorization: "Bearer iran_mem_test123",
      ...headers,
    }),
    nextUrl: new URL("https://test.com/api/v1/events"),
  } as NextRequest;
}

describe("GET /api/v1/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when API key verification fails", async () => {
      mockVerifyApiKey.mockResolvedValue({
        context: null,
        error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Invalid API key" });
    });

    it("returns 401 when authorization header is missing", async () => {
      mockVerifyApiKey.mockResolvedValue({
        context: null,
        error: NextResponse.json({ error: "Missing authorization" }, { status: 401 }),
      });

      const request = {
        headers: new Headers(),
        nextUrl: new URL("https://test.com/api/v1/events"),
      } as NextRequest;

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("accepts valid API key", async () => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
      mockEventFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockVerifyApiKey).toHaveBeenCalledWith(request);
    });
  });

  describe("Rate Limiting", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
    });

    it("returns 429 when rate limit exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 1800000 });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("Rate limit exceeded");
      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/events", "GET", 429, request);
    });

    it("checks rate limit with correct parameters", async () => {
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 500, resetAt: Date.now() + 3600000 });
      mockEventFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      await GET(request);

      expect(mockCheckRateLimit).toHaveBeenCalledWith("key-123", "/api/v1/events", 1000);
    });

    it("includes rate limit headers in successful response", async () => {
      const resetAt = Date.now() + 3600000;
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 850, resetAt });
      mockEventFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("1000");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("850");
    });
  });

  describe("Event Retrieval", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("returns all events ordered by date", async () => {
      const mockEvents = [
        {
          id: "event-1",
          slug: "revolution-1979",
          titleEn: "Iranian Revolution",
          titleFa: "انقلاب ایران",
          titleDe: "Islamische Revolution",
          dateStart: new Date("1979-02-11"),
          dateEnd: null,
          _count: { victims: 150 },
          photos: [{ url: "https://example.com/photo1.jpg", isPrimary: true }],
        },
        {
          id: "event-2",
          slug: "massacre-1988",
          titleEn: "1988 Prison Massacre",
          titleFa: "قتل‌عام زندانیان ۱۳۶۷",
          titleDe: "Gefängnismassaker 1988",
          dateStart: new Date("1988-07-01"),
          dateEnd: new Date("1988-09-30"),
          _count: { victims: 5000 },
          photos: [],
        },
      ];

      mockEventFindMany.mockResolvedValue(mockEvents as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].slug).toBe("revolution-1979");
      expect(data.data[1].slug).toBe("massacre-1988");
    });

    it("includes victim count for each event", async () => {
      const mockEvents = [
        {
          id: "event-1",
          slug: "green-movement-2009",
          titleEn: "Green Movement",
          dateStart: new Date("2009-06-12"),
          _count: { victims: 72 },
          photos: [],
        },
      ];

      mockEventFindMany.mockResolvedValue(mockEvents as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0]._count.victims).toBe(72);
    });

    it("includes primary photo if available", async () => {
      const mockEvents = [
        {
          id: "event-1",
          slug: "woman-life-freedom-2022",
          titleEn: "Woman, Life, Freedom",
          dateStart: new Date("2022-09-16"),
          _count: { victims: 500 },
          photos: [
            {
              id: "photo-1",
              url: "https://example.com/mahsa.jpg",
              isPrimary: true,
              caption: "Mahsa Amini",
            },
          ],
        },
      ];

      mockEventFindMany.mockResolvedValue(mockEvents as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].photos).toHaveLength(1);
      expect(data.data[0].photos[0].isPrimary).toBe(true);
      expect(data.data[0].photos[0].url).toBe("https://example.com/mahsa.jpg");
    });

    it("returns empty array when no events exist", async () => {
      mockEventFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it("queries events with correct Prisma options", async () => {
      mockEventFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      await GET(request);

      expect(mockEventFindMany).toHaveBeenCalledWith({
        orderBy: { dateStart: "asc" },
        include: {
          _count: { select: { victims: true } },
          photos: { where: { isPrimary: true, isBroken: false }, take: 1 },
        },
      });
    });
  });

  describe("Usage Logging", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("logs successful request", async () => {
      mockEventFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      await GET(request);

      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/events", "GET", 200, request);
    });

    it("logs 500 error on database failure", async () => {
      mockEventFindMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/events", "GET", 500, request);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("handles Prisma errors gracefully", async () => {
      mockEventFindMany.mockRejectedValue(new Error("Prisma error"));

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("handles network errors gracefully", async () => {
      mockEventFindMany.mockRejectedValue(new Error("Network timeout"));

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("Response Format", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("returns data in correct format", async () => {
      const mockEvents = [
        {
          id: "event-1",
          slug: "test-event",
          titleEn: "Test Event",
          dateStart: new Date("2020-01-01"),
          _count: { victims: 10 },
          photos: [],
        },
      ];

      mockEventFindMany.mockResolvedValue(mockEvents as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty("data");
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("returns events with all expected fields", async () => {
      const mockEvents = [
        {
          id: "event-1",
          slug: "cultural-revolution-1980",
          titleEn: "Cultural Revolution",
          titleFa: "انقلاب فرهنگی",
          titleDe: "Kulturrevolution",
          titleAr: "الثورة الثقافية",
          descriptionEn: "University closures...",
          descriptionFa: "بسته شدن دانشگاه‌ها...",
          descriptionDe: "Universitätsschließungen...",
          descriptionAr: "إغلاق الجامعات...",
          descriptionFr: "Fermetures d'universités...",
          descriptionIt: "Chiusure universitarie...",
          descriptionEs: "Cierres universitarios...",
          dateStart: new Date("1980-06-12"),
          dateEnd: new Date("1982-09-22"),
          estimatedKilledLow: 50,
          estimatedKilledHigh: 200,
          _count: { victims: 120 },
          photos: [],
        },
      ];

      mockEventFindMany.mockResolvedValue(mockEvents as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      const event = data.data[0];
      expect(event).toHaveProperty("id");
      expect(event).toHaveProperty("slug");
      expect(event).toHaveProperty("titleEn");
      expect(event).toHaveProperty("titleFa");
      expect(event).toHaveProperty("titleDe");
      expect(event).toHaveProperty("descriptionEn");
      expect(event).toHaveProperty("descriptionFr");
      expect(event).toHaveProperty("dateStart");
      expect(event).toHaveProperty("_count");
      expect(event).toHaveProperty("photos");
    });
  });
});
