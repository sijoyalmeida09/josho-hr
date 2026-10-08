import { NextResponse, type NextRequest } from "next/server";
import { authenticateCompanion } from "@/lib/companion-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_BUCKETS = new Set(["resumes", "cover_letters", "inbox"]);

// Pillar 1: filesystem-bridge upload is deprecated. New flows should write
// artifacts straight to Supabase Storage from the daemon side.
const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  "X-Deprecated-By": "automation/career-ops/cloud_sync.py",
};

/**
 * POST /api/companion/upload?bucket=<resumes|cover_letters|inbox>&name=<filename>
 *
 * Auth: Bearer companion token.
 * Body: raw binary, Content-Type honoured.
 *
 * Stores at {bucket}/{user_id}/{name}. Inbox uploads are processed later by
 * the worker (Phase 3) to promote PDFs into resumes/{user_id}/master.pdf
 * when the user explicitly confirms a replacement.
 */
export async function POST(request: NextRequest) {
  const authed = await authenticateCompanion(request);
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") ?? "inbox";
  const rawName = url.searchParams.get("name") ?? "";

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "invalid bucket" }, { status: 400 });
  }
  if (!rawName || rawName.includes("/") || rawName.includes("..")) {
    return NextResponse.json({ error: "invalid name" }, { status: 400 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }
  if (body.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `too large (max ${MAX_BYTES / 1024 / 1024}MB)` },
      { status: 413 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "application/octet-stream";
  const path = `${authed.userId}/${rawName}`;

  const admin = getAdminSupabase();
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true, cacheControl: "private, max-age=0" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { ok: true, bucket, path, bytes: body.length },
    { headers: DEPRECATION_HEADERS }
  );
}
