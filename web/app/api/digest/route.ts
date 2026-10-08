import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

const DIGEST_WINDOW_DAYS = 7;

type DigestProfile = {
  user_id: string;
  email: string | null;
  full_name: string | null;
};

/**
 * POST /api/digest
 *
 * Called by a GH Actions cron (weekly). Builds a per-user digest of the last
 * 7 days and sends via Resend. Users with user_integrations.kind='digest_email'
 * enabled=false are skipped.
 *
 * Auth: Bearer <WORKER_CRON_TOKEN>.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!process.env.WORKER_CRON_TOKEN || token !== process.env.WORKER_CRON_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "resend_not_configured" }, { status: 503 });
  }

  const admin = getAdminSupabase();

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("user_id, email, full_name")
    .eq("onboarding_complete", true)
    .not("email", "is", null);
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  const { data: disabled } = await admin
    .from("user_integrations")
    .select("user_id")
    .eq("kind", "digest_email")
    .eq("enabled", false);
  const optOut = new Set((disabled ?? []).map((r) => r.user_id));

  const cutoff = new Date(
    Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  let sent = 0;
  let failed = 0;

  for (const prof of (profiles as DigestProfile[]) ?? []) {
    if (!prof.email || optOut.has(prof.user_id)) continue;

    const { data: apps } = await admin
      .from("applications")
      .select("id, company, role, status, applied_at, created_at")
      .eq("user_id", prof.user_id)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });

    const rows = apps ?? [];
    if (rows.length === 0) continue;

    const applied = rows.filter((r) => r.status === "submitted").length;
    const running = rows.filter((r) => r.status === "running").length;
    const failedCount = rows.filter((r) => r.status === "failed").length;

    const listItems = rows
      .slice(0, 15)
      .map(
        (r) =>
          `<li>${escapeHtml(r.role ?? "—")} @ ${escapeHtml(r.company ?? "—")} — <em>${r.status}</em></li>`
      )
      .join("");

    const html = `
      <p>Hi ${escapeHtml(prof.full_name ?? "there")},</p>
      <p>Your last 7 days on josho-hr:</p>
      <ul>
        <li><strong>${rows.length}</strong> applications tracked</li>
        <li>${applied} submitted · ${running} running · ${failedCount} failed</li>
      </ul>
      <p>Most recent:</p>
      <ul>${listItems}</ul>
      <p style="color:#888;font-size:12px">
        Manage notifications in <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings">Settings</a>.
      </p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_ADDRESS ?? "josho-hr <digest@josho-hr.dev>",
        to: prof.email,
        subject: `josho-hr weekly digest — ${rows.length} apps`,
        html,
      }),
    });

    if (res.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, sent, failed });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
