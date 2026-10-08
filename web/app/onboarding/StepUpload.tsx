"use client";

import { useState } from "react";

export function StepUpload({
  hasResume,
  onUploaded,
}: {
  hasResume: boolean;
  onUploaded: (path: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function submit() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; path?: string; error?: string };
      if (!res.ok || !json.path) {
        throw new Error(json.error ?? `upload failed (${res.status})`);
      }
      onUploaded(json.path);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-lg font-medium">Upload your master resume</h2>
        <p className="mt-1 text-sm text-neutral-400">
          PDF only, max 10 MB. We&apos;ll parse it on the next step and you can
          edit anything we got wrong.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-700 bg-neutral-950 p-8 text-sm text-neutral-400 hover:border-neutral-500">
        <span>{file ? file.name : "Click to choose a PDF"}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {hasResume && !file ? (
        <p className="text-xs text-emerald-400">
          A resume is already on file. Upload a new one to replace it, or click Continue.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {hasResume ? (
          <button
            type="button"
            onClick={() => onUploaded("keep-existing")}
            className="rounded border border-neutral-700 px-3 py-2 text-sm"
          >
            Keep current
          </button>
        ) : null}
        <button
          type="button"
          disabled={!file || uploading}
          onClick={submit}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload and continue"}
        </button>
      </div>
    </div>
  );
}
