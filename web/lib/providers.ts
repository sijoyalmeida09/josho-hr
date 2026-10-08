/**
 * Canonical provider slugs used in API payloads, DB column suffixes, and
 * worker config. Any change here requires a migration bumping the column
 * names in `user_api_keys` and updating the worker's `llm_client_multitenant.py`.
 */

export const LLM_PROVIDERS = [
  "groq",
  "openrouter",
  "anthropic",
  "cerebras",
  "mistral",
] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const SECRET_SLOTS = [
  ...LLM_PROVIDERS,
  "gmail_app_pw",
  "telegram_bot_token",
] as const;
export type SecretSlot = (typeof SECRET_SLOTS)[number];

export const SLOT_COLUMNS: Record<SecretSlot, string> = {
  groq: "groq_key_encrypted",
  openrouter: "openrouter_key_encrypted",
  anthropic: "anthropic_key_encrypted",
  cerebras: "cerebras_key_encrypted",
  mistral: "mistral_key_encrypted",
  gmail_app_pw: "gmail_app_pw_encrypted",
  telegram_bot_token: "telegram_bot_token_encrypted",
};

export function isSecretSlot(value: unknown): value is SecretSlot {
  return typeof value === "string" && (SECRET_SLOTS as readonly string[]).includes(value);
}
