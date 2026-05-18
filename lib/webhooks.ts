import { prisma } from "./db";
import { createHmac, timingSafeEqual } from "crypto";
import { isBlockedUrl } from "./webhook-url-guard";

type WebhookEvent = "victim.created" | "submission.approved";

type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  data: any;
};

/**
 * Trigger webhooks for a specific event
 * @param event - Event type (e.g., "victim.created")
 * @param data - Payload data to send to webhook endpoints
 */
export async function triggerWebhooks(event: WebhookEvent, data: any): Promise<void> {
  try {
    // Find all active webhooks that subscribe to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    if (webhooks.length === 0) {
      console.log(`[Webhooks] No active webhooks for event: ${event}`);
      return;
    }

    console.log(`[Webhooks] Triggering ${webhooks.length} webhooks for event: ${event}`);

    // Send webhooks in parallel (fire and forget)
    const promises = webhooks.map((webhook) => sendWebhook(webhook, event, data));

    // Don't await - webhooks should not block the main request
    Promise.allSettled(promises).then((results) => {
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.error(`[Webhooks] ${failed}/${webhooks.length} webhooks failed`);
      }
    });
  } catch (error) {
    console.error("[Webhooks] Error triggering webhooks:", error);
  }
}

/**
 * Send a single webhook request with HMAC signature
 */
async function sendWebhook(
  webhook: { id: string; url: string; secret: string },
  event: WebhookEvent,
  data: any
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  // Generate HMAC signature
  const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

  // Re-validate at dispatch to block DNS-rebinding attacks where a URL passed
  // registration checks but now resolves to an internal address.
  if (isBlockedUrl(webhook.url)) {
    console.error(`[Webhooks] Blocked SSRF attempt at dispatch for URL: ${webhook.url}`);
    return;
  }

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event,
        "User-Agent": "iran-memorial-webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`[Webhooks] Successfully delivered to ${webhook.url} (${event})`);
  } catch (error) {
    console.error(`[Webhooks] Failed to deliver to ${webhook.url}:`, error);
    throw error;
  }
}

/**
 * Verify webhook signature (for webhook receivers)
 * @param body - Raw request body string
 * @param signature - X-Webhook-Signature header value
 * @param secret - Webhook secret
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = createHmac("sha256", secret).update(body).digest();
    const received = Buffer.from(signature, "hex");
    // timingSafeEqual requires same-length buffers
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
