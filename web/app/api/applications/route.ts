import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOnboardedUser } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

const ApplyPayload = z.object({
  action: z.literal("apply"),
  job: z.object({
    company: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    description: z.string().max(20_000).optional().default(""),
    url: z.string().url().max(2000),
    location: z.string().max(200).optional(),
    platform: z.string().max(50).optional(),
  }),
});

/**
 * GET /api/applications
 * Returns the current user's applications, newest first.
 */
export async function GET() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, company, role, status, applied_at, created_at, job_url, url, resume_storage_path, cover_letter_storage_path, trace_storage_path, skill_gaps"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}

/**
 * POST /api/applications
 * Body: { action: "apply", job: { ... } }
 * Creates an application row + a job_runs queue entry the worker will pick up.
 */
export async function POST(req: Request) {
  const { user } = await requireOnboardedUser();
  const raw = await req.json().catch(() => null);
  const parsed = ApplyPayload.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { job } = parsed.data;

  const admin = getAdminSupabase();

  const { data: appRow, error: appErr } = await admin
    .from("applications")
    .insert({
      user_id: user.id,
      company: job.company,
      role: job.title,
      url: job.url,
      job_url: job.url,
      location: job.location ?? null,
      platform: job.platform ?? null,
      ats_platform: job.platform ?? null,
      status: "queued",
      source: "manual",
      job_snapshot: { description: job.description ?? "" },
    })
    .select("id")
    .single();

  if (appErr || !appRow) {
    const isDuplicate =
      appErr?.code === "23505" || appErr?.message?.includes("duplicate");
    return NextResponse.json(
      {
        error: isDuplicate ? "duplicate_application" : (appErr?.message ?? "insert_failed"),
        hint: isDuplicate ? "You already applied to this URL" : undefined,
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  const { data: jobRow, error: jobErr } = await admin
    .from("job_runs")
    .insert({
      user_id: user.id,
      kind: "apply",
      status: "queued",
      params: { job, application_id: appRow.id },
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    return NextResponse.json(
      { error: jobErr?.message ?? "enqueue_failed", application_id: appRow.id },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      application_id: appRow.id,
      job_run_id: jobRow.id,
    },
    { status: 202 }
  );
}
