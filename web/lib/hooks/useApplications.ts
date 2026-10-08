"use client";

import { useEffect, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/client";

export type ApplicationRow = {
  id: number;
  company: string | null;
  role: string | null;
  status: string;
  applied_at: string | null;
  created_at: string;
  url: string | null;
  job_url: string | null;
  resume_storage_path: string | null;
  cover_letter_storage_path: string | null;
  trace_storage_path: string | null;
  skill_gaps: unknown;
};

const SELECT_COLS =
  "id, company, role, status, applied_at, created_at, url, job_url, resume_storage_path, cover_letter_storage_path, trace_storage_path, skill_gaps";

/**
 * Live list of the current user's applications.
 * Subscribes to INSERT/UPDATE on public.applications filtered by user_id.
 */
export function useApplications() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        if (!cancelled) {
          setLoading(false);
          setError("not_authenticated");
        }
        return;
      }

      const { data, error: selErr } = await supabase
        .from("applications")
        .select(SELECT_COLS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (selErr) {
        setError(selErr.message);
      } else {
        setRows((data ?? []) as ApplicationRow[]);
      }
      setLoading(false);

      channelRef = supabase
        .channel("applications-feed")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "applications",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            setRows((prev) => {
              if (payload.eventType === "INSERT") {
                return [payload.new as ApplicationRow, ...prev];
              }
              if (payload.eventType === "UPDATE") {
                const next = payload.new as ApplicationRow;
                return prev.map((r) => (r.id === next.id ? next : r));
              }
              if (payload.eventType === "DELETE") {
                const old = payload.old as { id: number };
                return prev.filter((r) => r.id !== old.id);
              }
              return prev;
            });
          }
        )
        .subscribe();
    }

    init();

    return () => {
      cancelled = true;
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, []);

  return { rows, loading, error };
}
