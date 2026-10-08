import type { NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { verifyCompanionToken } from "@/lib/companion-token";

/**
 * Authenticates a companion-CLI request.
 *
 * Checks:
 *  1. Bearer token is a valid companion JWT (aud=companion).
 *  2. SHA-256(token) exists in public.companion_tokens with revoked_at IS NULL.
 *  3. Token's sub matches the row's user_id (defence in depth).
 *
 * Returns the user_id on success, or null (caller returns 401).
 */
export async function authenticateCompanion(
  request: NextRequest
): Promise<{ userId: string } | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;

  const token = match[1].trim();
  const verified = await verifyCompanionToken(token);
  if (!verified) return null;

  const admin = getAdminSupabase();
  const { data } = await admin
    .from("companion_tokens")
    .select("user_id, revoked_at")
    .eq("token_hash", verified.hash)
    .maybeSingle();

  if (!data || data.revoked_at || data.user_id !== verified.userId) {
    return null;
  }

  await admin
    .from("companion_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", verified.hash);

  return { userId: verified.userId };
}
