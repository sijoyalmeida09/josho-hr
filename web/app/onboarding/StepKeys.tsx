"use client";

import { KeysForm } from "../settings/KeysForm";

export function StepKeys({
  onSaved,
  onBack,
}: {
  onSaved: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-lg font-medium">Bring your own API keys (optional)</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Paste your own Groq, OpenRouter, or Anthropic key to skip the
          contribution model and unlock unlimited runs. You can skip this step
          and use the trial pool — we&apos;ll apply for one Sijoy job for every 20
          of yours.
        </p>
      </div>

      <KeysForm />

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
          onClick={onSaved}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
