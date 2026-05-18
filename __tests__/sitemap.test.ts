import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the sitemap module
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findMany: vi.fn().mockResolvedValue([]) },
    victim: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import sitemap from "@/app/sitemap";
import { prisma } from "@/lib/db";

describe("sitemap defensive id handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] for non-integer ids without hitting Prisma", async () => {
    const result = await sitemap({ id: NaN as unknown as number });
    expect(result).toEqual([]);
    expect(prisma.victim.findMany).not.toHaveBeenCalled();
  });

  it("returns [] for negative ids without hitting Prisma", async () => {
    const result = await sitemap({ id: -1 });
    expect(result).toEqual([]);
    expect(prisma.victim.findMany).not.toHaveBeenCalled();
  });

  it("returns [] for the literal route placeholder string", async () => {
    // Next.js metadata routes can pass `__metadata_id__` during prerender
    const result = await sitemap({ id: "__metadata_id__" as unknown as number });
    expect(result).toEqual([]);
    expect(prisma.victim.findMany).not.toHaveBeenCalled();
  });

  it("coerces string '0' to numeric 0 (events shard)", async () => {
    await sitemap({ id: "0" as unknown as number });
    // String '0' must hit the events branch, not the victim branch
    expect(prisma.event.findMany).toHaveBeenCalledOnce();
    expect(prisma.victim.findMany).not.toHaveBeenCalled();
  });

  it("coerces string '1' to numeric 1 (victim shard 0)", async () => {
    await sitemap({ id: "1" as unknown as number });
    expect(prisma.victim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it("computes correct skip for shard 2 (40000 victims)", async () => {
    await sitemap({ id: 2 });
    expect(prisma.victim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40000, take: 40000 }),
    );
  });
});
