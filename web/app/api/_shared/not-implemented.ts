import { NextResponse } from "next/server";

/**
 * Phase 1 API routes respond with a deterministic `501 Not Implemented`
 * and the gate ID that tracks their implementation. This keeps the router
 * wiring reviewable without stubbing fake behaviour.
 */
export function notImplemented(gate: string, phase: number) {
  return NextResponse.json(
    {
      error: "not_implemented",
      gate,
      phase,
      message: `This endpoint lands in Phase ${phase}. Tracked by gate ${gate}.`,
    },
    { status: 501 }
  );
}
