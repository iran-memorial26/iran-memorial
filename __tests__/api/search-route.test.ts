import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/queries", () => ({
  searchVictims: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { searchVictims } from "@/lib/queries";
import { rateLimit } from "@/lib/rate-limit";

const mockSearchVictims = vi.mocked(searchVictims);
const mockRateLimit = vi.mocked(rateLimit);

function createRequest(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: new Headers(headers || {}),
  });
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
  });

  it("returns empty results for empty query", async () => {
    const res = await GET(createRequest("/api/search?q="));
    const json = await res.json();
    expect(json.results).toEqual([]);
    expect(mockSearchVictims).not.toHaveBeenCalled();
  });

  it("returns empty results for missing query param", async () => {
    const res = await GET(createRequest("/api/search"));
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it("calls searchVictims with query and default limit", async () => {
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

  it("returns mapped results with only required fields", async () => {
    mockSearchVictims.mockResolvedValue([
      {
        slug: "amini-mahsa-2000",
        nameLatin: "Mahsa Amini",
        nameFarsi: "مهسا امینی",
        dateOfDeath: new Date("2022-09-16"),
        placeOfDeath: "Tehran",
        causeOfDeath: "Head injuries",
        photoUrl: "https://example.com/photo.jpg",
      },
    ] as any);

    const res = await GET(createRequest("/api/search?q=Mahsa"));
    const json = await res.json();

    expect(json.results).toHaveLength(1);
    expect(json.results[0].slug).toBe("amini-mahsa-2000");
    expect(json.results[0].nameLatin).toBe("Mahsa Amini");
    expect(json.results[0]).not.toHaveProperty("causeOfDeath");
    expect(json.results[0]).not.toHaveProperty("photoUrl");
  });

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

  it("extracts IP from x-forwarded-for header", async () => {
    mockSearchVictims.mockResolvedValue([]);
    await GET(
      createRequest("/api/search?q=test", {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      })
    );
    expect(mockRateLimit).toHaveBeenCalledWith("1.2.3.4", "search", 100, 60);
  });

  it("uses 'unknown' when no IP header", async () => {
    mockSearchVictims.mockResolvedValue([]);
    await GET(createRequest("/api/search?q=test"));
    expect(mockRateLimit).toHaveBeenCalledWith(
      "unknown",
      "search",
      100,
      60
    );
  });

  it("returns 500 and empty results on searchVictims error", async () => {
    mockSearchVictims.mockRejectedValue(new Error("DB connection failed"));
    const res = await GET(createRequest("/api/search?q=test"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });
});
