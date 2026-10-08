"use client";

import { useEffect, useState } from "react";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/providers";

type KeysState = {
  groq: boolean;
  openrouter: boolean;
  anthropic: boolean;
  cerebras: boolean;
  mistral: boolean;
  use_trial_pool: boolean;
  trial_calls_remaining: number;
};

export function KeysForm() {
  const [state, setState] = useState<KeysState | null>(null);
  const [busy, setBusy] = useState<LlmProvider | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<LlmProvider, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const res = await fetch("/api/keys");
    if (!res.ok) {
      setError(`failed to load keys (${res.status})`);
      return;
    }
    const data = (await res.json()) as KeysState;
    setState(data);
  }

  async function save(slot: LlmProvider) {
    const value = drafts[slot]?.trim();
    if (!value) return;
    setBusy(slot);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, value, use_trial_pool: false }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      setDrafts((d) => ({ ...d, [slot]: "" }));
      setNotice(`${slot} saved. Trial pool disabled.`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(slot: LlmProvider) {
    setBusy(slot);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/keys?slot=${slot}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `remove failed (${res.status})`);
      }
      setNotice(`${slot} removed.`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!state) return <p className="text-sm text-neutral-500">Loading keys…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            state.use_trial_pool ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
        <span>
          {state.use_trial_pool
            ? `Using trial pool. ${state.trial_calls_remaining} calls remaining; 20:1 contribution applies.`
            : "Using BYOK. No contribution."}
        </span>
      </div>

      <ul className="flex flex-col gap-3">
        {LLM_PROVIDERS.map((slot) => (
          <li
            key={slot}
            className="flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-950 p-3"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium capitalize">{slot}</span>
              <span
                className={`text-xs ${
                  state[slot] ? "text-emerald-400" : "text-neutral-500"
                }`}
              >
                {state[slot] ? "Key stored" : "Not set"}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={state[slot] ? "Replace key…" : "Paste key…"}
                value={drafts[slot] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [slot]: e.target.value }))}
                className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
              />
              <button
                type="button"
                disabled={busy === slot || !drafts[slot]?.trim()}
                onClick={() => save(slot)}
                className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-900 disabled:opacity-50"
              >
                {busy === slot ? "…" : "Save"}
              </button>
              {state[slot] ? (
                <button
                  type="button"
                  disabled={busy === slot}
                  onClick={() => remove(slot)}
                  className="rounded border border-neutral-700 px-2 py-1 text-xs"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-400">{notice}</p> : null}
    </div>
  );
}
