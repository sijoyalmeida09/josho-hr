# Security (GATE-SEC-01, GATE-SEC-02)

> Owner: Security Engineer. Status: `not_started`.

## Encryption boundary

All sensitive columns are stored as `bytea` encrypted with **AES-256-GCM** in the Node runtime (Vercel) and the Python worker (Fly.io). The symmetric key (`ENCRYPTION_KEY`, 32 bytes, base64-encoded in env) lives only in those two server runtimes and is never shipped to the browser.

Wire format (see [../web/lib/encryption.ts](../web/lib/encryption.ts)):

```
[ version (1 byte = 0x01) | iv (12 bytes) | auth-tag (16 bytes) | ciphertext (N bytes) ]
```

The leading version byte is reserved for future rotation to a new scheme (e.g., AES-256-GCM-SIV or envelope encryption with a KMS) without breaking decrypt paths.

Encrypted columns (must stay in sync with [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql)):

- `user_api_keys.groq_key_encrypted`
- `user_api_keys.openrouter_key_encrypted`
- `user_api_keys.anthropic_key_encrypted`
- `user_api_keys.cerebras_key_encrypted`
- `user_api_keys.mistral_key_encrypted`
- `user_api_keys.gmail_app_pw_encrypted`
- `user_api_keys.telegram_bot_token_encrypted`
- `user_api_keys.linkedin_session_encrypted`
- `user_integrations.hmac_secret_encrypted`
- `companion_tokens.token_hash` (SHA-256 hash, not reversible)

## Key rotation

`ENCRYPTION_KEY` rotation cadence: every 180 days or immediately on suspected compromise. Rotation procedure is documented in [rollback.md](rollback.md) under Feature flag kill-switches (new key, dual-decrypt window, re-encrypt, retire old).

## Secrets distribution

- Vercel: Production + Preview env vars; never committed; never logged.
- Fly.io worker: `fly secrets set ENCRYPTION_KEY=... SUPABASE_SERVICE_ROLE_KEY=...`; never in Dockerfile.
- GitHub Actions: `WORKER_CRON_TOKEN`, `WORKER_BASE_URL` as repository secrets; used only by cron workflows.
- No secret appears in commits — enforced by `gitleaks` in CI.

## Signed URLs

Downloads of resumes, cover letters, and trace zips use Supabase Storage signed URLs with TTL **≤ 300 seconds**. The TTL constant lives in the API route handler and must equal the value documented here.

## Admin access

Direct Postgres access via the Supabase dashboard is restricted to the single maintainer account. All such sessions log to [0005_audit.sql](../supabase/migrations/0005_audit.sql)'s `admin_audit` table through the trigger `fn_admin_audit` on every sensitive table (`user_api_keys`, `user_integrations`, `companion_tokens`, `profiles`, `applications`, `emails`).

## Audit log

`admin_audit` is readable only by the `service_role` and `postgres` roles (RLS policy `admin_audit_no_user_access` denies authenticated users). The log captures role, session user, action, table, and primary key for every admin touch.
