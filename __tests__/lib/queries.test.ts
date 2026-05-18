import { describe, it, expect, vi } from "vitest";

// Mock Prisma client before importing queries
vi.mock("@/lib/db", () => ({
  prisma: {},
}));

import { localized, mapRawVictims } from "@/lib/queries";
import { mockVictimRow } from "../helpers/fixtures";

describe("localized()", () => {
  const item = {
    circumstancesEn: "Shot during protests",
    circumstancesFa: "در اعتراضات تیراندازی شد",
    circumstancesDe: null,
    occupationEn: "Student",
    occupationFa: null,
    occupationDe: null,
    dreamsEn: null,
    dreamsFa: null,
    dreamsDe: null,
  };

  it("returns Farsi field when locale is fa and field exists", () => {
    expect(localized(item, "circumstances", "fa")).toBe(
      "در اعتراضات تیراندازی شد"
    );
  });

  it("falls back to English when Farsi field is null", () => {
    expect(localized(item, "occupation", "fa")).toBe("Student");
  });

  it("returns English field for en locale", () => {
    expect(localized(item, "circumstances", "en")).toBe(
      "Shot during protests"
    );
  });

  it("falls back to English when German field is null", () => {
    expect(localized(item, "circumstances", "de")).toBe(
      "Shot during protests"
    );
  });

  it("returns null when both localized and English are null", () => {
    expect(localized(item, "dreams", "fa")).toBeNull();
  });

  it("returns null when all locale variants are null", () => {
    expect(localized(item, "dreams", "de")).toBeNull();
  });

  it("returns English value directly when locale is en", () => {
    expect(localized(item, "occupation", "en")).toBe("Student");
  });
});

describe("mapRawVictims()", () => {
  it("maps snake_case row to camelCase object", () => {
    const result = mapRawVictims([mockVictimRow]);
    expect(result).toHaveLength(1);
    expect(result[0].nameLatin).toBe("Mahsa Amini");
    expect(result[0].nameFarsi).toBe("مهسا امینی");
    expect(result[0].dateOfDeath).toEqual(mockVictimRow.date_of_death);
    expect(result[0].placeOfDeath).toBe("Tehran");
    expect(result[0].causeOfDeath).toBe("Head injuries");
    expect(result[0].cityNameEn).toBe("Tehran");
    expect(result[0].cityNameFa).toBe("تهران");
    expect(result[0].provinceSlug).toBe("tehran");
  });

  it("handles empty array", () => {
    expect(mapRawVictims([])).toEqual([]);
  });

  it("handles rows with null values", () => {
    const row = { ...mockVictimRow, name_farsi: null, photo_url: null };
    const result = mapRawVictims([row]);
    expect(result[0].nameFarsi).toBeNull();
    expect(result[0].photoUrl).toBeNull();
  });

  it("maps multiple rows", () => {
    const rows = [mockVictimRow, { ...mockVictimRow, slug: "victim-2" }];
    const result = mapRawVictims(rows);
    expect(result).toHaveLength(2);
    expect(result[1].slug).toBe("victim-2");
  });

  it("maps all identity fields correctly", () => {
    const result = mapRawVictims([mockVictimRow])[0];
    expect(result.slug).toBe("amini-mahsa-2000");
    expect(result.gender).toBe("female");
    expect(result.ethnicity).toBe("Kurdish");
    expect(result.photoUrl).toBe(
      "https://storage.googleapis.com/photo.jpg"
    );
  });
});
