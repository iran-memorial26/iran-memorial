import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request and returns correct remaining count", async () => {
    const result = await rateLimit("1.2.3.4", "test-first", 5, 60);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on subsequent requests", async () => {
    const ip = "10.0.0.1";
    const ep = "test-dec";
    await rateLimit(ip, ep, 5, 60);
    const r2 = await rateLimit(ip, ep, 5, 60);
    expect(r2.remaining).toBe(3);
    const r3 = await rateLimit(ip, ep, 5, 60);
    expect(r3.remaining).toBe(2);
  });

  it("blocks request when limit is exceeded", async () => {
    const ip = "10.0.0.2";
    const ep = "test-block";
    await rateLimit(ip, ep, 3, 60);
    await rateLimit(ip, ep, 3, 60);
    await rateLimit(ip, ep, 3, 60);
    const result = await rateLimit(ip, ep, 3, 60);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const ip = "10.0.0.3";
    const ep = "test-reset";
    await rateLimit(ip, ep, 2, 60);
    await rateLimit(ip, ep, 2, 60);
    const blocked = await rateLimit(ip, ep, 2, 60);
    expect(blocked.success).toBe(false);

    vi.advanceTimersByTime(61 * 1000);

    const result = await rateLimit(ip, ep, 2, 60);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("tracks different IPs independently", async () => {
    const ep = "test-ips";
    await rateLimit("a.a.a.a", ep, 1, 60);
    const blocked = await rateLimit("a.a.a.a", ep, 1, 60);
    expect(blocked.success).toBe(false);

    const result = await rateLimit("b.b.b.b", ep, 1, 60);
    expect(result.success).toBe(true);
  });

  it("tracks different endpoints independently", async () => {
    const ip = "10.0.0.4";
    await rateLimit(ip, "ep-a", 1, 60);
    const blocked = await rateLimit(ip, "ep-a", 1, 60);
    expect(blocked.success).toBe(false);

    const result = await rateLimit(ip, "ep-b", 1, 60);
    expect(result.success).toBe(true);
  });

  it("returns correct resetAt timestamp", async () => {
    const now = Date.now();
    const result = await rateLimit("10.0.0.5", "test-time", 10, 120);
    expect(result.resetAt).toBe(now + 120 * 1000);
  });

  it("handles single-request limit", async () => {
    const r1 = await rateLimit("10.0.0.6", "test-single", 1, 60);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(0);

    const r2 = await rateLimit("10.0.0.6", "test-single", 1, 60);
    expect(r2.success).toBe(false);
  });
});
