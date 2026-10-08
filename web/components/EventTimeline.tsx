"use client";

import { useEvents } from "@/lib/hooks/useEvents";

type Props = { applicationId: number | null };

const ICONS: Record<string, string> = {
  form_field_filled: "✎",
  dropdown_selected: "▾",
  file_uploaded: "↑",
  answer_generated: "✦",
  submission_confirmed: "✓",
  error: "!",
};

export function EventTimeline({ applicationId }: Props) {
  const { events, loading } = useEvents(applicationId);

  if (!applicationId) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-xs text-neutral-500">
        Select an application to view its live timeline.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h3 className="text-sm font-semibold">Event timeline</h3>
        <span className="text-xs text-neutral-500">#{applicationId}</span>
      </div>
      <ul className="max-h-72 overflow-y-auto px-4 py-2 text-xs">
        {loading && <li className="text-neutral-500">loading events…</li>}
        {!loading && events.length === 0 && (
          <li className="text-neutral-500">
            No events yet. Worker will stream here as it applies.
          </li>
        )}
        {events.map((ev) => (
          <li key={ev.id} className="flex gap-2 py-1">
            <span className="w-4 text-center text-neutral-500">
              {ICONS[ev.kind] ?? "·"}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-neutral-300">{ev.kind}</span>{" "}
              <span className="text-neutral-500">
                {(ev.payload?.label as string | undefined) ??
                  (ev.payload?.stage as string | undefined) ??
                  (ev.payload?.selector as string | undefined) ??
                  ""}
              </span>
              <div className="text-neutral-600">
                {new Date(ev.at).toLocaleTimeString()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
