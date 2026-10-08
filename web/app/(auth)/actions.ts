"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export type AuthFormState = {
  error?: string;
  notice?: string;
};

/**
 * Soft-launch invite gate. Comma-separated codes in JOSHO_HR_INVITE_CODES
 * (case-insensitive). If both env vars are unset, gating is OFF (open
 * signup). For invite-only, set at least one of them.
 *
 * Email allowlist (JOSHO_HR_INVITE_EMAILS) bypasses the code requirement.
 * Login flows (`is_signup` not set) skip the gate so existing users keep
 * working even if codes rotate.
 */
function isInviteValid(code: string, email: string): boolean {
  const codesRaw = process.env.JOSHO_HR_INVITE_CODES ?? "";
  const emailsRaw = process.env.JOSHO_HR_INVITE_EMAILS ?? "";
  if (!codesRaw && !emailsRaw) return true; // gating off
  const allowedCodes = codesRaw.split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
  const allowedEmails = emailsRaw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  if (allowedEmails.includes(email.toLowerCase())) return true;
  if (code && allowedCodes.includes(code.trim().toLowerCase())) return true;
  return false;
}

/**
 * Sends a magic link. Works for both new and existing users — Supabase will
 * auto-create the auth user on first click. Soft-launch invite gate runs
 * only on signup (when `is_signup=1` is in the form).
 */
export async function sendMagicLink(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/app");
  const inviteCode = String(formData.get("invite_code") ?? "").trim();
  const isSignup = String(formData.get("is_signup") ?? "") === "1";

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }

  if (isSignup && !isInviteValid(inviteCode, email)) {
    return {
      error:
        "Invite required. Ask Sijoy for a code, or sign in if you already have an account.",
    };
  }

  const supabase = await getServerSupabase();
  const redirectTo = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_APP_URL);
  redirectTo.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo.toString(),
      shouldCreateUser: isSignup,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { notice: `Magic link sent to ${email}. Check your inbox.` };
}

export async function signOutAction() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
