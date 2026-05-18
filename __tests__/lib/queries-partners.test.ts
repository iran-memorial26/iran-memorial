import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPartnerStatistics } from "@/lib/queries";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";

const mockQueryRaw = vi.mocked(prisma.$queryRaw);

describe("getPartnerStatistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("All Partners (no apiKeyId)", () => {
    it("returns statistics for all API keys", async () => {
      // Mock Query 1: Totals
      const totals = [
        { api_key_id: "key-1", name: "Partner A", total: 1500, last_used: new Date("2024-01-15") },
        { api_key_id: "key-2", name: "Partner B", total: 800, last_used: new Date("2024-01-10") },
      ];

      // Mock Query 2: Last 7 days
      const last7Days = [
        { api_key_id: "key-1", count: 50 },
        { api_key_id: "key-2", count: 30 },
      ];

      // Mock Query 3: Last 30 days
      const last30Days = [
        { api_key_id: "key-1", count: 200 },
        { api_key_id: "key-2", count: 150 },
      ];

      // Mock Query 4: Endpoints
      const endpoints = [
        { api_key_id: "key-1", endpoint: "/api/v1/victims", count: 800 },
        { api_key_id: "key-1", endpoint: "/api/v1/statistics", count: 700 },
        { api_key_id: "key-2", endpoint: "/api/v1/victims", count: 500 },
      ];

      // Mock Query 5: Daily usage
      const dailyUsage = [
        { api_key_id: "key-1", date: "2024-01-01", count: 10 },
        { api_key_id: "key-1", date: "2024-01-02", count: 15 },
        { api_key_id: "key-2", date: "2024-01-01", count: 8 },
      ];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce(last7Days)
        .mockResolvedValueOnce(last30Days)
        .mockResolvedValueOnce(endpoints)
        .mockResolvedValueOnce(dailyUsage);

      const result = await getPartnerStatistics();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        apiKeyId: "key-1",
        name: "Partner A",
        totalRequests: 1500,
        requestsLast7Days: 50,
        requestsLast30Days: 200,
        lastUsedAt: new Date("2024-01-15"),
        endpoints: [
          { endpoint: "/api/v1/victims", count: 800 },
          { endpoint: "/api/v1/statistics", count: 700 },
        ],
        dailyUsage: [
          { date: "2024-01-01", count: 10 },
          { date: "2024-01-02", count: 15 },
        ],
      });
    });

    it("handles API keys with no usage data", async () => {
      // API key exists but no usage
      const totals = [{ api_key_id: "key-1", name: "Inactive Partner", total: 0, last_used: null }];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce([]) // last7Days
        .mockResolvedValueOnce([]) // last30Days
        .mockResolvedValueOnce([]) // endpoints
        .mockResolvedValueOnce([]); // dailyUsage

      const result = await getPartnerStatistics();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        apiKeyId: "key-1",
        name: "Inactive Partner",
        totalRequests: 0,
        requestsLast7Days: 0,
        requestsLast30Days: 0,
        lastUsedAt: null,
        endpoints: [],
        dailyUsage: [],
      });
    });

    it("returns empty array when no API keys exist", async () => {
      mockQueryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics();

      expect(result).toEqual([]);
    });

    it("matches usage data correctly by api_key_id", async () => {
      const totals = [
        { api_key_id: "key-1", name: "Partner A", total: 100, last_used: new Date() },
        { api_key_id: "key-2", name: "Partner B", total: 50, last_used: new Date() },
        { api_key_id: "key-3", name: "Partner C", total: 75, last_used: new Date() },
      ];

      // Only key-1 and key-3 have recent usage
      const last7Days = [
        { api_key_id: "key-1", count: 10 },
        { api_key_id: "key-3", count: 5 },
      ];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce(last7Days)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics();

      expect(result[0].requestsLast7Days).toBe(10); // key-1
      expect(result[1].requestsLast7Days).toBe(0); // key-2 (no match)
      expect(result[2].requestsLast7Days).toBe(5); // key-3
    });
  });

  describe("Single Partner (with apiKeyId)", () => {
    it("returns statistics for specific API key only", async () => {
      const totals = [
        { api_key_id: "key-specific", name: "Specific Partner", total: 500, last_used: new Date() },
      ];

      const last7Days = [{ api_key_id: "key-specific", count: 25 }];
      const last30Days = [{ api_key_id: "key-specific", count: 100 }];
      const endpoints = [{ api_key_id: "key-specific", endpoint: "/api/v1/events", count: 300 }];
      const dailyUsage = [{ api_key_id: "key-specific", date: "2024-01-01", count: 20 }];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce(last7Days)
        .mockResolvedValueOnce(last30Days)
        .mockResolvedValueOnce(endpoints)
        .mockResolvedValueOnce(dailyUsage);

      const result = await getPartnerStatistics("key-specific");

      expect(result).toHaveLength(1);
      expect(result[0].apiKeyId).toBe("key-specific");
      expect(result[0].totalRequests).toBe(500);
    });

    it("returns empty array for non-existent API key", async () => {
      mockQueryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics("non-existent-key");

      expect(result).toEqual([]);
    });
  });

  describe("Data Aggregation", () => {
    it("combines multiple endpoints for same API key", async () => {
      const totals = [{ api_key_id: "key-1", name: "Multi-Endpoint Partner", total: 1000, last_used: new Date() }];

      const endpoints = [
        { api_key_id: "key-1", endpoint: "/api/v1/victims", count: 400 },
        { api_key_id: "key-1", endpoint: "/api/v1/statistics", count: 300 },
        { api_key_id: "key-1", endpoint: "/api/v1/events", count: 200 },
        { api_key_id: "key-1", endpoint: "/api/v1/sources", count: 100 },
      ];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(endpoints)
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics();

      expect(result[0].endpoints).toHaveLength(4);
      expect(result[0].endpoints).toEqual([
        { api_key_id: "key-1", endpoint: "/api/v1/victims", count: 400 },
        { api_key_id: "key-1", endpoint: "/api/v1/statistics", count: 300 },
        { api_key_id: "key-1", endpoint: "/api/v1/events", count: 200 },
        { api_key_id: "key-1", endpoint: "/api/v1/sources", count: 100 },
      ]);
    });

    it("formats daily usage correctly", async () => {
      const totals = [{ api_key_id: "key-1", name: "Daily User", total: 100, last_used: new Date() }];

      const dailyUsage = [
        { api_key_id: "key-1", date: "2024-01-15", count: 10 },
        { api_key_id: "key-1", date: "2024-01-16", count: 15 },
        { api_key_id: "key-1", date: "2024-01-17", count: 20 },
      ];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(dailyUsage);

      const result = await getPartnerStatistics();

      expect(result[0].dailyUsage).toEqual([
        { date: "2024-01-15", count: 10 },
        { date: "2024-01-16", count: 15 },
        { date: "2024-01-17", count: 20 },
      ]);
    });

    it("filters out usage data for other API keys", async () => {
      const totals = [{ api_key_id: "key-1", name: "Partner A", total: 100, last_used: new Date() }];

      // Daily usage includes data for other keys (should be filtered out)
      const dailyUsage = [
        { api_key_id: "key-1", date: "2024-01-01", count: 10 },
        { api_key_id: "key-2", date: "2024-01-01", count: 20 }, // Different key
        { api_key_id: "key-1", date: "2024-01-02", count: 15 },
      ];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(dailyUsage);

      const result = await getPartnerStatistics();

      expect(result[0].dailyUsage).toHaveLength(2);
      expect(result[0].dailyUsage).toEqual([
        { date: "2024-01-01", count: 10 },
        { date: "2024-01-02", count: 15 },
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("handles null last_used date", async () => {
      const totals = [{ api_key_id: "key-1", name: "Never Used", total: 0, last_used: null }];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics();

      expect(result[0].lastUsedAt).toBeNull();
    });

    it("handles missing data in time ranges", async () => {
      const totals = [{ api_key_id: "key-1", name: "Old Usage Only", total: 5000, last_used: new Date("2023-01-01") }];

      // Total is 5000, but no recent usage
      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce([]) // last7Days = 0
        .mockResolvedValueOnce([]) // last30Days = 0
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics();

      expect(result[0].totalRequests).toBe(5000);
      expect(result[0].requestsLast7Days).toBe(0);
      expect(result[0].requestsLast30Days).toBe(0);
    });

    it("maintains ordering by total DESC from query", async () => {
      const totals = [
        { api_key_id: "key-1", name: "High Volume", total: 5000, last_used: new Date() },
        { api_key_id: "key-2", name: "Medium Volume", total: 2000, last_used: new Date() },
        { api_key_id: "key-3", name: "Low Volume", total: 500, last_used: new Date() },
      ];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics();

      expect(result[0].name).toBe("High Volume");
      expect(result[1].name).toBe("Medium Volume");
      expect(result[2].name).toBe("Low Volume");
    });

    it("handles extremely large counts", async () => {
      const totals = [{ api_key_id: "key-1", name: "Heavy User", total: 1000000, last_used: new Date() }];

      const last7Days = [{ api_key_id: "key-1", count: 50000 }];
      const last30Days = [{ api_key_id: "key-1", count: 200000 }];

      mockQueryRaw
        .mockResolvedValueOnce(totals)
        .mockResolvedValueOnce(last7Days)
        .mockResolvedValueOnce(last30Days)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPartnerStatistics();

      expect(result[0].totalRequests).toBe(1000000);
      expect(result[0].requestsLast7Days).toBe(50000);
      expect(result[0].requestsLast30Days).toBe(200000);
    });
  });
});
