import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { EMAIL_BODY_RETENTION_DAYS, TRACE_RETENTION_DAYS } from "@/lib/retention";

/**
 * POST /api/worker/retention
 *
 * Called by .github/workflows/retention-cron.yml daily.
 * - Deletes application_events rows older than the retention horizon
 * - Wipes application trace_storage_path after 90 days (and unlinks the column)
 * - Purges email body/headers after 30 days, keeping only the metadata shell
 *
 * Auth: Bearer <WORKER_CRON_TOKEN>.
 * GATE-LEGAL-02 — schedule visible in docs/retention.md.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!process.env.WORKER_CRON_TOKEN || token !== process.env.WORKER_CRON_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getAdminSupabase();
  const summary: Record<string, number> = {};

  const traceCutoff = new Date(
    Date.now() - TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: expiringTraces } = await admin
    .from("applications")
    .select("id, user_id, trace_storage_path")
    .not("trace_storage_path", "is", null)
    .lt("applied_at", traceCutoff)
    .limit(500);

  let tracePurged = 0;
  for (const row of expiringTraces ?? []) {
    if (!row.trace_storage_path) continue;
    const { error: rmErr } = await admin.storage
      .from("traces")
      .remove([row.trace_storage_path]);
    if (rmErr) continue;
    await admin
      .from("applications")
      .update({ trace_storage_path: null })
      .eq("id", row.id);
    tracePurged += 1;
  }
  summary.traces_purged = tracePurged;

  const emailCutoff = new Date(
    Date.now() - EMAIL_BODY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { count: emailsScrubbed } = await admin
    .from("emails")
    .update({ body_preview: null, body_scrubbed: true }, { count: "exact" })
    .lt("received_at", emailCutoff)
    .eq("body_scrubbed", false);
  summary.emails_scrubbed = emailsScrubbed ?? 0;

  const { count: oldEvents } = await admin
    .from("application_events")
    .delete({ count: "exact" })
    .lt("created_at", traceCutoff);
  summary.events_deleted = oldEvents ?? 0;

  return NextResponse.json({ ok: true, summary });
}
