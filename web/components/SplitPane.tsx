"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ReactNode } from "react";

/**
 * Two vertically-resizable panes in a single tab, as described in plan section 10.
 */
export function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <PanelGroup direction="horizontal" className="h-full w-full">
      <Panel defaultSize={55} minSize={30} className="overflow-auto">
        {left}
      </Panel>
      <PanelResizeHandle className="w-px bg-neutral-800 transition-colors hover:bg-neutral-600" />
      <Panel defaultSize={45} minSize={25} className="overflow-auto">
        {right}
      </Panel>
    </PanelGroup>
  );
}
