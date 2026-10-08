import { notImplemented } from "@/app/api/_shared/not-implemented";

/**
 * POST /api/webhooks/n8n/email
 *
 * Inbound webhook from the user's own n8n instance (Gmail/IMAP node).
 *
 * Contract (GATE-INT-01, contractVersion="v1"):
 *   Headers:
 *     X-JoshoHR-Signature: sha256=<hex-hmac>
 *     Idempotency-Key:     <uuid>
 *     X-JoshoHR-Contract:  v1
 *   Body JSON:
 *     {
 *       user_token: string,       // companion or integration-scoped token
 *       subject: string,
 *       from: string,
 *       classification: string,
 *       received_at: ISO string,
 *       body_preview: string
 *     }
 *
 * Handler verifies HMAC against user's stored secret, rejects replays
 * older than 5 minutes, then inserts into public.emails.
 */
export async function POST() {
  return notImplemented("GATE-INT-01", 3);
}
