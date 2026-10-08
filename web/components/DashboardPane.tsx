"use client";

import { useMemo } from "react";

import type { ApplicationRow } from "@/lib/hooks/useApplications";

import { EventTimeline } from "./EventTimeline";
import { SijoyTaxBar } from "./SijoyTaxBar";

type Props = {
  rows: ApplicationRow[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "submitted"
      ? "bg-emerald-500"
      : status === "running"
        ? "bg-amber-400 animate-pulse"
        : status === "queued"
          ? "bg-sky-400"
          : status === "failed"
            ? "bg-red-500"
            : "bg-neutral-600";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function DashboardPane({ rows, loading, selectedId, onSelect }: Props) {
  const rollup = useMemo(() => {
    const now = Date.now();
    const horizon = now - 30 * 24 * 60 * 60 * 1000;
    const recent = rows.filter((r) => new Date(r.created_at).getTime() >= horizon);
    return {
      scraped: recent.length,
      applied: recent.filter((r) => r.status === "submitted").length,
      interviewing: recent.filter((r) => r.status === "interviewing").length,
      offer: recent.filter((r) => r.status === "offer").length,
      running: rows.filter((r) => r.status === "running").length,
      queued: rows.filter((r) => r.status === "queued").length,
    };
  }, [rows]);

  return (
    <section className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <span className="text-xs text-neutral-500">Last 30 days</span>
      </header>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Scraped", value: rollup.scraped },
          { label: "Applied", value: rollup.applied },
          { label: "Interviews", value: rollup.interviewing },
          { label: "Offers", value: rollup.offer },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-3"
          >
            <div className="text-xs text-neutral-500">{label}</div>
            <div className="text-2xl font-semibold">{loading ? "…" : value}</div>
          </div>
        ))}
      </div>

      <SijoyTaxBar />
      <EventTimeline applicationId={selectedId} />

      <div className="rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
          <h3 className="text-sm font-semibold">Recent applications</h3>
          <span className="text-xs text-neutral-500">
            {rollup.running > 0 && <>{rollup.running} running · </>}
            {rollup.queued > 0 && <>{rollup.queued} queued</>}
          </span>
        </div>
        <ul className="max-h-80 divide-y divide-neutral-900 overflow-y-auto">
          {loading && <li className="px-4 py-3 text-sm text-neutral-500">loading…</li>}
          {!loading && rows.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-500">
              No applications yet. Paste a job on the left and click Apply.
            </li>
          )}
          {rows.slice(0, 50).map((r) => (
            <li
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-neutral-900/50 ${
                r.id === selectedId ? "bg-neutral-900/70" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <StatusDot status={r.status} />
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {r.role ?? "—"}{" "}
                    <span className="text-neutral-500">@ {r.company ?? "—"}</span>
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    {r.status} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
