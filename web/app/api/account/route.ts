import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * DELETE /api/account
 *
 * Full GDPR hard-delete:
 *   1. Remove all user-scoped storage objects (resumes/cover_letters/traces/inbox).
 *   2. Call public.delete_account(p_user_id) RPC — wipes every row the user owns.
 *   3. auth.admin.deleteUser — removes the auth.users record itself.
 *
 * The request must include ?confirm=DELETE so accidental calls from the UI
 * are rejected (the UI's DangerZone also prompts the user to type "DELETE").
 */
export async function DELETE(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  if (url.searchParams.get("confirm") !== "DELETE") {
    return NextResponse.json(
      { error: "confirmation_required", hint: "append ?confirm=DELETE" },
      { status: 400 }
    );
  }

  const admin = getAdminSupabase();

  // 1. Storage wipe — each bucket is path-prefixed by user_id.
  for (const bucket of ["resumes", "cover_letters", "traces", "inbox"] as const) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(user.id, {
        limit: 1000,
      });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${user.id}/${f.name}`);
        await admin.storage.from(bucket).remove(paths);
      }
    } catch {
      // best-effort; continue
    }
  }

  // 2. Delete all rows via RPC (single transaction, audit-logged).
  const { error: rpcErr } = await admin.rpc("delete_account", {
    p_user_id: user.id,
  });
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // 3. Delete the auth.users row itself.
  const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
  if (authErr) {
    return NextResponse.json(
      { error: "auth_delete_failed", detail: authErr.message, rows_deleted: true },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
