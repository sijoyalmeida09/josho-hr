# Architecture

> Snapshot view of the topology the plan prescribes. See the canonical plan Section 2 for full reasoning.

## Topology

```
             +-----------------------------+
             |        User browser         |
             +--------------+--------------+
                            | HTTPS (JWT cookie)
                            v
                   +-----------------+
                   |  Vercel (web)   |  Next.js 15 App Router
                   |  josho-hr/web   |  RLS-scoped Supabase client
                   +--------+--------+
                            |
                            | SQL + Storage via PostgREST
                            v
                   +-----------------+
                   | Supabase (DB +  |  Postgres 15, RLS on every table
                   | Auth + Storage) |  pgcrypto-encrypted columns
                   +--------+--------+
                            ^
                            | service_role JWT
                            |
                   +--------+--------+
                   | Fly.io (worker) |  Python 3.11 + Playwright
                   | josho-hr/worker |  Wraps job_hunter_v2 modules
                   +--------+--------+
                            ^
                            | cron trigger
                   +--------+--------+
                   | GitHub Actions  |  worker-cron + retention-cron
                   +-----------------+

  Optional, per-user:
    Companion CLI  --> syncs  ~/josho-hr/  <--> Supabase Storage
    User's own n8n --> POSTs  email events -->  /api/webhooks/n8n/email
                   <-- receives event webhooks <-- worker dispatcher
```

## Code-lock boundary

- All user-visible behaviour is controlled by **data** (DB rows, Storage objects, UI settings).
- No code in this tree reads hardcoded personal identifiers.
- The only surface that users can push code into is their own n8n instance. It is sandboxed at the HMAC boundary.

## Trust boundaries

1. Browser ↔ Vercel: HTTPS + signed Supabase auth cookies; RLS enforced server-side.
2. Vercel ↔ Supabase: PostgREST with caller's JWT; never the service_role key from the web tier's edge runtime.
3. Worker ↔ Supabase: service_role (bypass RLS) — worker must always filter by `user_id`.
4. Worker ↔ user's n8n: outbound HMAC-signed POST + idempotency header.
5. User's n8n ↔ Vercel: inbound HMAC verification + idempotency check + 5-minute replay window.
6. Companion CLI ↔ Supabase: user-scoped JWT (aud='companion'); RLS still enforced.
