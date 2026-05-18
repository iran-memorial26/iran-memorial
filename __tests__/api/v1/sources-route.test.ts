import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/sources/route";
import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/api-auth");
vi.mock("@/lib/db", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
  },
}));

const mockVerifyApiKey = vi.mocked(verifyApiKey);
const mockCheckRateLimit = vi.mocked(checkApiKeyRateLimit);
const mockLogUsage = vi.mocked(logApiUsage);
const mockDataSourceFindMany = vi.mocked(prisma.dataSource.findMany);

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers({
      authorization: "Bearer iran_mem_test123",
      ...headers,
    }),
    nextUrl: new URL("https://test.com/api/v1/sources"),
  } as NextRequest;
}

describe("GET /api/v1/sources", () => {
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
        nextUrl: new URL("https://test.com/api/v1/sources"),
      } as NextRequest;

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("accepts valid API key", async () => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
      mockDataSourceFindMany.mockResolvedValue([]);

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
      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/sources", "GET", 429, request);
    });

    it("checks rate limit with correct parameters", async () => {
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 500, resetAt: Date.now() + 3600000 });
      mockDataSourceFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      await GET(request);

      expect(mockCheckRateLimit).toHaveBeenCalledWith("key-123", "/api/v1/sources", 1000);
    });

    it("includes rate limit headers in successful response", async () => {
      const resetAt = Date.now() + 3600000;
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 750, resetAt });
      mockDataSourceFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("1000");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("750");
    });
  });

  describe("Source Retrieval", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("returns all data sources ordered by name", async () => {
      const mockSources = [
        {
          slug: "boroumand",
          name: "Boroumand Foundation",
          nameEn: "Boroumand Foundation",
          nameFa: "بنیاد بروومند",
          nameDe: "Boroumand Stiftung",
          url: "https://www.iranrights.org",
          descriptionEn: "Database of executions in Iran",
          descriptionFa: "پایگاه داده اعدام‌ها در ایران",
          descriptionDe: "Datenbank der Hinrichtungen im Iran",
          credibility: "HIGH",
          sourceType: "NGO",
          isActive: true,
          _count: { sources: 5432 },
        },
        {
          slug: "wikipedia",
          name: "Wikipedia",
          nameEn: "Wikipedia",
          nameFa: "ویکی‌پدیا",
          nameDe: "Wikipedia",
          url: "https://wikipedia.org",
          descriptionEn: "Free online encyclopedia",
          descriptionFa: "دانشنامه آزاد",
          descriptionDe: "Freie Online-Enzyklopädie",
          credibility: "MEDIUM",
          sourceType: "ENCYCLOPEDIA",
          isActive: true,
          _count: { sources: 1234 },
        },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].slug).toBe("boroumand");
      expect(data.data[1].slug).toBe("wikipedia");
    });

    it("includes source count for each data source", async () => {
      const mockSources = [
        {
          slug: "iranvictims",
          name: "IranVictims.org",
          nameEn: "IranVictims.org",
          nameFa: "قربانیان ایران",
          nameDe: "IranVictims.org",
          url: "https://iranvictims.org",
          descriptionEn: "Memorial website",
          descriptionFa: "وب‌سایت یادبود",
          descriptionDe: "Gedenkwebseite",
          credibility: "HIGH",
          sourceType: "MEMORIAL",
          isActive: true,
          _count: { sources: 2500 },
        },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0]._count.sources).toBe(2500);
    });

    it("includes credibility ratings", async () => {
      const mockSources = [
        {
          slug: "high-cred",
          name: "High Credibility Source",
          credibility: "HIGH",
          isActive: true,
          _count: { sources: 100 },
        },
        {
          slug: "medium-cred",
          name: "Medium Credibility Source",
          credibility: "MEDIUM",
          isActive: true,
          _count: { sources: 50 },
        },
        {
          slug: "low-cred",
          name: "Low Credibility Source",
          credibility: "LOW",
          isActive: true,
          _count: { sources: 10 },
        },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].credibility).toBe("HIGH");
      expect(data.data[1].credibility).toBe("MEDIUM");
      expect(data.data[2].credibility).toBe("LOW");
    });

    it("includes multilingual names and descriptions", async () => {
      const mockSources = [
        {
          slug: "test-source",
          name: "Test Source",
          nameEn: "Test Source English",
          nameFa: "منبع آزمایشی",
          nameDe: "Testquelle",
          url: "https://test.com",
          descriptionEn: "English description",
          descriptionFa: "توضیحات فارسی",
          descriptionDe: "Deutsche Beschreibung",
          credibility: "HIGH",
          sourceType: "OTHER",
          isActive: true,
          _count: { sources: 10 },
        },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      const source = data.data[0];
      expect(source.nameEn).toBe("Test Source English");
      expect(source.nameFa).toBe("منبع آزمایشی");
      expect(source.nameDe).toBe("Testquelle");
      expect(source.descriptionEn).toBe("English description");
      expect(source.descriptionFa).toBe("توضیحات فارسی");
      expect(source.descriptionDe).toBe("Deutsche Beschreibung");
    });

    it("returns empty array when no sources exist", async () => {
      mockDataSourceFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it("queries sources with correct Prisma options", async () => {
      mockDataSourceFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      await GET(request);

      expect(mockDataSourceFindMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
        select: {
          slug: true,
          name: true,
          nameEn: true,
          nameFa: true,
          nameDe: true,
          url: true,
          descriptionEn: true,
          descriptionFa: true,
          descriptionDe: true,
          credibility: true,
          sourceType: true,
          isActive: true,
          _count: { select: { sources: true } },
        },
      });
    });
  });

  describe("Source Types", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("includes different source types", async () => {
      const mockSources = [
        { slug: "ngo-source", name: "NGO", sourceType: "NGO", isActive: true, _count: { sources: 100 } },
        { slug: "news-source", name: "News", sourceType: "NEWS", isActive: true, _count: { sources: 200 } },
        { slug: "gov-source", name: "Gov", sourceType: "GOVERNMENT", isActive: true, _count: { sources: 50 } },
        {
          slug: "memorial-source",
          name: "Memorial",
          sourceType: "MEMORIAL",
          isActive: true,
          _count: { sources: 300 },
        },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].sourceType).toBe("NGO");
      expect(data.data[1].sourceType).toBe("NEWS");
      expect(data.data[2].sourceType).toBe("GOVERNMENT");
      expect(data.data[3].sourceType).toBe("MEMORIAL");
    });
  });

  describe("Active Status", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("includes isActive flag for each source", async () => {
      const mockSources = [
        { slug: "active-source", name: "Active", isActive: true, _count: { sources: 100 } },
        { slug: "inactive-source", name: "Inactive", isActive: false, _count: { sources: 50 } },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].isActive).toBe(true);
      expect(data.data[1].isActive).toBe(false);
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
      mockDataSourceFindMany.mockResolvedValue([]);

      const request = createMockRequest();
      await GET(request);

      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/sources", "GET", 200, request);
    });

    it("logs 500 error on database failure", async () => {
      mockDataSourceFindMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/sources", "GET", 500, request);
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
      mockDataSourceFindMany.mockRejectedValue(new Error("Prisma error"));

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("handles network errors gracefully", async () => {
      mockDataSourceFindMany.mockRejectedValue(new Error("Network timeout"));

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
      const mockSources = [
        {
          slug: "test-source",
          name: "Test",
          isActive: true,
          credibility: "HIGH",
          sourceType: "NGO",
          _count: { sources: 10 },
        },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty("data");
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("returns sources with all expected fields", async () => {
      const mockSources = [
        {
          slug: "complete-source",
          name: "Complete Source",
          nameEn: "Complete Source English",
          nameFa: "منبع کامل",
          nameDe: "Vollständige Quelle",
          url: "https://example.com",
          descriptionEn: "English desc",
          descriptionFa: "توضیح فارسی",
          descriptionDe: "Deutsche Beschreibung",
          credibility: "HIGH",
          sourceType: "MEMORIAL",
          isActive: true,
          _count: { sources: 500 },
        },
      ];

      mockDataSourceFindMany.mockResolvedValue(mockSources as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      const source = data.data[0];
      expect(source).toHaveProperty("slug");
      expect(source).toHaveProperty("name");
      expect(source).toHaveProperty("nameEn");
      expect(source).toHaveProperty("nameFa");
      expect(source).toHaveProperty("nameDe");
      expect(source).toHaveProperty("url");
      expect(source).toHaveProperty("descriptionEn");
      expect(source).toHaveProperty("descriptionFa");
      expect(source).toHaveProperty("descriptionDe");
      expect(source).toHaveProperty("credibility");
      expect(source).toHaveProperty("sourceType");
      expect(source).toHaveProperty("isActive");
      expect(source).toHaveProperty("_count");
    });
  });
});
