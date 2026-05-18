import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: {
      findMany: vi.fn(),
    },
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { triggerWebhooks, verifyWebhookSignature } from "@/lib/webhooks";
import { prisma } from "@/lib/db";

const mockWebhookFindMany = vi.mocked(prisma.webhook.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
});

const mockWebhook = {
  id: "wh-1",
  url: "https://example.com/webhook",
  secret: "test-secret",
  events: ["victim.created"],
  isActive: true,
  apiKeyId: "key-1",
  createdAt: new Date(),
};

// ─────────────────────────────────────────────────────────────────
// verifyWebhookSignature
// ─────────────────────────────────────────────────────────────────
describe("verifyWebhookSignature", () => {
  it("returns true for a valid signature", () => {
    const { createHmac } = require("crypto");
    const body = JSON.stringify({ event: "victim.created", data: {} });
    const secret = "my-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const body = JSON.stringify({ event: "victim.created", data: {} });
    expect(verifyWebhookSignature(body, "wrong-signature", "my-secret")).toBe(false);
  });

  it("returns false for empty signature", () => {
    const body = "test-body";
    expect(verifyWebhookSignature(body, "", "my-secret")).toBe(false);
  });

  it("returns false for tampered body", () => {
    const { createHmac } = require("crypto");
    const originalBody = JSON.stringify({ event: "victim.created" });
    const secret = "my-secret";
    const signature = createHmac("sha256", secret).update(originalBody).digest("hex");
    const tamperedBody = JSON.stringify({ event: "submission.approved" });
    expect(verifyWebhookSignature(tamperedBody, signature, secret)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const { createHmac } = require("crypto");
    const body = JSON.stringify({ event: "victim.created" });
    const signature = createHmac("sha256", "correct-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature, "wrong-secret")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// triggerWebhooks
// ─────────────────────────────────────────────────────────────────
describe("triggerWebhooks", () => {
  it("does nothing when no active webhooks match", async () => {
    mockWebhookFindMany.mockResolvedValue([]);
    await triggerWebhooks("victim.created", { slug: "test" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends POST request with correct headers for victim.created", async () => {
    mockWebhookFindMany.mockResolvedValue([mockWebhook] as any);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await triggerWebhooks("victim.created", { slug: "mahsa-amini" });

    // Allow async fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toBe("https://example.com/webhook");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-Webhook-Event"]).toBe("victim.created");
    expect(options.headers["X-Webhook-Signature"]).toBeDefined();
    expect(options.headers["User-Agent"]).toBe("iran-memorial-webhooks/1.0");
  });

  it("sends correct payload structure", async () => {
    mockWebhookFindMany.mockResolvedValue([mockWebhook] as any);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const data = { slug: "test-victim", nameLatin: "Test Name" };
    await triggerWebhooks("victim.created", data);
    await new Promise((r) => setTimeout(r, 50));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.event).toBe("victim.created");
    expect(body.timestamp).toBeDefined();
    expect(body.data).toEqual(data);
  });

  it("HMAC signature is verifiable", async () => {
    mockWebhookFindMany.mockResolvedValue([mockWebhook] as any);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await triggerWebhooks("victim.created", { slug: "test" });
    await new Promise((r) => setTimeout(r, 50));

    const [, options] = mockFetch.mock.calls[0];
    const signature = options.headers["X-Webhook-Signature"];
    const isValid = verifyWebhookSignature(options.body, signature, mockWebhook.secret);
    expect(isValid).toBe(true);
  });

  it("sends to multiple webhooks in parallel", async () => {
    const webhook2 = { ...mockWebhook, id: "wh-2", url: "https://partner2.com/hook" };
    mockWebhookFindMany.mockResolvedValue([mockWebhook, webhook2] as any);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await triggerWebhooks("victim.created", { slug: "test" });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map(([url]) => url);
    expect(urls).toContain("https://example.com/webhook");
    expect(urls).toContain("https://partner2.com/hook");
  });

  it("handles fetch failure gracefully without throwing", async () => {
    mockWebhookFindMany.mockResolvedValue([mockWebhook] as any);
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    // Should not throw
    await expect(triggerWebhooks("victim.created", { slug: "test" })).resolves.not.toThrow();
  });

  it("handles HTTP error response gracefully", async () => {
    mockWebhookFindMany.mockResolvedValue([mockWebhook] as any);
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });

    // Should not throw
    await expect(triggerWebhooks("victim.created", { slug: "test" })).resolves.not.toThrow();
  });

  it("queries only active webhooks for the event", async () => {
    mockWebhookFindMany.mockResolvedValue([]);

    await triggerWebhooks("submission.approved", { submissionId: "sub-1" });

    expect(mockWebhookFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        events: { has: "submission.approved" },
      },
    });
  });
});
