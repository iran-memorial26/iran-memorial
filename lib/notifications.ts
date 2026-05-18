/**
 * Simple webhook notification system for admin alerts.
 *
 * Reads WEBHOOK_URL from process.env. If not configured, all calls are no-ops.
 * Supports Discord webhook format (rich embeds with color-coded event types).
 * Fire-and-forget: notifications never block the main request flow.
 */
import { isBlockedUrl } from "./webhook-url-guard";

type NotificationEvent = {
  type: "submission" | "comment" | "conversion";
  title: string;
  details: string;
  url?: string;
};

// Discord embed colors by event type
const EVENT_COLORS: Record<NotificationEvent["type"], number> = {
  submission: 0x3498db, // Blue — new submission received
  comment: 0xf39c12, // Orange — new comment posted
  conversion: 0x2ecc71, // Green — submission converted to victim
};

/**
 * Send a notification to the configured webhook URL.
 *
 * - Returns silently if WEBHOOK_URL is not set.
 * - Fire-and-forget: does not await the HTTP request.
 * - Catches all errors silently so notifications never break main flow.
 *
 * @param event - The notification event with type, title, details, and optional URL.
 */
export function notify(event: NotificationEvent): void {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;

  if (isBlockedUrl(webhookUrl)) {
    console.error("[Notify] Blocked SSRF attempt for WEBHOOK_URL:", webhookUrl);
    return;
  }

  const payload = buildPayload(event);

  // Fire and forget — do not await, do not block
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    // Silently ignore — notifications must never break main flow
  });
}

/**
 * Build the webhook payload.
 * Uses Discord embed format if the URL looks like a Discord webhook,
 * otherwise sends a plain JSON payload.
 */
function buildPayload(event: NotificationEvent): Record<string, unknown> {
  const webhookUrl = process.env.WEBHOOK_URL || "";
  const isDiscord = webhookUrl.includes("discord.com/api/webhooks");

  const timestamp = new Date().toISOString();

  if (isDiscord) {
    return {
      embeds: [
        {
          title: event.title,
          description: event.details,
          color: EVENT_COLORS[event.type],
          url: event.url || undefined,
          footer: { text: `Iran Memorial | ${event.type}` },
          timestamp,
        },
      ],
    };
  }

  // Generic webhook format
  return {
    event: event.type,
    title: event.title,
    details: event.details,
    url: event.url || null,
    timestamp,
  };
}
