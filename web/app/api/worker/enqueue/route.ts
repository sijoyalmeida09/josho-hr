import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * POST /api/worker/enqueue
 *
 * Called by the GH Actions cron (.github/workflows/worker-cron.yml) every 5 min.
 * Purpose: for each user who opted into scheduled scraping (user_integrations
 * kind='scheduled_apply', enabled=true), enqueue a scrape+apply job_runs row.
 *
 * Auth: Bearer <WORKER_CRON_TOKEN>. This is a server-to-server endpoint — NOT
 * exposed to browser traffic. Token lives in GH Actions secrets + Vercel env.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expected = process.env.WORKER_CRON_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  const { data: integrations, error } = await admin
    .from("user_integrations")
    .select("user_id, config")
    .eq("kind", "scheduled_apply")
    .eq("enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enqueued = 0;
  for (const row of integrations ?? []) {
    const { error: insErr } = await admin.from("job_runs").insert({
      user_id: row.user_id,
      kind: "scrape",
      status: "queued",
      params: row.config ?? {},
    });
    if (!insErr) enqueued += 1;
  }
  return NextResponse.json({ ok: true, enqueued });
}
