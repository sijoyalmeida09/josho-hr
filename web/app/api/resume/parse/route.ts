import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { chat } from "@/lib/llm";
import { EXTRACTION_PROMPT, resumeSchema } from "@/lib/resume-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/resume/parse
 *
 * Reads the uploaded PDF from Storage at resumes/{user_id}/master.pdf, extracts
 * text via pdf-parse, sends it through the LLM with EXTRACTION_PROMPT, validates
 * against resumeSchema, and stores the result on profiles.structured_data.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getServerSupabase();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("master_resume_path")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
  if (!profile?.master_resume_path) {
    return NextResponse.json({ error: "no resume uploaded" }, { status: 400 });
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from("resumes")
    .download(profile.master_resume_path);
  if (dlErr || !blob) {
    return NextResponse.json({ error: dlErr?.message ?? "download failed" }, { status: 500 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  let text: string;
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buf);
    text = parsed.text.trim();
  } catch (err) {
    return NextResponse.json(
      { error: `pdf-parse failed: ${(err as Error).message}` },
      { status: 422 }
    );
  }
  if (text.length < 100) {
    return NextResponse.json(
      { error: "extracted text too short — is this a scanned PDF?" },
      { status: 422 }
    );
  }

  let content: string;
  let provider: string;
  try {
    const result = await chat(
      user.id,
      [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: text.slice(0, 12000) },
      ],
      { response_format: { type: "json_object" }, max_tokens: 4000, temperature: 0.05 }
    );
    content = result.content;
    provider = result.provider;
  } catch (err) {
    return NextResponse.json(
      { error: `llm_error: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "llm returned non-JSON" }, { status: 502 });
    }
    try {
      raw = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "llm returned malformed JSON" }, { status: 502 });
    }
  }

  const validated = resumeSchema.safeParse(raw);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: "schema_validation_failed",
        issues: validated.error.issues.slice(0, 5),
      },
      { status: 422 }
    );
  }

  const id = validated.data.identity;
  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      full_name: id.full_name,
      phone: id.phone ?? null,
      linkedin: id.linkedin ?? null,
      github: id.github ?? null,
      location: id.location ?? null,
      structured_data: validated.data,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    provider,
    structured_data: validated.data,
  });
}
