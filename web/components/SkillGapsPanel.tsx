"use client";

import type { ApplicationRow } from "@/lib/hooks/useApplications";

type Gap = { skill: string; action: string; priority: string };

type Props = { application: ApplicationRow | null };

function isGap(x: unknown): x is Gap {
  return (
    typeof x === "object" &&
    x !== null &&
    "skill" in x &&
    typeof (x as Record<string, unknown>).skill === "string"
  );
}

export function SkillGapsPanel({ application }: Props) {
  const raw = application?.skill_gaps;
  const gaps: Gap[] = Array.isArray(raw) ? raw.filter(isGap) : [];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h3 className="text-sm font-semibold">Skill gaps</h3>
        {gaps.length > 0 && (
          <span className="text-xs text-neutral-500">{gaps.length} items</span>
        )}
      </div>
      <ul className="max-h-48 divide-y divide-neutral-900 overflow-y-auto px-4 py-2 text-xs">
        {!application && (
          <li className="py-1 text-neutral-500">No application selected.</li>
        )}
        {application && gaps.length === 0 && (
          <li className="py-1 text-neutral-500">
            No gap analysis yet — worker runs deep_eval after the resume lands.
          </li>
        )}
        {gaps.map((g, i) => (
          <li key={i} className="py-1">
            <span
              className={`mr-2 rounded px-1 text-[10px] uppercase ${
                g.priority === "critical"
                  ? "bg-red-900/40 text-red-300"
                  : g.priority === "high" || g.priority === "required"
                    ? "bg-amber-900/40 text-amber-300"
                    : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {g.priority}
            </span>
            <span className="font-medium text-neutral-200">{g.skill}</span>
            <span className="ml-2 text-neutral-500">{g.action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
