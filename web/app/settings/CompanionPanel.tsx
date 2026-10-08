"use client";

import { useState } from "react";

export function CompanionPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/companion/token", { method: "POST" });
      const json = (await res.json()) as {
        token?: string;
        expires_at?: string;
        error?: string;
      };
      if (!res.ok || !json.token) {
        throw new Error(json.error ?? `failed (${res.status})`);
      }
      setToken(json.token);
      setExpires(json.expires_at ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/companion/token", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `revoke failed (${res.status})`);
      }
      setToken(null);
      setExpires(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-400">
        Download{" "}
        <a
          href="/download/companion"
          className="underline hover:text-neutral-200"
        >
          josho_hr_sync.py
        </a>{" "}
        and run:{" "}
        <code className="rounded bg-neutral-950 px-1 py-0.5 text-xs">
          python josho_hr_sync.py --init
        </code>
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={issue}
          disabled={busy}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {busy ? "…" : token ? "Issue new token" : "Issue companion token"}
        </button>
        {token ? (
          <button
            type="button"
            onClick={revokeAll}
            disabled={busy}
            className="rounded border border-neutral-700 px-3 py-2 text-sm"
          >
            Revoke all
          </button>
        ) : null}
      </div>

      {token ? (
        <div className="flex flex-col gap-2 rounded border border-amber-700 bg-amber-950/30 p-3">
          <p className="text-xs text-amber-300">
            Copy now. This is the only time we&apos;ll show it.
            {expires ? ` Expires ${new Date(expires).toLocaleString()}.` : ""}
          </p>
          <code className="break-all rounded bg-neutral-950 p-2 text-xs text-neutral-200">
            {token}
          </code>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(token)}
            className="self-start rounded border border-neutral-700 px-2 py-1 text-xs"
          >
            Copy
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
