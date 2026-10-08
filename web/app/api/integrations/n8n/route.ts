import { notImplemented } from "@/app/api/_shared/not-implemented";

/**
 * GET    /api/integrations/n8n — read current user's n8n integration config
 * POST   /api/integrations/n8n — create or update webhook URL + HMAC secret
 * DELETE /api/integrations/n8n — remove integration
 */
export async function GET()    { return notImplemented("GATE-INT-01", 3); }
export async function POST()   { return notImplemented("GATE-INT-01", 3); }
export async function DELETE() { return notImplemented("GATE-INT-01", 3); }
