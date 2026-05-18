import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateRange,
  formatNumber,
  formatKilledRange,
} from "@/lib/utils";

describe("formatDate", () => {
  it("returns empty string for null input", () => {
    expect(formatDate(null, "en")).toBe("");
  });

  it("formats Date object for English locale", () => {
    const result = formatDate(new Date("2022-09-16"), "en");
    expect(result).toContain("September");
    expect(result).toContain("2022");
  });

  it("formats date string for English locale", () => {
    const result = formatDate("2022-09-16", "en");
    expect(result).toContain("September");
    expect(result).toContain("2022");
  });

  it("formats date for German locale", () => {
    const result = formatDate(new Date("2022-09-16"), "de");
    expect(result).toContain("September");
    expect(result).toContain("2022");
  });

  it("formats date for Farsi locale", () => {
    const result = formatDate(new Date("2022-09-16"), "fa");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles ISO string with time component", () => {
    const result = formatDate("2022-09-16T14:30:00Z", "en");
    expect(result).toContain("2022");
  });
});

describe("formatDateRange", () => {
  it("returns empty string when both null", () => {
    expect(formatDateRange(null, null, "en")).toBe("");
  });

  it("returns only start date when end is null", () => {
    const result = formatDateRange("2022-09-16", null, "en");
    expect(result).toContain("2022");
    expect(result).not.toContain("–");
  });

  it("returns range with en-dash when both present", () => {
    const result = formatDateRange("2022-09-16", "2023-03-01", "en");
    expect(result).toContain("–");
    expect(result).toContain("2022");
    expect(result).toContain("2023");
  });

  it("returns empty string when start is null", () => {
    expect(formatDateRange(null, "2022-09-16", "en")).toBe("");
  });
});

describe("formatNumber", () => {
  it("returns empty string for null", () => {
    expect(formatNumber(null, "en")).toBe("");
  });

  it("formats number with English locale", () => {
    expect(formatNumber(31203, "en")).toBe("31,203");
  });

  it("formats number with German locale", () => {
    expect(formatNumber(31203, "de")).toBe("31.203");
  });

  it("formats number with Farsi locale", () => {
    const result = formatNumber(31203, "fa");
    expect(result).toBeTruthy();
    expect(result).not.toBe("31,203");
  });

  it("formats zero correctly", () => {
    expect(formatNumber(0, "en")).toBe("0");
  });

  it("formats small number without separator", () => {
    expect(formatNumber(42, "en")).toBe("42");
  });
});

describe("formatKilledRange", () => {
  it("returns empty string when both null", () => {
    expect(formatKilledRange(null, null, "en")).toBe("");
  });

  it("returns empty string when both undefined", () => {
    expect(formatKilledRange(undefined, undefined, "en")).toBe("");
  });

  it("prefers high estimate when both provided", () => {
    expect(formatKilledRange(1500, 3000, "en")).toBe("3,000");
  });

  it("falls back to low estimate when high is null", () => {
    expect(formatKilledRange(1500, null, "en")).toBe("1,500");
  });

  it("returns high even when low is null", () => {
    expect(formatKilledRange(null, 3000, "en")).toBe("3,000");
  });

  it("returns empty for zero values (falsy)", () => {
    expect(formatKilledRange(0, 0, "en")).toBe("");
  });

  it("formats with correct locale", () => {
    expect(formatKilledRange(null, 3000, "de")).toBe("3.000");
  });
});
