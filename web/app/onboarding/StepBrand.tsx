"use client";

import { useState } from "react";

type Brand = "hardware" | "software" | "auto" | "custom";

const OPTIONS: Array<{ value: Brand; title: string; body: string }> = [
  {
    value: "auto",
    title: "Auto (recommended)",
    body: "Pick hardware vs software per-job based on the listing.",
  },
  {
    value: "software",
    title: "Software",
    body: "Prioritize SWE, full-stack, platform, backend, and ML roles.",
  },
  {
    value: "hardware",
    title: "Hardware",
    body: "Prioritize embedded, FPGA, PCB, RF, and VLSI roles.",
  },
  {
    value: "custom",
    title: "Custom",
    body: "Advanced: provide your own niche prompts in Settings.",
  },
];

export function StepBrand({
  current,
  onSaved,
  onBack,
}: {
  current: Brand;
  onSaved: (brand: Brand) => void;
  onBack: () => void;
}) {
  const [brand, setBrand] = useState<Brand>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_preference: brand }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      onSaved(brand);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-lg font-medium">Pick a brand</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Controls which tailored resume variant we send per job.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {OPTIONS.map((opt) => (
          <li key={opt.value}>
            <label
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm ${
                brand === opt.value
                  ? "border-neutral-100 bg-neutral-950"
                  : "border-neutral-700 bg-neutral-950"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="brand"
                  value={opt.value}
                  checked={brand === opt.value}
                  onChange={() => setBrand(opt.value)}
                />
                <span className="font-medium">{opt.title}</span>
              </div>
              <span className="pl-6 text-neutral-400">{opt.body}</span>
            </label>
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-neutral-700 px-3 py-2 text-sm"
        >
          Back
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
