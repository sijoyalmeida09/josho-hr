"use client";

import { useState } from "react";
import type { ResumeStructured } from "@/lib/resume-schema";

export function StepReview({
  structured,
  onParsed,
  onSaved,
  onBack,
}: {
  structured: ResumeStructured | null;
  onParsed: (data: ResumeStructured) => void;
  onSaved: (data: ResumeStructured) => void;
  onBack: () => void;
}) {
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(() =>
    structured ? JSON.stringify(structured, null, 2) : ""
  );
  const [provider, setProvider] = useState<string | null>(null);

  async function runParse() {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/resume/parse", { method: "POST" });
      const json = (await res.json()) as {
        ok?: boolean;
        provider?: string;
        structured_data?: ResumeStructured;
        error?: string;
      };
      if (!res.ok || !json.structured_data) {
        throw new Error(json.error ?? `parse failed (${res.status})`);
      }
      setJsonText(JSON.stringify(json.structured_data, null, 2));
      setProvider(json.provider ?? null);
      onParsed(json.structured_data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      let parsed: ResumeStructured;
      try {
        parsed = JSON.parse(jsonText) as ResumeStructured;
      } catch {
        throw new Error("invalid JSON");
      }
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structured_data: parsed }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      onSaved(parsed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-lg font-medium">Review parsed resume</h2>
        <p className="mt-1 text-sm text-neutral-400">
          We&apos;ll extract your experience, projects, skills, and education as
          structured JSON. Edit anything that looks off.
        </p>
      </div>

      {!structured && !jsonText ? (
        <button
          type="button"
          disabled={parsing}
          onClick={runParse}
          className="self-start rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {parsing ? "Parsing…" : "Parse now"}
        </button>
      ) : (
        <>
          {provider ? (
            <p className="text-xs text-neutral-500">Parsed using {provider}.</p>
          ) : null}
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="h-80 w-full rounded border border-neutral-700 bg-neutral-950 p-3 font-mono text-xs text-neutral-200"
          />
          <button
            type="button"
            disabled={parsing}
            onClick={runParse}
            className="self-start rounded border border-neutral-700 px-3 py-2 text-sm"
          >
            {parsing ? "Re-parsing…" : "Re-parse from PDF"}
          </button>
        </>
      )}

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
          onClick={save}
          disabled={!jsonText || saving}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Looks good, continue"}
        </button>
      </div>
    </div>
  );
}
