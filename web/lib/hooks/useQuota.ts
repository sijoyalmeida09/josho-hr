"use client";

import { useEffect, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/client";

export type QuotaSummary = {
  apps_since_sijoy_run: number;
  cycle_size: number;
  total_apps_contributed: number;
  use_trial_pool: boolean;
  trial_calls_remaining: number;
};

const DEFAULT: QuotaSummary = {
  apps_since_sijoy_run: 0,
  cycle_size: 20,
  total_apps_contributed: 0,
  use_trial_pool: true,
  trial_calls_remaining: 0,
};

/**
 * Live view of the user's Sijoy-tax counter + trial-pool budget.
 * Powers SijoyTaxBar and the trial-quota banner.
 */
export function useQuota() {
  const [quota, setQuota] = useState<QuotaSummary>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id ?? null;
      if (!uid) {
        if (!cancelled) setLoading(false);
        return;
      }

      async function load() {
        const [q, k] = await Promise.all([
          supabase
            .from("user_quota")
            .select("apps_since_sijoy_run, cycle_size, total_apps_contributed")
            .eq("user_id", uid!)
            .maybeSingle(),
          supabase
            .from("user_api_keys")
            .select("use_trial_pool, trial_calls_remaining")
            .eq("user_id", uid!)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setQuota({
          apps_since_sijoy_run: q.data?.apps_since_sijoy_run ?? 0,
          cycle_size: q.data?.cycle_size ?? 20,
          total_apps_contributed: q.data?.total_apps_contributed ?? 0,
          use_trial_pool: k.data?.use_trial_pool ?? true,
          trial_calls_remaining: k.data?.trial_calls_remaining ?? 0,
        });
        setLoading(false);
      }
      await load();

      channelRef = supabase
        .channel("quota-feed")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_quota",
            filter: `user_id=eq.${uid}`,
          },
          () => load()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_api_keys",
            filter: `user_id=eq.${uid}`,
          },
          () => load()
        )
        .subscribe();
    }

    init();

    return () => {
      cancelled = true;
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, []);

  return { quota, loading };
}
