# Rollback (GATE-OPS-01)

> Owner: DevOps / SRE. Status: `not_started`.

## Feature flag kill-switches

All feature flags live as Vercel env vars (runtime-switchable without redeploy):

- `FEATURE_TRIAL_POOL_ENABLED` — when `false`, the worker refuses any run backed by the shared pool; users with BYOK continue to work; trial users see a banner.
- `FEATURE_SIJOY_TAX_ENABLED` — when `false`, `tax_trigger.on_user_application_success` returns early without enqueuing a Sijoy run; counter still increments so it can resume cleanly.
- `FEATURE_N8N_OUTBOUND_ENABLED` — when `false`, `n8n_dispatcher.dispatch` skips network I/O and returns `True` immediately.

Flags toggle in Vercel with `vercel env add FEATURE_* production false` and propagate within one request.

## DB rollback

- Supabase CLI: `supabase db reset` is destructive and not usable on prod.
- Procedure: write a reverse migration (`0006_rollback_*.sql`) that is the inverse of the offending change; submit via CODEOWNERS-reviewed PR; apply with `supabase db push`.
- Full point-in-time-recovery is available on Supabase's paid plan only; on free tier, rely on nightly dumps pushed to `backups/` (Phase 5 task).

## Feature-code rollback

- Vercel: use the Deployment dashboard's "Promote previous deployment" — instant rollback of the web tier.
- Fly.io: `fly releases list -a josho-hr-worker` then `fly releases rollback <version>` — ~30s.
- Any rollback is recorded in the incident doc and in `admin_audit` by the maintainer who performed it.

## Cutover (planned maintenance)

1. Flip `FEATURE_*` flags to disable writes for the affected surface.
2. Drain worker queue (wait for `status='running'` count to reach zero).
3. Apply migration or redeploy.
4. Re-enable flags.
5. Replay any `dead_letter` rows manually.
