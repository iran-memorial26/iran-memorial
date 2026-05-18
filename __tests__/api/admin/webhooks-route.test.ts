import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET, POST, PATCH, DELETE } from "@/app/api/admin/webhooks/route";
import { prisma } from "@/lib/db";

const mockWebhookFindMany = vi.mocked(prisma.webhook.findMany);
const mockWebhookCreate = vi.mocked(prisma.webhook.create);
const mockWebhookUpdate = vi.mocked(prisma.webhook.update);
const mockWebhookDelete = vi.mocked(prisma.webhook.delete);
const mockApiKeyFindUnique = vi.mocked(prisma.apiKey.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
});

function createRequest(
  method: string,
  searchParams?: Record<string, string>,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
) {
  const url = new URL("/api/admin/webhooks", "http://localhost:3000");
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url, {
    method,
    headers: new Headers({ "x-forwarded-user": "admin", ...headers }),
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockWebhook = {
  id: "wh-1",
  apiKeyId: "key-1",
  url: "https://example.com/webhook",
  events: ["victim.created"],
  isActive: true,
  secret: "test-secret",
  createdAt: new Date(),
  apiKey: { name: "Test Partner" },
};

const mockApiKey = {
  id: "key-1",
  name: "Test Partner",
  isActive: true,
};

// ─────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────
describe("Authentication", () => {
  it("GET: returns 401 without admin header", async () => {
    const req = createRequest("GET", {}, undefined, { "x-forwarded-user": "" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("POST: returns 401 for non-admin user", async () => {
    const req = createRequest("POST", {}, { apiKeyId: "key-1", url: "https://x.com", events: ["victim.created"] }, { "x-forwarded-user": "user" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("PATCH: returns 401 without admin header", async () => {
    const req = createRequest("PATCH", {}, { id: "wh-1" }, { "x-forwarded-user": "" });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("DELETE: returns 401 without admin header", async () => {
    const req = createRequest("DELETE", {}, undefined, { "x-forwarded-user": "" });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/webhooks
// ─────────────────────────────────────────────────────────────────
describe("GET /api/admin/webhooks", () => {
  it("returns all webhooks", async () => {
    mockWebhookFindMany.mockResolvedValue([mockWebhook] as any);
    const req = createRequest("GET");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.webhooks).toHaveLength(1);
    expect(body.webhooks[0].id).toBe("wh-1");
    expect(body.webhooks[0].apiKey.name).toBe("Test Partner");
  });

  it("filters webhooks by apiKeyId", async () => {
    mockWebhookFindMany.mockResolvedValue([mockWebhook] as any);
    const req = createRequest("GET", { apiKeyId: "key-1" });
    await GET(req);

    expect(mockWebhookFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { apiKeyId: "key-1" },
      })
    );
  });

  it("returns empty array when no webhooks", async () => {
    mockWebhookFindMany.mockResolvedValue([]);
    const req = createRequest("GET");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.webhooks).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/webhooks
// ─────────────────────────────────────────────────────────────────
describe("POST /api/admin/webhooks", () => {
  it("creates webhook with valid input", async () => {
    mockApiKeyFindUnique.mockResolvedValue(mockApiKey as any);
    mockWebhookCreate.mockResolvedValue(mockWebhook as any);

    const req = createRequest("POST", {}, {
      apiKeyId: "key-1",
      url: "https://example.com/webhook",
      events: ["victim.created"],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.webhook.id).toBe("wh-1");
  });

  it("returns 400 for missing apiKeyId", async () => {
    const req = createRequest("POST", {}, {
      url: "https://example.com/webhook",
      events: ["victim.created"],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid URL (no http)", async () => {
    mockApiKeyFindUnique.mockResolvedValue(mockApiKey as any);
    const req = createRequest("POST", {}, {
      apiKeyId: "key-1",
      url: "not-a-url",
      events: ["victim.created"],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty events array", async () => {
    mockApiKeyFindUnique.mockResolvedValue(mockApiKey as any);
    const req = createRequest("POST", {}, {
      apiKeyId: "key-1",
      url: "https://example.com/webhook",
      events: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid event names", async () => {
    mockApiKeyFindUnique.mockResolvedValue(mockApiKey as any);
    const req = createRequest("POST", {}, {
      apiKeyId: "key-1",
      url: "https://example.com/webhook",
      events: ["invalid.event"],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid events");
  });

  it("returns 404 when API key not found", async () => {
    mockApiKeyFindUnique.mockResolvedValue(null);
    const req = createRequest("POST", {}, {
      apiKeyId: "nonexistent-key",
      url: "https://example.com/webhook",
      events: ["victim.created"],
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("accepts both valid event types", async () => {
    mockApiKeyFindUnique.mockResolvedValue(mockApiKey as any);
    mockWebhookCreate.mockResolvedValue({
      ...mockWebhook,
      events: ["victim.created", "submission.approved"],
    } as any);

    const req = createRequest("POST", {}, {
      apiKeyId: "key-1",
      url: "https://example.com/webhook",
      events: ["victim.created", "submission.approved"],
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/admin/webhooks
// ─────────────────────────────────────────────────────────────────
describe("PATCH /api/admin/webhooks", () => {
  it("deactivates a webhook", async () => {
    mockWebhookUpdate.mockResolvedValue({ ...mockWebhook, isActive: false } as any);
    const req = createRequest("PATCH", {}, { id: "wh-1", isActive: false });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockWebhookUpdate).toHaveBeenCalledWith({
      where: { id: "wh-1" },
      data: { isActive: false },
      select: expect.anything(),
    });
  });

  it("reactivates a webhook", async () => {
    mockWebhookUpdate.mockResolvedValue({ ...mockWebhook, isActive: true } as any);
    const req = createRequest("PATCH", {}, { id: "wh-1", isActive: true });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing id", async () => {
    const req = createRequest("PATCH", {}, { isActive: false });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/webhooks
// ─────────────────────────────────────────────────────────────────
describe("DELETE /api/admin/webhooks", () => {
  it("deletes a webhook", async () => {
    mockWebhookDelete.mockResolvedValue(mockWebhook as any);
    const req = createRequest("DELETE", { id: "wh-1" });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockWebhookDelete).toHaveBeenCalledWith({ where: { id: "wh-1" } });
  });

  it("returns 400 when id is missing", async () => {
    const req = createRequest("DELETE");
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
