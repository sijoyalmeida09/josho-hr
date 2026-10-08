import { NextResponse, type NextRequest } from "next/server";
import { authenticateCompanion } from "@/lib/companion-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

// Pillar 1: filesystem-bridge is deprecated in favor of automation/career-ops/cloud_sync.py
// which writes the SQLite tracker straight into Supabase (career_ops schema). The route
// still works for the legacy companion script, but new clients should bypass it.
const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '<https://josho-hr.vercel.app/docs/cloud-sync>; rel="successor-version"',
  "X-Deprecated-By": "automation/career-ops/cloud_sync.py",
};

/**
 * GET /api/companion/manifest
 *
 * Auth: Bearer companion token.
 * Returns the caller's applications (id, company, role, status, dates) plus
 * short-lived signed URLs for their resume, cover-letter, and trace artifacts.
 *
 * Signed-URL TTL is capped at 300 seconds per GATE-SEC-01.
 */
export async function GET(request: NextRequest) {
  const authed = await authenticateCompanion(request);
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  const { data: apps, error } = await admin
    .from("applications")
    .select(
      "id, company, role, status, applied_at, created_at, resume_storage_path, cover_letter_storage_path, trace_storage_path"
    )
    .eq("user_id", authed.userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profile } = await admin
    .from("profiles")
    .select("master_resume_path")
    .eq("user_id", authed.userId)
    .maybeSingle();

  const toSignedUrl = async (bucket: string, path: string | null) => {
    if (!path) return null;
    const { data } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  };

  const applications = await Promise.all(
    (apps ?? []).map(async (a) => ({
      id: a.id,
      company: a.company,
      role: a.role,
      status: a.status,
      applied_at: a.applied_at,
      created_at: a.created_at,
      resume_url: await toSignedUrl("resumes", a.resume_storage_path),
      cover_letter_url: await toSignedUrl(
        "cover_letters",
        a.cover_letter_storage_path
      ),
      trace_url: await toSignedUrl("traces", a.trace_storage_path),
    }))
  );

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      signed_url_ttl_seconds: SIGNED_URL_TTL_SECONDS,
      master_resume_url: await toSignedUrl(
        "resumes",
        profile?.master_resume_path ?? null
      ),
      applications,
    },
    { headers: DEPRECATION_HEADERS }
  );
}
