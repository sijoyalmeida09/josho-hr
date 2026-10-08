import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client that bypasses RLS using the service role key.
 *
 * USE ONLY from server-side code paths that must act across tenants
 * (e.g. the rare admin endpoint, companion token verification).
 *
 * NEVER import this module from a file in /app/(client) or a Client Component.
 */
export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Admin Supabase env missing");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
