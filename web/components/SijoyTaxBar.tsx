"use client";

import { useQuota } from "@/lib/hooks/useQuota";

export function SijoyTaxBar() {
  const { quota, loading } = useQuota();

  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-xs text-neutral-500">
        loading quota…
      </div>
    );
  }

  if (!quota.use_trial_pool) {
    return (
      <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/40 p-4">
        <div className="text-xs font-medium text-emerald-300">
          BYOK enabled — no Sijoy contribution this cycle
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          {quota.total_apps_contributed} total contributions made while on the
          trial pool.
        </p>
      </div>
    );
  }

  const progress = quota.apps_since_sijoy_run;
  const cycle = quota.cycle_size || 20;
  const pct = Math.min(100, Math.round((progress / cycle) * 100));
  const remaining = quota.trial_calls_remaining;
  const lowQuota = remaining > 0 && remaining <= Math.ceil(cycle * 0.2);
  const exhausted = remaining <= 0;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-neutral-400">Contribution progress</span>
        <span className="text-neutral-500">
          {progress} / {cycle} until next Sijoy application
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
        <div
          className="h-full bg-sky-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Trial pool: <span className="text-neutral-300">{remaining}</span> LLM calls left.
        Bring your own keys in{" "}
        <a className="underline hover:text-neutral-300" href="/settings">
          Settings
        </a>{" "}
        to skip the contribution.
      </p>
      {lowQuota && (
        <p className="mt-2 text-xs text-amber-400">
          Warning: trial pool is low ({remaining} calls left). Add your own
          Groq / OpenRouter key to continue uninterrupted.
        </p>
      )}
      {exhausted && (
        <p className="mt-2 text-xs text-red-400">
          Trial pool exhausted. Add a BYOK key to keep applying.
        </p>
      )}
      <p className="mt-1 text-xs text-neutral-600">
        Total contributions so far: {quota.total_apps_contributed}
      </p>
    </div>
  );
}
