import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/account/export
 *
 * Returns all user-scoped rows as a single JSON blob. Storage artifacts
 * are NOT embedded — paths are included so the user can fetch signed URLs
 * separately via the companion CLI or the trace route.
 *
 * GATE-LEGAL-02 — GDPR right-to-portability.
 */
export async function GET() {
  const user = await requireUser();
  const supabase = await getServerSupabase();

  const [profile, keys, quota, apps, events, skills, emails, runs, integrations] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_api_keys")
        .select(
          "user_id, use_trial_pool, trial_calls_remaining, gmail_address, telegram_chat_id, updated_at"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("user_quota").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("applications").select("*"),
      supabase.from("application_events").select("*"),
      supabase.from("application_skill_gaps").select("*"),
      supabase.from("emails").select("id, subject, from_email, classification, received_at, source"),
      supabase.from("job_runs").select("id, kind, status, started_at, finished_at, error_msg, metrics, created_at"),
      supabase
        .from("user_integrations")
        .select("id, kind, webhook_url, enabled, events, created_at, updated_at")
        .eq("user_id", user.id),
    ]);

  const payload = {
    export_version: 1,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    profile: profile.data,
    api_keys_metadata: keys.data,
    quota: quota.data,
    applications: apps.data ?? [],
    application_events: events.data ?? [],
    skill_gaps: skills.data ?? [],
    emails_metadata: emails.data ?? [],
    job_runs: runs.data ?? [],
    integrations: integrations.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="josho-hr-export-${user.id}.json"`,
    },
  });
}
