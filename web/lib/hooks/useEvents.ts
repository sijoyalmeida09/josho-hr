"use client";

import { useEffect, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/client";

export type EventRow = {
  id: number;
  application_id: number;
  kind: string;
  payload: Record<string, unknown>;
  at: string;
  created_at: string | null;
};

/**
 * Live event timeline for a single application.
 * Inserts stream in via postgres_changes; falls back to a 30s poll if the
 * realtime socket drops.
 */
export function useEvents(applicationId: number | null) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (applicationId == null) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("application_events")
        .select("id, application_id, kind, payload, at, created_at")
        .eq("application_id", applicationId)
        .order("at", { ascending: true })
        .limit(500);
      if (!cancelled) {
        setEvents((data ?? []) as EventRow[]);
        setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel(`events-${applicationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "application_events",
          filter: `application_id=eq.${applicationId}`,
        },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as EventRow]);
        }
      )
      .subscribe();

    const poll = setInterval(load, 30_000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [applicationId]);

  return { events, loading };
}
