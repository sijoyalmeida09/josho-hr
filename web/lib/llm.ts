import { serverEnv, featureFlag } from "@/lib/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { decryptFromStorage } from "@/lib/encryption";
import { SLOT_COLUMNS, type LlmProvider } from "@/lib/providers";

/**
 * Minimal, provider-agnostic LLM client for the web tier.
 *
 * Resolution order (per user):
 *   1. If BYOK slot is set and non-null → use it
 *   2. Else if use_trial_pool=true and the trial-pool env var is set → use it
 *   3. Else → throw with a message the caller surfaces as a 402/config error
 *
 * Phase 2 supports Groq + OpenRouter only. Phase 3 worker wires the full
 * 5-provider failover chain via llm_client_multitenant.py.
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
};

const PROVIDER_ENDPOINTS: Record<LlmProvider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
};

const DEFAULT_MODEL: Partial<Record<LlmProvider, string>> = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "anthropic/claude-3.5-haiku",
};

type ResolvedKey = {
  provider: LlmProvider;
  key: string;
  fromTrialPool: boolean;
};

async function resolveKey(userId: string): Promise<ResolvedKey> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  for (const provider of ["groq", "openrouter"] as const) {
    const col = SLOT_COLUMNS[provider];
    const encrypted = data?.[col] as string | null | undefined;
    if (encrypted) {
      const bytes = Buffer.from(
        encrypted.startsWith("\\x") ? encrypted.slice(2) : encrypted,
        "hex"
      );
      return { provider, key: decryptFromStorage(bytes), fromTrialPool: false };
    }
  }

  if (!featureFlag("FEATURE_TRIAL_POOL_ENABLED")) {
    throw new Error("trial_pool_disabled");
  }
  if (data && data.use_trial_pool === false) {
    throw new Error("byok_required");
  }
  if (data && data.trial_calls_remaining <= 0) {
    throw new Error("trial_exhausted");
  }

  const env = serverEnv();
  if (env.TRIAL_POOL_GROQ_KEY) {
    return { provider: "groq", key: env.TRIAL_POOL_GROQ_KEY, fromTrialPool: true };
  }
  if (env.TRIAL_POOL_OPENROUTER_KEY) {
    return { provider: "openrouter", key: env.TRIAL_POOL_OPENROUTER_KEY, fromTrialPool: true };
  }
  throw new Error("no_llm_key_available");
}

export async function chat(
  userId: string,
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<{ content: string; provider: LlmProvider }> {
  const { provider, key, fromTrialPool } = await resolveKey(userId);
  const endpoint = PROVIDER_ENDPOINTS[provider];
  const model = opts.model ?? DEFAULT_MODEL[provider] ?? "llama-3.3-70b-versatile";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.max_tokens ?? 2000,
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${provider} ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error(`${provider} returned empty content`);

  if (fromTrialPool) {
    void bumpTrialQuota(userId, provider);
  }

  return { content, provider };
}

async function bumpTrialQuota(userId: string, provider: LlmProvider) {
  try {
    const admin = getAdminSupabase();
    await admin.rpc("decrement_trial_call", {
      p_user_id: userId,
      p_provider: provider,
    });
  } catch {
    // best-effort — never block the LLM response.
    // The RPC handles all quota tracking atomically.
  }
}
