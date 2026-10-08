# Deploy guide

This is the end-to-end procedure to stand up a **fresh** josho-hr environment.
For incremental updates, only the relevant section applies — the rest is idempotent.

Stack:

| Layer          | Vendor    | Plan          | Purpose                                                  |
| -------------- | --------- | ------------- | -------------------------------------------------------- |
| Auth + DB + Storage + Realtime | Supabase  | Free / Pro   | Postgres 16, RLS, Storage buckets, magic-link auth, Realtime |
| Web (Next.js) | Vercel    | Hobby / Pro   | Hosts `josho-hr/web`                                     |
| Worker        | Fly.io    | Pay-as-you-go | Runs `josho-hr/worker` container (Playwright + Python)   |
| Email digest  | Resend    | Free          | Transactional email for weekly digest                    |
| CI + Crons    | GitHub Actions | Free     | Retention cron, worker enqueue cron, build checks        |

---

## 0. One-time prerequisites

Install locally: `node ≥ 20`, `python ≥ 3.11`, `fly` CLI, `supabase` CLI.

```bash
npm i -g vercel
curl -L https://fly.io/install.sh | sh
npm i -g supabase
```

---

## 1. Supabase

```bash
supabase projects create josho-hr --region us-east-1 --org <your-org>
supabase link --project-ref <ref>
```

Apply migrations in order:

```bash
cd josho-hr
supabase db push
```

This runs `0001_init.sql` → `0002_rls.sql` → `0003_storage_policies.sql` → `0004_seed_sijoy_system.sql` → `0005_audit.sql` → `0006_worker_rpcs.sql` → `0007_phase3_additions.sql`.

Seed the Sijoy system user manually (single row with `is_sijoy_system=true`):

```sql
-- In the Supabase SQL editor, as an admin user you've just created:
update public.profiles
set is_sijoy_system = true
where user_id = '<your admin auth.users.id>';
```

Enable Realtime on `applications`, `application_events`, `user_quota`, `user_api_keys`:

```sql
alter publication supabase_realtime add table public.applications;
alter publication supabase_realtime add table public.application_events;
alter publication supabase_realtime add table public.user_quota;
alter publication supabase_realtime add table public.user_api_keys;
```

---

## 2. Secrets (generate once, share across services)

```bash
# 32-byte symmetric encryption key — used by both web and worker.
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Companion JWT secret.
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Worker cron bearer.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep these in a password manager. The same `ENCRYPTION_KEY` MUST be set on web
AND worker — losing it means no stored key can ever be decrypted again.

---

## 3. Vercel (web tier)

```bash
cd josho-hr/web
vercel link
```

In the Vercel dashboard, set the following environment variables for
Production, Preview, and Development:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_APP_URL=https://<your-domain>
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
ENCRYPTION_KEY=<base64-32B>
COMPANION_TOKEN_SECRET=<base64-48B>
WORKER_CRON_TOKEN=<hex-32B>
TRIAL_POOL_GROQ_KEY=<your groq key for the shared pool>
TRIAL_POOL_OPENROUTER_KEY=<your openrouter key for the shared pool>
RESEND_API_KEY=<resend key>
RESEND_FROM_ADDRESS=josho-hr <digest@your-domain>
FEATURE_TRIAL_POOL_ENABLED=true
FEATURE_SIJOY_TAX_ENABLED=true
FEATURE_N8N_OUTBOUND_ENABLED=true
```

Deploy:

```bash
vercel --prod
```

---

## 4. Fly.io (worker tier)

The worker Dockerfile COPYs from the monorepo root — build context must be
`josho-hr/`, not `josho-hr/worker/`.

```bash
cd the repo root
fly launch --config josho-hr/worker/fly.toml \
           --dockerfile josho-hr/worker/Dockerfile \
           --no-deploy \
           --name josho-hr-worker
```

Set secrets (same `ENCRYPTION_KEY` as Vercel):

```bash
fly secrets set --app josho-hr-worker \
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service-role key> \
  ENCRYPTION_KEY=<base64-32B> \
  TRIAL_POOL_GROQ_KEY=<pool groq> \
  TRIAL_POOL_OPENROUTER_KEY=<pool openrouter>
```

Deploy:

```bash
fly deploy --config josho-hr/worker/fly.toml \
           --dockerfile josho-hr/worker/Dockerfile
```

Verify the health endpoint:

```bash
curl https://josho-hr-worker.fly.dev/health
# {"ok":true,"service":"josho-hr-worker"}
```

---

## 5. GitHub Actions secrets

Set at Repo → Settings → Secrets and variables → Actions:

```
WORKER_CRON_TOKEN   — same hex-32B value used in Vercel env
APP_BASE_URL        — https://<your-domain>
```

Cron jobs:

- `.github/workflows/worker-cron.yml` — every 5 min, POSTs `/api/worker/enqueue`
- `.github/workflows/retention-cron.yml` — daily, POSTs `/api/worker/retention`

Add a weekly digest workflow if you want (same pattern, endpoint `/api/digest`).

---

## 6. First user + Sijoy seed

1. Visit `https://<your-domain>/signup`, enter your email, click the magic link.
2. Complete onboarding (upload resume, generate structured profile).
3. Open SQL editor, set `is_sijoy_system = true` on your profile.
4. Add your Groq / OpenRouter keys in Settings (so your Sijoy runs don't
   consume the trial pool).

Invite-only soft launch: create users manually in Supabase Auth admin OR
turn on `Email OTP` and share the URL with your private list.

---

## 7. Verification after deploy

```bash
# Web
curl -sSf https://<your-domain>/login | head -c 200

# Worker
curl -sSf https://josho-hr-worker.fly.dev/health

# Companion token issue (authenticated; replace cookie)
curl -sSf -H "Cookie: <auth cookie>" -X POST https://<your-domain>/api/companion/token
```

All three must return 200. Then:

- Log in as a test user, click Apply on a dummy job → check Supabase
  `job_runs` for a `queued` row → worker should pick it up within 5 s →
  row becomes `running` then `done`.
- Check `application_events` for the 5–10 events emitted.
- Check `traces` bucket for `<user-id>/<application-id>.zip`.

---

## 8. Rollback

See `docs/rollback.md`. Summary:

- Web: `vercel rollback <prev>`.
- Worker: `fly releases list`, `fly deploy --image <prev>`.
- DB: migrations are forward-only; rollbacks require a new migration that reverses.
