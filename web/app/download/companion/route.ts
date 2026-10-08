import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /download/companion
 * Streams the josho_hr_sync.py single-file CLI from the monorepo so the
 * version served always matches the deployed version.
 *
 * Auth-gated so we don't leak the download URL; the file itself is also
 * checked in to the private monorepo.
 */
export async function GET() {
  await requireUser("/settings");

  const candidates = [
    path.resolve(process.cwd(), "..", "companion", "josho_hr_sync.py"),
    path.resolve(process.cwd(), "..", "..", "josho-hr", "companion", "josho_hr_sync.py"),
    path.resolve(process.cwd(), "companion", "josho_hr_sync.py"),
  ];

  let body: Buffer | null = null;
  for (const p of candidates) {
    try {
      body = await readFile(p);
      break;
    } catch {
      // try next
    }
  }

  if (!body) {
    return NextResponse.json({ error: "companion script not found" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": "text/x-python; charset=utf-8",
      "Content-Disposition": 'attachment; filename="josho_hr_sync.py"',
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
