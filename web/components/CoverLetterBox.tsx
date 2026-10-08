"use client";

import { useEffect, useState } from "react";

import type { ApplicationRow } from "@/lib/hooks/useApplications";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Props = { application: ApplicationRow | null };

export function CoverLetterBox({ application }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
    if (!application) {
      setText(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = getBrowserSupabase();
      // applications.cover_letter_text is the in-row copy; prefer it when present.
      const { data: row } = await supabase
        .from("applications")
        .select("cover_letter_text, cover_letter_storage_path")
        .eq("id", application!.id)
        .maybeSingle();
      if (cancelled) return;
      if (row?.cover_letter_text) {
        setText(row.cover_letter_text);
        setLoading(false);
        return;
      }
      if (row?.cover_letter_storage_path) {
        const { data: signed } = await supabase.storage
          .from("cover_letters")
          .createSignedUrl(row.cover_letter_storage_path, 300);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl);
          if (res.ok) {
            setText(await res.text());
          }
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [application]);

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h3 className="text-sm font-semibold">Cover letter</h3>
        {text && (
          <button
            onClick={copy}
            className="text-xs text-sky-400 underline disabled:opacity-50"
          >
            {copied ? "copied!" : "copy"}
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto px-4 py-3 text-xs text-neutral-300 whitespace-pre-wrap">
        {!application && "No application selected."}
        {application && loading && "loading cover letter…"}
        {application && !loading && !text && (
          <span className="text-neutral-500">
            Worker will generate a cover letter shortly after the job starts.
          </span>
        )}
        {application && !loading && text}
      </div>
    </div>
  );
}
