import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Returns the authenticated user or null. Never throws on unauthenticated.
 * Use in API routes where you handle the 401 yourself.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Returns the authenticated user or redirects to /login. Use in server
 * components that require auth. If `redirectTo` is provided, the post-login
 * page will forward the user there.
 */
export async function requireUser(redirectTo?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

/**
 * Requires an authenticated user with onboarding complete. Sends the user to
 * /onboarding if their profile.onboarding_complete is false.
 */
export async function requireOnboardedUser(): Promise<{ user: User; profileId: string }> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.onboarding_complete) {
    redirect("/onboarding");
  }
  return { user, profileId: profile.user_id };
}
