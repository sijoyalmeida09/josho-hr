import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * OAuth / magic-link return handler. Supabase redirects here with either a
 * `code` query parameter (PKCE flow) or a hash fragment (implicit).
 *
 * After exchanging the code for a session, we route new accounts to
 * /onboarding and returning users to the `next` parameter (default /app).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_user", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({
      user_id: user.id,
      email: user.email,
      onboarding_complete: false,
    });
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (!profile.onboarding_complete) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
