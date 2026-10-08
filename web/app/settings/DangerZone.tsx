"use client";

import { useState } from "react";

export function DangerZone() {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        setError(`export failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `josho-hr-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setError(null);
    if (confirmText !== "DELETE") {
      setError("type DELETE to confirm");
      return;
    }
    if (!window.confirm("This is irreversible. Continue?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/account?confirm=DELETE", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-900/50 bg-red-950/20 p-4">
      <p className="text-sm text-neutral-300">
        Export or delete your account. Deletion removes every application,
        resume, cover letter, trace, and key. Irreversible.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="rounded border border-neutral-700 px-3 py-2 text-sm disabled:opacity-50"
        >
          Export all data
        </button>
        <input
          type="text"
          placeholder='Type "DELETE" to enable'
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={busy || confirmText !== "DELETE"}
          className="rounded border border-red-700 px-3 py-2 text-sm text-red-300 disabled:opacity-40"
        >
          Delete account
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
