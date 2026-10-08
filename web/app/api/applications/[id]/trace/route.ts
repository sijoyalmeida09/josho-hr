import { NextResponse } from "next/server";

import { requireOnboardedUser } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * GET /api/applications/:id/trace
 * Returns a short-lived signed URL for the Playwright trace.zip stored in the
 * `traces` bucket. Path is traces/{user_id}/{application_id}.zip.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { user } = await requireOnboardedUser();
  const { id } = await params;
  const applicationId = Number.parseInt(id, 10);
  if (!Number.isFinite(applicationId)) {
    return NextResponse.json({ error: "invalid_application_id" }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, trace_storage_path")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 });
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!app.trace_storage_path) {
    return NextResponse.json({ error: "no_trace_available" }, { status: 404 });
  }

  const admin = getAdminSupabase();
  const { data: signed, error: signErr } = await admin.storage
    .from("traces")
    .createSignedUrl(app.trace_storage_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "sign_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: signed.signedUrl,
    expires_in: SIGNED_URL_TTL_SECONDS,
    path: app.trace_storage_path,
  });
}
