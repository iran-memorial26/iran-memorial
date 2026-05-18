import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/victims/route";
import { NextRequest, NextResponse } from "next/server";

// Mock dependencies
vi.mock("@/lib/api-auth", () => ({
  verifyApiKey: vi.fn(),
  checkApiKeyRateLimit: vi.fn(),
  logApiUsage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

const mockVerifyApiKey = vi.mocked(verifyApiKey);
const mockCheckApiKeyRateLimit = vi.mocked(checkApiKeyRateLimit);
const mockLogApiUsage = vi.mocked(logApiUsage);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);

function createRequest(searchParams: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/v1/victims");
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url, {
    headers: new Headers({ authorization: "Bearer iran_mem_test123" }),
  });
}

const mockApiContext = {
  apiKeyId: "key-123",
  name: "Test Partner",
  rateLimit: 1000,
};

const mockVictim = {
  id: "victim-1",
  slug: "test-victim",
  name_latin: "Test Victim",
  name_farsi: "تست",
  aliases: ["Alias 1"],
  date_of_birth: "1990-01-01",
  date_of_death: "2022-09-16",
  age_at_death: 32,
  place_of_death: "Tehran",
  province: "Tehran",
  city_name_en: "Tehran",
  city_name_fa: "تهران",
  city_name_de: "Teheran",
  province_name_en: "Tehran Province",
  province_name_fa: "استان تهران",
  province_name_de: "Provinz Teheran",
  gender: "female",
  cause_of_death: "Police brutality",
  photo_url: "https://example.com/photo.jpg",
  verification_status: "verified",
  data_source: "iranvictims",
  event_slug: "mahsa-amini-protests",
  event_title_en: "Mahsa Amini Protests",
  event_title_fa: "اعتراضات مهسا امینی",
};

describe("GET /api/v1/victims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiKey.mockResolvedValue({ context: mockApiContext, error: undefined });
    mockCheckApiKeyRateLimit.mockResolvedValue({
      success: true,
      remaining: 999,
      resetAt: Date.now() + 3600000,
    });
  });

  describe("Authentication & Rate Limiting", () => {
    it("returns 401 when API key verification fails", async () => {
      mockVerifyApiKey.mockResolvedValue({
        context: null,
        error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
      });

      const req = createRequest();
      const response = await GET(req);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Invalid API key");
    });

    it("returns 429 when rate limit exceeded", async () => {
      mockCheckApiKeyRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 1800000,
      });

      const req = createRequest();
      const response = await GET(req);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe("Rate limit exceeded");
      expect(json.retry_after).toBeGreaterThan(0);
      expect(mockLogApiUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims", "GET", 429, req);
    });

    it("includes rate limit headers in successful response", async () => {
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 1 }]);

      const req = createRequest();
      const response = await GET(req);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("1000");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("999");
      expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });
  });

  describe("Pagination", () => {
    beforeEach(() => {
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 100 }]);
    });

    it("uses default pagination (page=1, limit=50)", async () => {
      const req = createRequest();
      const response = await GET(req);
      const json = await response.json();

      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(50);
      expect(json.meta.total).toBe(100);
      expect(json.meta.total_pages).toBe(2);
    });

    it("respects custom page parameter", async () => {
      const req = createRequest({ page: "3" });
      const response = await GET(req);
      const json = await response.json();

      expect(json.meta.page).toBe(3);
    });

    it("respects custom limit parameter", async () => {
      const req = createRequest({ limit: "25" });
      const response = await GET(req);
      const json = await response.json();

      expect(json.meta.limit).toBe(25);
    });

    it("caps limit at 100", async () => {
      const req = createRequest({ limit: "500" });
      const response = await GET(req);
      const json = await response.json();

      expect(json.meta.limit).toBe(100);
    });

    it("enforces minimum page of 1", async () => {
      const req = createRequest({ page: "-5" });
      const response = await GET(req);
      const json = await response.json();

      expect(json.meta.page).toBe(1);
    });

    it("enforces minimum limit of 1", async () => {
      const req = createRequest({ limit: "0" });
      const response = await GET(req);
      const json = await response.json();

      expect(json.meta.limit).toBe(1);
    });

    it("calculates total_pages correctly", async () => {
      mockQueryRaw.mockReset();
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 237 }]);

      const req = createRequest({ limit: "25" });
      const response = await GET(req);
      const json = await response.json();

      expect(json.meta.total_pages).toBe(10); // Math.ceil(237 / 25)
    });
  });

  describe("Filters", () => {
    beforeEach(() => {
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 1 }]);
    });

    it("filters by event slug", async () => {
      const req = createRequest({ event: "mahsa-amini-protests" });
      await GET(req);

      // Verify Prisma query was called (filter is applied in SQL)
      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("filters by province slug", async () => {
      const req = createRequest({ province: "tehran" });
      await GET(req);

      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("filters by gender (valid values)", async () => {
      const req = createRequest({ gender: "female" });
      await GET(req);

      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("ignores invalid gender values", async () => {
      const req = createRequest({ gender: "invalid" });
      await GET(req);

      // Still executes query, but without gender filter
      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("filters by verified status", async () => {
      const req = createRequest({ verified: "true" });
      await GET(req);

      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("filters by year_start (valid 4-digit year)", async () => {
      const req = createRequest({ year_start: "2022" });
      await GET(req);

      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("filters by year_end (valid 4-digit year)", async () => {
      const req = createRequest({ year_end: "2023" });
      await GET(req);

      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("ignores invalid year_start format", async () => {
      const req = createRequest({ year_start: "22" });
      await GET(req);

      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it("combines multiple filters", async () => {
      const req = createRequest({
        event: "mahsa-amini-protests",
        province: "tehran",
        gender: "female",
        verified: "true",
        year_start: "2022",
        year_end: "2023",
      });
      await GET(req);

      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe("Response Format", () => {
    it("returns data array and meta object", async () => {
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 1 }]);

      const req = createRequest();
      const response = await GET(req);
      const json = await response.json();

      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("meta");
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        total_pages: expect.any(Number),
      });
    });

    it("maps victim fields correctly", async () => {
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 1 }]);

      const req = createRequest();
      const response = await GET(req);
      const json = await response.json();

      const victim = json.data[0];
      expect(victim).toMatchObject({
        id: "victim-1",
        slug: "test-victim",
        name_latin: "Test Victim",
        name_farsi: "تست",
        aliases: ["Alias 1"],
        date_of_birth: "1990-01-01",
        date_of_death: "2022-09-16",
        age_at_death: 32,
        gender: "female",
        verification_status: "verified",
      });
    });

    it("includes event object when event exists", async () => {
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 1 }]);

      const req = createRequest();
      const response = await GET(req);
      const json = await response.json();

      expect(json.data[0].event).toEqual({
        slug: "mahsa-amini-protests",
        title_en: "Mahsa Amini Protests",
        title_fa: "اعتراضات مهسا امینی",
      });
    });

    it("sets event to null when no event linked", async () => {
      const victimWithoutEvent = { ...mockVictim, event_slug: null };
      mockQueryRaw.mockResolvedValueOnce([victimWithoutEvent]).mockResolvedValueOnce([{ total: 1 }]);

      const req = createRequest();
      const response = await GET(req);
      const json = await response.json();

      expect(json.data[0].event).toBeNull();
    });

    it("handles empty aliases array", async () => {
      const victimNoAliases = { ...mockVictim, aliases: null };
      mockQueryRaw.mockResolvedValueOnce([victimNoAliases]).mockResolvedValueOnce([{ total: 1 }]);

      const req = createRequest();
      const response = await GET(req);
      const json = await response.json();

      expect(json.data[0].aliases).toEqual([]);
    });

    it("returns empty data array when no results", async () => {
      mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

      const req = createRequest();
      const response = await GET(req);
      const json = await response.json();

      expect(json.data).toEqual([]);
      expect(json.meta.total).toBe(0);
      expect(json.meta.total_pages).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error("Database connection failed"));

      const req = createRequest();
      const response = await GET(req);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Internal server error");
      expect(mockLogApiUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims", "GET", 500, req);
    });

    it("handles count query error", async () => {
      mockQueryRaw
        .mockResolvedValueOnce([mockVictim])
        .mockRejectedValueOnce(new Error("Count query failed"));

      const req = createRequest();
      const response = await GET(req);

      expect(response.status).toBe(500);
    });
  });

  describe("Usage Logging", () => {
    it("logs successful requests", async () => {
      mockQueryRaw.mockResolvedValueOnce([mockVictim]).mockResolvedValueOnce([{ total: 1 }]);

      const req = createRequest();
      await GET(req);

      expect(mockLogApiUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims", "GET", 200, req);
    });

    it("logs failed requests", async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error("DB error"));

      const req = createRequest();
      await GET(req);

      expect(mockLogApiUsage).toHaveBeenCalledWith("key-123", "/api/v1/victims", "GET", 500, req);
    });
  });
});
