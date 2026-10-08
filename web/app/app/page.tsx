"use client";

import { useMemo, useState } from "react";

import { ApplicationCenter } from "@/components/ApplicationCenter";
import { DashboardPane } from "@/components/DashboardPane";
import { SplitPane } from "@/components/SplitPane";
import { useApplications } from "@/lib/hooks/useApplications";

/**
 * The single-tab split-pane workspace described in plan section 10.
 *
 * Selection model: a single application row is "active" at a time. The
 * left pane shows its detail + Apply controls; the right pane shows
 * rollup KPIs, pipeline, and event timeline for the selected row.
 */
export default function AppWorkspace() {
  const { rows, loading, error } = useApplications();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId]
  );

  if (error === "not_authenticated") {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-200">
        <div className="text-center">
          <p>Session expired.</p>
          <a className="text-sky-400 underline" href="/login">Sign in</a>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen bg-neutral-950 text-neutral-100">
      <SplitPane
        left={
          <ApplicationCenter
            selected={selected}
            loading={loading}
          />
        }
        right={
          <DashboardPane
            rows={rows}
            loading={loading}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        }
      />
    </main>
  );
}
