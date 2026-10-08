"use client";

import { useState } from "react";

import type { ApplicationRow } from "@/lib/hooks/useApplications";

import { CoverLetterBox } from "./CoverLetterBox";
import { ResumePreview } from "./ResumePreview";
import { SkillGapsPanel } from "./SkillGapsPanel";

type Props = {
  selected: ApplicationRow | null;
  loading: boolean;
};

type JobDraft = {
  company: string;
  title: string;
  url: string;
  description: string;
};

const EMPTY_DRAFT: JobDraft = { company: "", title: "", url: "", description: "" };

export function ApplicationCenter({ selected, loading }: Props) {
  const [draft, setDraft] = useState<JobDraft>(EMPTY_DRAFT);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastJobRunId, setLastJobRunId] = useState<number | null>(null);

  async function onApply() {
    setError(null);
    if (!draft.company || !draft.title || !draft.url) {
      setError("company, title and URL are required");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", job: draft }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setLastJobRunId(body.job_run_id ?? null);
      setDraft(EMPTY_DRAFT);
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Application Center</h2>
        <span className="text-xs text-neutral-500">
          {loading ? "loading…" : `${selected ? "active" : "idle"}`}
        </span>
      </header>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        {selected ? (
          <div className="space-y-1 text-sm">
            <div className="font-medium">
              {selected.role ?? "Untitled role"}{" "}
              <span className="text-neutral-400">@ {selected.company ?? "—"}</span>
            </div>
            <div className="text-xs text-neutral-500">
              status: {selected.status} · created {new Date(selected.created_at).toLocaleString()}
            </div>
            {(selected.url ?? selected.job_url) && (
              <a
                className="text-xs text-sky-400 underline"
                href={selected.url ?? selected.job_url ?? "#"}
                target="_blank"
                rel="noreferrer noopener"
              >
                open job posting
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            No application selected. Paste a job below and click Apply to enqueue one.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-sm font-semibold">Quick apply</h3>
        <div className="mt-3 grid gap-2">
          <input
            placeholder="Company"
            value={draft.company}
            onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          />
          <input
            placeholder="Role / title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          />
          <input
            placeholder="Job URL"
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          />
          <textarea
            placeholder="Paste job description (optional)"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={3}
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          />
        </div>
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
        {lastJobRunId && (
          <div className="mt-2 text-xs text-emerald-400">
            enqueued (job_run_id={lastJobRunId}) — dashboard will update live
          </div>
        )}
      </div>

      <ResumePreview application={selected} />
      <CoverLetterBox application={selected} />
      <SkillGapsPanel application={selected} />

      <div className="mt-auto flex gap-2">
        <button
          onClick={onApply}
          disabled={applying || !draft.company || !draft.title || !draft.url}
          className="rounded bg-emerald-500 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
        >
          {applying ? "enqueueing…" : "Apply"}
        </button>
        <button
          onClick={() => setDraft(EMPTY_DRAFT)}
          disabled={applying}
          className="rounded border border-neutral-700 px-3 py-2 text-sm"
        >
          Clear
        </button>
      </div>
    </section>
  );
}
