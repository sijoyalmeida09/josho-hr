"use client";

import { useEffect, useState } from "react";

import type { ApplicationRow } from "@/lib/hooks/useApplications";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Props = { application: ApplicationRow | null };

export function ResumePreview({ application }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!application?.resume_storage_path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    async function sign() {
      setLoading(true);
      const supabase = getBrowserSupabase();
      const { data } = await supabase.storage
        .from("resumes")
        .createSignedUrl(application!.resume_storage_path!, 300);
      if (!cancelled) {
        setUrl(data?.signedUrl ?? null);
        setLoading(false);
      }
    }
    sign();
    return () => {
      cancelled = true;
    };
  }, [application?.resume_storage_path, application]);

  if (!application) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-xs text-neutral-500">
        Resume preview appears after an application is selected.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h3 className="text-sm font-semibold">Tailored resume</h3>
        {url && (
          <a className="text-xs text-sky-400 underline" href={url} target="_blank" rel="noreferrer">
            open PDF
          </a>
        )}
      </div>
      <div className="px-4 py-3 text-xs text-neutral-400">
        {loading && "generating preview link…"}
        {!loading && !application.resume_storage_path && (
          <>Worker will attach a resume shortly after the job starts.</>
        )}
        {!loading && application.resume_storage_path && !url && (
          <>Failed to sign preview URL. Try refreshing.</>
        )}
        {!loading && url && (
          <>
            Path: <code className="text-neutral-500">{application.resume_storage_path}</code>
          </>
        )}
      </div>
    </div>
  );
}
