"use client";

import { useEffect, useState } from "react";

type Profile = {
  full_name: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  location: string | null;
  brand_preference: "hardware" | "software" | "auto" | "custom" | null;
};

const FIELDS: Array<{ key: keyof Profile; label: string; placeholder?: string }> = [
  { key: "full_name", label: "Full name" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn handle", placeholder: "your-handle" },
  { key: "github", label: "GitHub handle" },
  { key: "location", label: "Location", placeholder: "City, State, Country" },
];

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/profile");
    if (!res.ok) {
      setError(`failed to load profile (${res.status})`);
      return;
    }
    const body = (await res.json()) as { profile: Profile };
    setProfile(body.profile);
  }

  async function save() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      setNotice("Saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">{f.label}</span>
          <input
            type="text"
            value={profile[f.key] ?? ""}
            placeholder={f.placeholder}
            onChange={(e) =>
              setProfile((p) => (p ? { ...p, [f.key]: e.target.value } : p))
            }
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          />
        </label>
      ))}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Brand</span>
        <select
          value={profile.brand_preference ?? "auto"}
          onChange={(e) =>
            setProfile((p) =>
              p ? { ...p, brand_preference: e.target.value as Profile["brand_preference"] } : p
            )
          }
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
        >
          <option value="auto">Auto</option>
          <option value="software">Software</option>
          <option value="hardware">Hardware</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
        {error ? <span className="text-sm text-red-400">{error}</span> : null}
        {notice ? <span className="text-sm text-emerald-400">{notice}</span> : null}
      </div>
    </div>
  );
}
