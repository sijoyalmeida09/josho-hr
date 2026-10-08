import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { issueCompanionToken } from "@/lib/companion-token";

export const runtime = "nodejs";

/**
 * POST /api/companion/token
 * Mints a new companion JWT, revokes any prior active tokens for this user,
 * stores the sha256 hash in public.companion_tokens, and returns the raw
 * token exactly once.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { error: revokeErr } = await admin
    .from("companion_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if (revokeErr) {
    return NextResponse.json({ error: revokeErr.message }, { status: 500 });
  }

  const { token, hash, expiresAt } = await issueCompanionToken(user.id);

  const { error: insertErr } = await admin.from("companion_tokens").insert({
    user_id: user.id,
    token_hash: hash,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    token,
    expires_at: expiresAt.toISOString(),
  });
}

/**
 * DELETE /api/companion/token
 * Revokes every active companion token for the caller.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("companion_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
