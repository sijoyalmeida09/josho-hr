import { NextResponse } from "next/server";

import { requireOnboardedUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/applications/:id/events
 * Returns application_events timeline for the given application.
 * RLS guarantees events belong to the authenticated caller.
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
    .select("id, user_id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 });
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabase
    .from("application_events")
    .select("id, kind, payload, at, created_at")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("at", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
