import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { GET } from "@/app/api/export/route";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockRateLimit = vi.mocked(rateLimit);

function createRequest(
  searchParams: Record<string, string> = {},
  headers?: Record<string, string>
) {
  const url = new URL("http://localhost:3000/api/export");
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url, {
    headers: new Headers(headers || {}),
  });
}

const mockVictimRow = {
  slug: "amini-mahsa",
  name_latin: "Mahsa Amini",
  name_farsi: "\u0645\u0647\u0633\u0627 \u0627\u0645\u06CC\u0646\u06CC",
  aliases: ["Jina Amini"],
  date_of_birth: new Date("2000-07-21"),
  place_of_birth: "Saqqez",
  gender: "female",
  ethnicity: "Kurdish",
  religion: null,
  photo_url: "https://example.com/photo.jpg",
  occupation_en: "Student",
  occupation_fa: "\u062F\u0627\u0646\u0634\u062C\u0648",
  education: "University",
  date_of_death: new Date("2022-09-16"),
  age_at_death: 22,
  place_of_death: "Tehran",
  province: "Tehran",
  cause_of_death: "Head injuries",
  circumstances_en: "Died after arrest by morality police",
  circumstances_fa: "\u067E\u0633 \u0627\u0632 \u0628\u0627\u0632\u062F\u0627\u0634\u062A \u062A\u0648\u0633\u0637 \u06AF\u0634\u062A \u0627\u0631\u0634\u0627\u062F",
  event_context: "Mahsa Amini Protests",
  responsible_forces: "Morality Police",
  burial_location: "Saqqez Cemetery",
  verification_status: "verified",
  data_source: "iranvictims",
};

const mockVictimRowNulls = {
  slug: "unknown-victim",
  name_latin: "Unknown Victim",
  name_farsi: null,
  aliases: null,
  date_of_birth: null,
  place_of_birth: null,
  gender: null,
  ethnicity: null,
  religion: null,
  photo_url: null,
  occupation_en: null,
  occupation_fa: null,
  education: null,
  date_of_death: null,
  age_at_death: null,
  place_of_death: null,
  province: null,
  cause_of_death: null,
  circumstances_en: null,
  circumstances_fa: null,
  event_context: null,
  responsible_forces: null,
  burial_location: null,
  verification_status: null,
  data_source: null,
};

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      resetAt: Date.now() + 3600000,
    });
    mockQueryRaw.mockResolvedValue([mockVictimRow]);
  });

  describe("Rate Limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 3600000,
      });

      const res = await GET(createRequest());
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error).toContain("Too many requests");
      expect(res.headers.get("Retry-After")).toBe("3600");
    });

    it("extracts IP from x-forwarded-for header", async () => {
      await GET(
        createRequest({}, { "x-forwarded-for": "1.2.3.4, 5.6.7.8" })
      );
      expect(mockRateLimit).toHaveBeenCalledWith("5.6.7.8", "export", 10, 3600);
    });

    it("uses 'unknown' when no IP header present", async () => {
      await GET(createRequest());
      expect(mockRateLimit).toHaveBeenCalledWith(
        "unknown",
        "export",
        10,
        3600
      );
    });
  });

  describe("Format Validation", () => {
    it("returns 400 for invalid format", async () => {
      const res = await GET(createRequest({ format: "xml" }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invalid format");
    });

    it("defaults to json when no format specified", async () => {
      const res = await GET(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("meta");
      expect(json).toHaveProperty("victims");
    });

    it("accepts format=json explicitly", async () => {
      const res = await GET(createRequest({ format: "json" }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("victims");
    });

    it("accepts format=csv", async () => {
      const res = await GET(createRequest({ format: "csv" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
    });
  });

  describe("JSON Export", () => {
    it("returns meta object with total, exported_at, source, and license", async () => {
      const res = await GET(createRequest({ format: "json" }));
      const json = await res.json();

      expect(json.meta.total).toBe(1);
      expect(json.meta.exported_at).toBeTruthy();
      expect(json.meta.source).toContain("Iran Memorial");
      expect(json.meta.license).toBe("CC BY-SA 4.0");
    });

    it("returns Content-Disposition header with .json filename", async () => {
      const res = await GET(createRequest({ format: "json" }));
      const disposition = res.headers.get("Content-Disposition");
      expect(disposition).toContain("attachment");
      expect(disposition).toContain("iran-memorial-export-");
      expect(disposition).toContain(".json");
    });

    it("maps victim fields correctly", async () => {
      const res = await GET(createRequest({ format: "json" }));
      const json = await res.json();

      const victim = json.victims[0];
      expect(victim.slug).toBe("amini-mahsa");
      expect(victim.name_latin).toBe("Mahsa Amini");
      expect(victim.gender).toBe("female");
      expect(victim.cause_of_death).toBe("Head injuries");
      expect(victim.verification_status).toBe("verified");
      expect(victim.data_source).toBe("iranvictims");
    });

    it("formats dates as YYYY-MM-DD strings", async () => {
      const res = await GET(createRequest({ format: "json" }));
      const json = await res.json();

      const victim = json.victims[0];
      expect(victim.date_of_birth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(victim.date_of_death).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("joins aliases with semicolon separator", async () => {
      mockQueryRaw.mockResolvedValue([
        { ...mockVictimRow, aliases: ["Jina Amini", "Zhina"] },
      ]);

      const res = await GET(createRequest({ format: "json" }));
      const json = await res.json();

      expect(json.victims[0].aliases).toBe("Jina Amini; Zhina");
    });

    it("converts age_at_death to string", async () => {
      const res = await GET(createRequest({ format: "json" }));
      const json = await res.json();

      expect(json.victims[0].age_at_death).toBe("22");
    });

    it("handles null fields as empty strings", async () => {
      mockQueryRaw.mockResolvedValue([mockVictimRowNulls]);

      const res = await GET(createRequest({ format: "json" }));
      const json = await res.json();

      const victim = json.victims[0];
      expect(victim.name_farsi).toBe("");
      expect(victim.aliases).toBe("");
      expect(victim.date_of_birth).toBe("");
      expect(victim.date_of_death).toBe("");
      expect(victim.age_at_death).toBe("");
      expect(victim.gender).toBe("");
      expect(victim.province).toBe("");
      expect(victim.photo_url).toBe("");
    });

    it("returns multiple victims", async () => {
      mockQueryRaw.mockResolvedValue([mockVictimRow, mockVictimRowNulls]);

      const res = await GET(createRequest({ format: "json" }));
      const json = await res.json();

      expect(json.meta.total).toBe(2);
      expect(json.victims).toHaveLength(2);
    });
  });

  describe("CSV Export", () => {
    it("returns Content-Type text/csv", async () => {
      const res = await GET(createRequest({ format: "csv" }));
      expect(res.headers.get("Content-Type")).toContain("text/csv");
    });

    it("returns Content-Disposition header with .csv filename", async () => {
      const res = await GET(createRequest({ format: "csv" }));
      const disposition = res.headers.get("Content-Disposition");
      expect(disposition).toContain("attachment");
      expect(disposition).toContain("iran-memorial-export-");
      expect(disposition).toContain(".csv");
    });

    it("includes header row with all field names", async () => {
      const res = await GET(createRequest({ format: "csv" }));
      const text = await res.text();
      const headerLine = text.split("\n")[0];

      expect(headerLine).toContain("slug");
      expect(headerLine).toContain("name_latin");
      expect(headerLine).toContain("name_farsi");
      expect(headerLine).toContain("date_of_death");
      expect(headerLine).toContain("cause_of_death");
      expect(headerLine).toContain("verification_status");
    });

    it("includes data rows after header", async () => {
      const res = await GET(createRequest({ format: "csv" }));
      const text = await res.text();
      const lines = text.split("\n");

      expect(lines.length).toBeGreaterThan(1);
      expect(lines[1]).toContain("amini-mahsa");
      expect(lines[1]).toContain("Mahsa Amini");
    });

    it("escapes CSV values containing commas", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          ...mockVictimRow,
          circumstances_en: "Shot, beaten, and killed",
        },
      ]);

      const res = await GET(createRequest({ format: "csv" }));
      const text = await res.text();

      // Value with comma should be quoted
      expect(text).toContain('"Shot, beaten, and killed"');
    });

    it("escapes CSV values containing double quotes", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          ...mockVictimRow,
          circumstances_en: 'Known as "The Brave"',
        },
      ]);

      const res = await GET(createRequest({ format: "csv" }));
      const text = await res.text();

      // Quotes inside should be doubled
      expect(text).toContain('""The Brave""');
    });

    it("escapes CSV values containing newlines", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          ...mockVictimRow,
          circumstances_en: "Line one\nLine two",
        },
      ]);

      const res = await GET(createRequest({ format: "csv" }));
      const text = await res.text();

      // Value with newline should be quoted
      expect(text).toContain('"Line one\nLine two"');
    });

    it("handles empty result set in CSV", async () => {
      mockQueryRaw.mockResolvedValue([]);

      const res = await GET(createRequest({ format: "csv" }));
      const text = await res.text();

      // Only header row (or empty if no fields detected)
      // With empty mapped array, headers will be empty
      expect(res.status).toBe(200);
      expect(text).toBeDefined();
    });
  });

  describe("Database Query", () => {
    it("calls $queryRaw to fetch victim data", async () => {
      await GET(createRequest());
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      const query = mockQueryRaw.mock.calls[0][0] as { strings: string[] };
      const fullQuery = query.strings.join("");
      expect(fullQuery).toContain("SELECT");
      expect(fullQuery).toContain("FROM victims");
      expect(fullQuery).toContain("ORDER BY");
    });
  });
});
