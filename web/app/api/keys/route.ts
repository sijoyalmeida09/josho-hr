import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { encryptForStorage, bufferToPgHex } from "@/lib/encryption";
import { SECRET_SLOTS, SLOT_COLUMNS, isSecretSlot } from "@/lib/providers";

export const runtime = "nodejs";

/**
 * GET /api/keys
 *   Response: { <slot>: boolean, use_trial_pool: boolean, trial_calls_remaining: number }
 *   — never returns plaintext key values.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const slots: Record<string, boolean> = {};
  for (const slot of SECRET_SLOTS) {
    slots[slot] = Boolean(data && data[SLOT_COLUMNS[slot]]);
  }

  return NextResponse.json({
    ...slots,
    use_trial_pool: data?.use_trial_pool ?? true,
    trial_calls_remaining: data?.trial_calls_remaining ?? 100,
    gmail_address: data?.gmail_address ?? null,
    telegram_chat_id: data?.telegram_chat_id ?? null,
  });
}

const postSchema = z.object({
  slot: z.string().refine(isSecretSlot, "unknown slot"),
  value: z.string().min(1).max(4000),
  gmail_address: z.string().email().optional(),
  telegram_chat_id: z.string().optional(),
  use_trial_pool: z.boolean().optional(),
});

/**
 * POST /api/keys
 *   Body: { slot: SecretSlot, value: string, use_trial_pool?, gmail_address?, telegram_chat_id? }
 *   Encrypts the value server-side and upserts into user_api_keys.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const column = SLOT_COLUMNS[parsed.data.slot];
  const encrypted = encryptForStorage(parsed.data.value);

  const admin = getAdminSupabase();
  const update: Record<string, unknown> = {
    user_id: user.id,
    [column]: bufferToPgHex(encrypted),
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.gmail_address) update.gmail_address = parsed.data.gmail_address;
  if (parsed.data.telegram_chat_id) update.telegram_chat_id = parsed.data.telegram_chat_id;
  if (typeof parsed.data.use_trial_pool === "boolean") {
    update.use_trial_pool = parsed.data.use_trial_pool;
  }

  const { error } = await admin.from("user_api_keys").upsert(update);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slot: parsed.data.slot });
}

const deleteSchema = z.object({
  slot: z.string().refine(isSecretSlot, "unknown slot").optional(),
});

/**
 * DELETE /api/keys?slot=<slot>
 *   Clears one slot, or all slots if no slot is provided.
 */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = deleteSchema.safeParse({ slot: url.searchParams.get("slot") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid slot" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.slot) {
    update[SLOT_COLUMNS[parsed.data.slot]] = null;
  } else {
    for (const s of SECRET_SLOTS) update[SLOT_COLUMNS[s]] = null;
    update.use_trial_pool = true;
  }

  const { error } = await admin
    .from("user_api_keys")
    .upsert({ user_id: user.id, ...update });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
