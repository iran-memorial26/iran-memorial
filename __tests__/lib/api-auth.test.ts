import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    apiUsage: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { verifyApiKey, checkApiKeyRateLimit, logApiUsage } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const mockPrisma = vi.mocked(prisma);
const mockFindFirst = vi.mocked(prisma.apiKey.findFirst);
const mockApiKeyUpdate = vi.mocked(prisma.apiKey.update);
const mockApiUsageCreate = vi.mocked(prisma.apiUsage.create);
const mockRateLimit = vi.mocked(rateLimit);

function createRequest(headers?: Record<string, string>) {
  return new NextRequest(new URL("http://localhost:3000/api/v1/victims"), {
    headers: new Headers(headers || {}),
  });
}

describe("verifyApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when Authorization header is missing", async () => {
    const req = createRequest();
    const { context, error } = await verifyApiKey(req);

    expect(context).toBeNull();
    expect(error).toBeDefined();
    const json = await error!.json();
    expect(json.error).toContain("Missing or invalid Authorization header");
    expect(error!.status).toBe(401);
  });

  it("returns error when Authorization header does not start with Bearer", async () => {
    const req = createRequest({ authorization: "Basic abc123" });
    const { context, error } = await verifyApiKey(req);

    expect(context).toBeNull();
    expect(error).toBeDefined();
    const json = await error!.json();
    expect(json.error).toContain("Missing or invalid Authorization header");
  });

  it("returns error when API key does not start with iran_mem_", async () => {
    const req = createRequest({ authorization: "Bearer invalid_key_123" });
    const { context, error } = await verifyApiKey(req);

    expect(context).toBeNull();
    expect(error).toBeDefined();
    const json = await error!.json();
    expect(json.error).toBe("Invalid API key format");
  });

  it("returns error when API key not found in database", async () => {
    mockFindFirst.mockResolvedValue(null);

    const req = createRequest({ authorization: "Bearer iran_mem_valid123" });
    const { context, error } = await verifyApiKey(req);

    expect(context).toBeNull();
    expect(error).toBeDefined();
    const json = await error!.json();
    expect(json.error).toBe("Invalid or inactive API key");
  });

  it("returns error when API key is inactive", async () => {
    mockFindFirst.mockResolvedValue({
      id: "key-id-1",
      name: "Test Partner",
      isActive: false,
      rateLimit: 1000,
      expiresAt: null,
    } as any);

    const req = createRequest({ authorization: "Bearer iran_mem_valid123" });
    const { context, error } = await verifyApiKey(req);

    expect(context).toBeNull();
    expect(error).toBeDefined();
    const json = await error!.json();
    expect(json.error).toBe("Invalid or inactive API key");
  });

  it("returns error when API key is expired", async () => {
    const pastDate = new Date(Date.now() - 86400000); // 1 day ago
    mockFindFirst.mockResolvedValue({
      id: "key-id-1",
      name: "Test Partner",
      isActive: true,
      rateLimit: 1000,
      expiresAt: pastDate,
    } as any);

    const req = createRequest({ authorization: "Bearer iran_mem_valid123" });
    const { context, error } = await verifyApiKey(req);

    expect(context).toBeNull();
    expect(error).toBeDefined();
    const json = await error!.json();
    expect(json.error).toBe("API key expired");
  });

  it("returns context when API key is valid and active", async () => {
    mockFindFirst.mockResolvedValue({
      id: "key-id-1",
      name: "Test Partner",
      isActive: true,
      rateLimit: 1000,
      expiresAt: null,
    } as any);

    mockApiKeyUpdate.mockResolvedValue({} as any);

    const req = createRequest({ authorization: "Bearer iran_mem_valid123" });
    const { context, error } = await verifyApiKey(req);

    expect(error).toBeUndefined();
    expect(context).toEqual({
      apiKeyId: "key-id-1",
      name: "Test Partner",
      rateLimit: 1000,
    });

    // Verify lastUsedAt was updated (fire and forget)
    expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-id-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("handles future expiry date correctly", async () => {
    const futureDate = new Date(Date.now() + 86400000); // 1 day from now
    mockFindFirst.mockResolvedValue({
      id: "key-id-1",
      name: "Test Partner",
      isActive: true,
      rateLimit: 2000,
      expiresAt: futureDate,
    } as any);

    mockApiKeyUpdate.mockResolvedValue({} as any);

    const req = createRequest({ authorization: "Bearer iran_mem_valid123" });
    const { context, error } = await verifyApiKey(req);

    expect(error).toBeUndefined();
    expect(context).toEqual({
      apiKeyId: "key-id-1",
      name: "Test Partner",
      rateLimit: 2000,
    });
  });
});

describe("checkApiKeyRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to rateLimit with composite key", async () => {
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 999,
      resetAt: Date.now() + 3600000,
    });

    const result = await checkApiKeyRateLimit("key-123", "/api/v1/victims", 1000);

    expect(mockRateLimit).toHaveBeenCalledWith(
      "api_key:key-123",
      "/api/v1/victims",
      1000,
      3600
    );
    expect(result).toEqual({
      success: true,
      remaining: 999,
      resetAt: expect.any(Number),
    });
  });

  it("returns rate limit exceeded when limit reached", async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 1800000,
    });

    const result = await checkApiKeyRateLimit("key-456", "/api/v1/statistics", 500);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe("logApiUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates usage log with all parameters", () => {
    mockApiUsageCreate.mockResolvedValue({} as any);

    const req = createRequest({
      "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      "user-agent": "Mozilla/5.0 Test Browser",
    });

    logApiUsage("key-789", "/api/v1/events", "GET", 200, req);

    expect(mockPrisma.apiUsage.create).toHaveBeenCalledWith({
      data: {
        apiKeyId: "key-789",
        endpoint: "/api/v1/events",
        method: "GET",
        statusCode: 200,
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0 Test Browser",
      },
    });
  });

  it("handles missing x-forwarded-for header", () => {
    mockApiUsageCreate.mockResolvedValue({} as any);

    const req = createRequest({
      "user-agent": "Test Agent",
    });

    logApiUsage("key-999", "/api/v1/sources", "GET", 200, req);

    expect(mockPrisma.apiUsage.create).toHaveBeenCalledWith({
      data: {
        apiKeyId: "key-999",
        endpoint: "/api/v1/sources",
        method: "GET",
        statusCode: 200,
        ip: undefined,
        userAgent: "Test Agent",
      },
    });
  });

  it("silently handles database errors (fire and forget)", () => {
    mockApiUsageCreate.mockRejectedValue(new Error("DB Error"));

    const req = createRequest();

    // Should not throw
    expect(() => {
      logApiUsage("key-error", "/api/v1/victims", "GET", 500, req);
    }).not.toThrow();
  });
});
