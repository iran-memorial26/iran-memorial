import { describe, it, expect } from "vitest";
import { xmlEscape, buildDescription, itemTitle, itemUrl, type FeedItem } from "@/lib/feed";
import { SITE_URL } from "@/lib/site-url";

describe("feed helpers", () => {
  describe("xmlEscape", () => {
    it("escapes the five XML metacharacters", () => {
      expect(xmlEscape(`<a href="x">&'</a>`)).toBe(
        "&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;",
      );
    });
    it("is idempotent on safe strings", () => {
      expect(xmlEscape("Mahsa Amini — 1999-2022")).toBe("Mahsa Amini — 1999-2022");
    });
  });

  describe("itemUrl", () => {
    it("returns canonical English URL", () => {
      expect(itemUrl("mahsa-amini")).toBe(`${SITE_URL}/en/victims/mahsa-amini`);
    });
  });

  describe("itemTitle", () => {
    it("appends Farsi name when present", () => {
      const item = { nameLatin: "Mahsa Amini", nameFarsi: "مهسا امینی" } as FeedItem;
      expect(itemTitle(item)).toBe("Mahsa Amini — مهسا امینی");
    });
    it("falls back to Latin name only", () => {
      const item = { nameLatin: "Mahsa Amini", nameFarsi: null } as FeedItem;
      expect(itemTitle(item)).toBe("Mahsa Amini");
    });
  });

  describe("buildDescription", () => {
    it("includes verified status and meta line", () => {
      const item = {
        slug: "x",
        nameLatin: "Test",
        nameFarsi: null,
        dateOfDeath: new Date("2022-09-16T00:00:00Z"),
        placeOfDeath: "Tehran",
        causeOfDeath: "Beating in custody",
        circumstancesEn: "Held by Guidance Patrol.",
        photoUrl: null,
        verificationStatus: "verified",
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies FeedItem;
      const desc = buildDescription(item);
      expect(desc).toContain("2022-09-16");
      expect(desc).toContain("Tehran");
      expect(desc).toContain("Beating in custody");
      expect(desc).toContain("Verified");
      expect(desc).toContain("Held by Guidance Patrol.");
    });
    it("falls back to a name-only line when nothing else known", () => {
      const item = {
        slug: "x",
        nameLatin: "Unknown",
        nameFarsi: null,
        dateOfDeath: null,
        placeOfDeath: null,
        causeOfDeath: null,
        circumstancesEn: null,
        photoUrl: null,
        verificationStatus: "unverified",
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies FeedItem;
      expect(buildDescription(item)).toBe("Memorial entry for Unknown");
    });
  });
});
