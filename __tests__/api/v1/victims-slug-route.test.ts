import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/victims/[slug]/route";
import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/api-auth");
vi.mock("@/lib/db", () => ({
  prisma: {
    victim: {
      findUnique: vi.fn(),
    },
  },
}));

const mockVerifyApiKey = vi.mocked(verifyApiKey);
const mockCheckRateLimit = vi.mocked(checkApiKeyRateLimit);
const mockLogUsage = vi.mocked(logApiUsage);
const mockVictimFindUnique = vi.mocked(prisma.victim.findUnique);

function createMockRequest(slug: string, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers({
      authorization: "Bearer iran_mem_test123",
      ...headers,
    }),
    nextUrl: new URL(`https://test.com/api/v1/victims/${slug}`),
  } as NextRequest;
}

describe("GET /api/v1/victims/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when API key verification fails", async () => {
      mockVerifyApiKey.mockResolvedValue({
        context: null,
        error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
      });

      const request = createMockRequest("mahsa-amini");
      const params = Promise.resolve({ slug: "mahsa-amini" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Invalid API key" });
    });

    it("accepts valid API key", async () => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
      mockVictimFindUnique.mockResolvedValue(null);

      const request = createMockRequest("test-slug");
      const params = Promise.resolve({ slug: "test-slug" });
      await GET(request, { params });

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

      const request = createMockRequest("test-slug");
      const params = Promise.resolve({ slug: "test-slug" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("Rate limit exceeded");
      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims/[slug]", "GET", 429, request);
    });

    it("includes rate limit headers in successful response", async () => {
      const resetAt = Date.now() + 3600000;
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 800, resetAt });
      mockVictimFindUnique.mockResolvedValue({
        id: "victim-1",
        slug: "test-victim",
        nameLatin: "Test Victim",
      } as any);

      const request = createMockRequest("test-victim");
      const params = Promise.resolve({ slug: "test-victim" });
      const response = await GET(request, { params });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("1000");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("800");
      expect(response.headers.get("X-RateLimit-Reset")).toBe(String(Math.floor(resetAt / 1000)));
    });
  });

  describe("Victim Retrieval", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("returns 404 when victim not found", async () => {
      mockVictimFindUnique.mockResolvedValue(null);

      const request = createMockRequest("non-existent-slug");
      const params = Promise.resolve({ slug: "non-existent-slug" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Victim not found");
      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims/[slug]", "GET", 404, request);
    });

    it("returns victim with all fields when found", async () => {
      const mockVictim = {
        id: "victim-1",
        slug: "mahsa-amini",
        nameLatin: "Mahsa Amini",
        nameFarsi: "مهسا امینی",
        aliases: ["Zhina Amini"],
        dateOfBirth: new Date("2000-09-21"),
        dateOfDeath: new Date("2022-09-16"),
        ageAtDeath: 22,
        placeOfDeath: "Tehran",
        gender: "female",
        causeOfDeath: "beating",
        circumstancesEn: "Died in morality police custody",
        circumstancesFa: "در بازداشت گشت ارشاد جان باخت",
        photoUrl: "https://example.com/mahsa.jpg",
        verificationStatus: "verified",
        dataSource: "iranvictims",
        event: {
          slug: "woman-life-freedom-2022",
          titleEn: "Woman, Life, Freedom",
          titleFa: "زن، زندگی، آزادی",
          titleDe: "Frau, Leben, Freiheit",
        },
        city: {
          id: "city-1",
          nameEn: "Saqqez",
          nameFa: "سقز",
          nameDe: "Saqqez",
          province: {
            id: "prov-1",
            nameEn: "Kurdistan",
            nameFa: "کردستان",
            nameDe: "Kurdistan",
          },
        },
        sources: [
          {
            url: "https://iranvictims.org/mahsa-amini",
            name: "Mahsa Amini Memorial Page",
            sourceType: "MEMORIAL",
            dataSource: {
              name: "IranVictims.org",
              credibility: "HIGH",
            },
          },
        ],
        photos: [
          {
            url: "https://example.com/mahsa1.jpg",
            captionEn: "Mahsa Amini",
            captionFa: "مهسا امینی",
            isPrimary: true,
          },
        ],
      };

      mockVictimFindUnique.mockResolvedValue(mockVictim as any);

      const request = createMockRequest("mahsa-amini");
      const params = Promise.resolve({ slug: "mahsa-amini" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe("mahsa-amini");
      expect(data.nameLatin).toBe("Mahsa Amini");
      expect(data.nameFarsi).toBe("مهسا امینی");
      expect(data.event.slug).toBe("woman-life-freedom-2022");
    });

    it("includes event information", async () => {
      const mockVictim = {
        id: "victim-1",
        slug: "test-victim",
        nameLatin: "Test Victim",
        event: {
          slug: "massacre-1988",
          titleEn: "1988 Prison Massacre",
          titleFa: "قتل‌عام زندانیان ۱۳۶۷",
          titleDe: "Gefängnismassaker 1988",
        },
      };

      mockVictimFindUnique.mockResolvedValue(mockVictim as any);

      const request = createMockRequest("test-victim");
      const params = Promise.resolve({ slug: "test-victim" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.event).toBeDefined();
      expect(data.event.slug).toBe("massacre-1988");
      expect(data.event.titleEn).toBe("1988 Prison Massacre");
      expect(data.event.titleFa).toBe("قتل‌عام زندانیان ۱۳۶۷");
    });

    it("includes city and province information", async () => {
      const mockVictim = {
        id: "victim-1",
        slug: "test-victim",
        nameLatin: "Test Victim",
        city: {
          id: "city-1",
          nameEn: "Tehran",
          nameFa: "تهران",
          nameDe: "Teheran",
          province: {
            id: "prov-1",
            nameEn: "Tehran Province",
            nameFa: "استان تهران",
            nameDe: "Provinz Teheran",
          },
        },
      };

      mockVictimFindUnique.mockResolvedValue(mockVictim as any);

      const request = createMockRequest("test-victim");
      const params = Promise.resolve({ slug: "test-victim" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.city).toBeDefined();
      expect(data.city.nameEn).toBe("Tehran");
      expect(data.city.province.nameEn).toBe("Tehran Province");
    });

    it("includes sources with data source credibility", async () => {
      const mockVictim = {
        id: "victim-1",
        slug: "test-victim",
        nameLatin: "Test Victim",
        sources: [
          {
            url: "https://example.com/source1",
            name: "Source 1",
            sourceType: "NEWS",
            dataSource: {
              name: "News Agency",
              credibility: "HIGH",
            },
          },
          {
            url: "https://example.com/source2",
            name: "Source 2",
            sourceType: "MEMORIAL",
            dataSource: {
              name: "Memorial Site",
              credibility: "MEDIUM",
            },
          },
        ],
      };

      mockVictimFindUnique.mockResolvedValue(mockVictim as any);

      const request = createMockRequest("test-victim");
      const params = Promise.resolve({ slug: "test-victim" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.sources).toHaveLength(2);
      expect(data.sources[0].dataSource.credibility).toBe("HIGH");
      expect(data.sources[1].dataSource.credibility).toBe("MEDIUM");
    });

    it("includes photos ordered by primary status and sort order", async () => {
      const mockVictim = {
        id: "victim-1",
        slug: "test-victim",
        nameLatin: "Test Victim",
        photos: [
          {
            url: "https://example.com/primary.jpg",
            captionEn: "Primary photo",
            captionFa: "عکس اصلی",
            isPrimary: true,
          },
          {
            url: "https://example.com/secondary.jpg",
            captionEn: "Secondary photo",
            captionFa: "عکس ثانویه",
            isPrimary: false,
          },
        ],
      };

      mockVictimFindUnique.mockResolvedValue(mockVictim as any);

      const request = createMockRequest("test-victim");
      const params = Promise.resolve({ slug: "test-victim" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.photos).toHaveLength(2);
      expect(data.photos[0].isPrimary).toBe(true);
      expect(data.photos[0].url).toBe("https://example.com/primary.jpg");
    });

    it("queries victim with correct Prisma options", async () => {
      mockVictimFindUnique.mockResolvedValue(null);

      const request = createMockRequest("test-slug");
      const params = Promise.resolve({ slug: "test-slug" });
      await GET(request, { params });

      expect(mockVictimFindUnique).toHaveBeenCalledWith({
        where: { slug: "test-slug" },
        select: {
          id: true,
          slug: true,
          nameLatin: true,
          nameFarsi: true,
          aliases: true,
          dateOfBirth: true,
          placeOfBirth: true,
          gender: true,
          photoUrl: true,
          occupationEn: true,
          occupationFa: true,
          dateOfDeath: true,
          ageAtDeath: true,
          placeOfDeath: true,
          province: true,
          causeOfDeath: true,
          circumstancesEn: true,
          circumstancesFa: true,
          verificationStatus: true,
          event: { select: { slug: true, titleEn: true, titleFa: true, titleDe: true } },
          city: { include: { province: true } },
          sources: {
            select: {
              url: true,
              name: true,
              sourceType: true,
              dataSource: { select: { name: true, credibility: true } },
            },
          },
          photos: {
            where: { isBroken: false },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            select: { url: true, captionEn: true, captionFa: true, isPrimary: true },
          },
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
      mockVictimFindUnique.mockResolvedValue({
        id: "victim-1",
        slug: "test-victim",
        nameLatin: "Test",
      } as any);

      const request = createMockRequest("test-victim");
      const params = Promise.resolve({ slug: "test-victim" });
      await GET(request, { params });

      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims/[slug]", "GET", 200, request);
    });

    it("logs 404 when victim not found", async () => {
      mockVictimFindUnique.mockResolvedValue(null);

      const request = createMockRequest("missing");
      const params = Promise.resolve({ slug: "missing" });
      await GET(request, { params });

      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims/[slug]", "GET", 404, request);
    });

    it("logs 500 error on database failure", async () => {
      mockVictimFindUnique.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("test-victim");
      const params = Promise.resolve({ slug: "test-victim" });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockLogUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims/[slug]", "GET", 500, request);
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
      mockVictimFindUnique.mockRejectedValue(new Error("Prisma error"));

      const request = createMockRequest("test");
      const params = Promise.resolve({ slug: "test" });
      const response = await GET(request, { params });

      expect(response.status).toBe(500);
    });

    it("handles invalid slug gracefully", async () => {
      mockVictimFindUnique.mockResolvedValue(null);

      const request = createMockRequest("invalid@slug");
      const params = Promise.resolve({ slug: "invalid@slug" });
      const response = await GET(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe("Slug Parameter Handling", () => {
    beforeEach(() => {
      mockVerifyApiKey.mockResolvedValue({
        context: { apiKeyId: "key-123", name: "Test Partner", rateLimit: 1000 },
      });
      mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 999, resetAt: Date.now() + 3600000 });
    });

    it("handles slug with dashes", async () => {
      mockVictimFindUnique.mockResolvedValue({
        id: "victim-1",
        slug: "john-doe-smith",
        nameLatin: "John Doe Smith",
      } as any);

      const request = createMockRequest("john-doe-smith");
      const params = Promise.resolve({ slug: "john-doe-smith" });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.slug).toBe("john-doe-smith");
    });

    it("handles slug with numbers", async () => {
      mockVictimFindUnique.mockResolvedValue({
        id: "victim-1",
        slug: "victim-1979",
        nameLatin: "Victim 1979",
      } as any);

      const request = createMockRequest("victim-1979");
      const params = Promise.resolve({ slug: "victim-1979" });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.slug).toBe("victim-1979");
    });

    it("handles URL-encoded slugs", async () => {
      const slug = "test victim"; // Space
      const encodedSlug = "test-victim";

      mockVictimFindUnique.mockResolvedValue({
        id: "victim-1",
        slug: encodedSlug,
        nameLatin: "Test Victim",
      } as any);

      const request = createMockRequest(encodedSlug);
      const params = Promise.resolve({ slug: encodedSlug });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
    });
  });
});
