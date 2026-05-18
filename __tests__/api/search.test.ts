import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSearchVictims, mockRateLimit } = vi.hoisted(() => ({
  mockSearchVictims: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  searchVictims: mockSearchVictims,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

import { GET } from "@/app/api/search/route";

function createRequest(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: new Headers(headers || {}),
  });
}

const mockVictimResults = [
  {
    id: "uuid-001",
    slug: "amini-mahsa-2000",
    nameLatin: "Mahsa Amini",
    nameFarsi: "مهسا امینی",
    dateOfDeath: new Date("2022-09-16"),
    placeOfDeath: "Tehran",
    causeOfDeath: "Head injuries",
    photoUrl: "https://example.com/photo.jpg",
    province: "Tehran",
    ageAtDeath: 22,
  },
  {
    id: "uuid-002",
    slug: "navid-afkari-1993",
    nameLatin: "Navid Afkari",
    nameFarsi: "نوید افکاری",
    dateOfDeath: new Date("2020-09-12"),
    placeOfDeath: "Shiraz",
    causeOfDeath: "Execution",
    photoUrl: null,
    province: "Fars",
    ageAtDeath: 27,
  },
];

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
  });

  describe("Rate Limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      });
      const res = await GET(createRequest("/api/search?q=test"));
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error).toContain("Too many requests");
    });

    it("includes Retry-After header on 429", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      });
      const res = await GET(createRequest("/api/search?q=test"));
      expect(res.headers.get("Retry-After")).toBe("60");
    });

    it("extracts first IP from x-forwarded-for header", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(
        createRequest("/api/search?q=test", {
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        })
      );
      expect(mockRateLimit).toHaveBeenCalledWith("1.2.3.4", "search", 100, 60);
    });

    it("uses 'unknown' when no IP header present", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(createRequest("/api/search?q=test"));
      expect(mockRateLimit).toHaveBeenCalledWith(
        "unknown",
        "search",
        100,
        60
      );
    });

    it("applies rate limit before processing query", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      });
      await GET(createRequest("/api/search?q=test"));
      expect(mockSearchVictims).not.toHaveBeenCalled();
    });

    it("calls rateLimit with single IP when x-forwarded-for has one entry", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(
        createRequest("/api/search?q=test", {
          "x-forwarded-for": "10.0.0.1",
        })
      );
      expect(mockRateLimit).toHaveBeenCalledWith(
        "10.0.0.1",
        "search",
        100,
        60
      );
    });
  });

  describe("Query Handling", () => {
    it("returns empty results for empty query string", async () => {
      const res = await GET(createRequest("/api/search?q="));
      const json = await res.json();
      expect(json.results).toEqual([]);
      expect(mockSearchVictims).not.toHaveBeenCalled();
    });

    it("returns empty results for missing query param", async () => {
      const res = await GET(createRequest("/api/search"));
      const json = await res.json();
      expect(json.results).toEqual([]);
      expect(mockSearchVictims).not.toHaveBeenCalled();
    });

    it("returns empty results for whitespace-only query", async () => {
      const res = await GET(createRequest("/api/search?q=%20%20%20"));
      const json = await res.json();
      expect(json.results).toEqual([]);
      expect(mockSearchVictims).not.toHaveBeenCalled();
    });

    it("calls searchVictims with query and default limit of 20", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(createRequest("/api/search?q=Mahsa"));
      expect(mockSearchVictims).toHaveBeenCalledWith("Mahsa", 20);
    });

    it("respects custom limit parameter", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(createRequest("/api/search?q=Test&limit=30"));
      expect(mockSearchVictims).toHaveBeenCalledWith("Test", 30);
    });

    it("caps limit at 50", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(createRequest("/api/search?q=Test&limit=100"));
      expect(mockSearchVictims).toHaveBeenCalledWith("Test", 50);
    });

    it("uses default limit when limit param is not a number", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(createRequest("/api/search?q=Test&limit=abc"));
      expect(mockSearchVictims).toHaveBeenCalledWith("Test", 20);
    });

    it("uses default limit when limit param is zero", async () => {
      mockSearchVictims.mockResolvedValue([]);
      await GET(createRequest("/api/search?q=Test&limit=0"));
      expect(mockSearchVictims).toHaveBeenCalledWith("Test", 20);
    });

    it("handles Farsi query strings", async () => {
      mockSearchVictims.mockResolvedValue([]);
      const farsiQuery = encodeURIComponent("مهسا");
      await GET(createRequest(`/api/search?q=${farsiQuery}`));
      expect(mockSearchVictims).toHaveBeenCalledWith("مهسا", 20);
    });
  });

  describe("Results Format", () => {
    it("returns mapped results with only allowed fields", async () => {
      mockSearchVictims.mockResolvedValue([mockVictimResults[0]]);

      const res = await GET(createRequest("/api/search?q=Mahsa"));
      const json = await res.json();

      expect(json.results).toHaveLength(1);
      const result = json.results[0];
      expect(result.id).toBe("uuid-001");
      expect(result.slug).toBe("amini-mahsa-2000");
      expect(result.nameLatin).toBe("Mahsa Amini");
      expect(result.nameFarsi).toBe("مهسا امینی");
      expect(result.placeOfDeath).toBe("Tehran");
    });

    it("excludes sensitive fields from response", async () => {
      mockSearchVictims.mockResolvedValue([mockVictimResults[0]]);

      const res = await GET(createRequest("/api/search?q=Mahsa"));
      const json = await res.json();

      const result = json.results[0];
      expect(result).not.toHaveProperty("causeOfDeath");
      expect(result).not.toHaveProperty("photoUrl");
      expect(result).not.toHaveProperty("province");
      expect(result).not.toHaveProperty("ageAtDeath");
    });

    it("returns multiple results", async () => {
      mockSearchVictims.mockResolvedValue(mockVictimResults);

      const res = await GET(createRequest("/api/search?q=victim"));
      const json = await res.json();

      expect(json.results).toHaveLength(2);
      expect(json.results[0].slug).toBe("amini-mahsa-2000");
      expect(json.results[1].slug).toBe("navid-afkari-1993");
    });

    it("returns empty array when searchVictims returns no matches", async () => {
      mockSearchVictims.mockResolvedValue([]);

      const res = await GET(createRequest("/api/search?q=nonexistent"));
      const json = await res.json();

      expect(json.results).toEqual([]);
    });

    it("returns 200 status for successful search", async () => {
      mockSearchVictims.mockResolvedValue([]);
      const res = await GET(createRequest("/api/search?q=test"));
      expect(res.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 with empty results on searchVictims error", async () => {
      mockSearchVictims.mockRejectedValue(new Error("DB connection failed"));
      const res = await GET(createRequest("/api/search?q=test"));
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.results).toEqual([]);
    });

    it("returns 500 on unexpected rejection", async () => {
      mockSearchVictims.mockRejectedValue(new Error("timeout"));
      const res = await GET(createRequest("/api/search?q=test"));
      expect(res.status).toBe(500);
    });
  });
});
