import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
]);

/**
 * POST /api/resume/upload   (multipart/form-data with field `file`)
 *
 * Writes to Supabase Storage at resumes/{user_id}/master.pdf
 * Upserts profiles.master_resume_path = same path.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file field" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES / 1024 / 1024}MB)` },
      { status: 413 }
    );
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported content-type: ${file.type}` },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 4).toString() !== "%PDF") {
    return NextResponse.json({ error: "not a PDF (bad magic bytes)" }, { status: 400 });
  }

  const path = `${user.id}/master.pdf`;
  const supabase = await getServerSupabase();
  const { error: uploadErr } = await supabase.storage
    .from("resumes")
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "private, max-age=0",
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .upsert({
      user_id: user.id,
      email: user.email,
      master_resume_path: path,
      updated_at: new Date().toISOString(),
    });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, bytes: buffer.length });
}
