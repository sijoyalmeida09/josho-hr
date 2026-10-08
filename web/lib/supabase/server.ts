import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieRecord = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client scoped by the caller's auth cookies.
 * Used in route handlers and server components. RLS enforces data isolation.
 */
export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase env missing on server");
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(all: CookieRecord[]) {
        try {
          for (const c of all) cookieStore.set(c.name, c.value, c.options);
        } catch {
          // setAll called from a server component — ignored (middleware handles refresh).
        }
      },
    },
  });
}
