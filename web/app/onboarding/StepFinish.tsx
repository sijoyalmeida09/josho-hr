"use client";

import type { ResumeStructured } from "@/lib/resume-schema";

type Profile = {
  full_name: string | null;
  master_resume_path: string | null;
  structured_data: ResumeStructured | null;
  brand_preference: "hardware" | "software" | "auto" | "custom" | null;
};

export function StepFinish({
  profile,
  onFinish,
  onBack,
}: {
  profile: Profile;
  onFinish: () => void;
  onBack: () => void;
}) {
  const sections = [
    { label: "Name", value: profile.full_name ?? "—" },
    { label: "Resume", value: profile.master_resume_path ? "Uploaded" : "Missing" },
    {
      label: "Structured data",
      value: profile.structured_data ? "Parsed and saved" : "Missing",
    },
    { label: "Brand", value: profile.brand_preference ?? "auto" },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-lg font-medium">You&apos;re set</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Quick summary, then we&apos;ll drop you into the workspace.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {sections.map((s) => (
          <div
            key={s.label}
            className="rounded border border-neutral-800 bg-neutral-950 p-3"
          >
            <dt className="text-xs text-neutral-500">{s.label}</dt>
            <dd className="mt-1 text-neutral-200">{s.value}</dd>
          </div>
        ))}
      </dl>

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
          onClick={onFinish}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900"
        >
          Go to workspace
        </button>
      </div>
    </div>
  );
}
