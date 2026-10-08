import { z } from "zod";

/**
 * Typed, validated environment loader.
 *
 * Usage (server-side only):
 *   import { serverEnv } from "@/lib/env";
 *   serverEnv.SUPABASE_SERVICE_ROLE_KEY
 *
 * Throws at import time if a required env var is missing, which fails the
 * Vercel build rather than producing runtime surprises.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ENCRYPTION_KEY: z
    .string()
    .min(32, "ENCRYPTION_KEY must be base64-encoded 32 bytes minimum")
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "ENCRYPTION_KEY must decode to exactly 32 bytes",
    }),
  COMPANION_TOKEN_SECRET: z.string().min(32),
  N8N_OUTBOUND_HMAC_KEY: z.string().optional(),
  TRIAL_POOL_GROQ_KEY: z.string().optional(),
  TRIAL_POOL_OPENROUTER_KEY: z.string().optional(),
  WORKER_BASE_URL: z.string().url().optional(),
  WORKER_CRON_TOKEN: z.string().optional(),
  FEATURE_TRIAL_POOL_ENABLED: z.enum(["true", "false"]).default("true"),
  FEATURE_SIJOY_TAX_ENABLED: z.enum(["true", "false"]).default("true"),
  FEATURE_N8N_OUTBOUND_ENABLED: z.enum(["true", "false"]).default("true"),
});

export const publicEnv = (() => {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public env: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }
  return parsed.data;
})();

let _serverEnv: z.infer<typeof serverSchema> | null = null;

export function serverEnv(): z.infer<typeof serverSchema> {
  if (_serverEnv) return _serverEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server env: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }
  _serverEnv = parsed.data;
  return _serverEnv;
}

export function featureFlag(
  name: "FEATURE_TRIAL_POOL_ENABLED" | "FEATURE_SIJOY_TAX_ENABLED" | "FEATURE_N8N_OUTBOUND_ENABLED"
): boolean {
  return serverEnv()[name] === "true";
}
