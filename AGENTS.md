# AGENTS.md — rules for AI agents editing josho-hr

Read this file before editing anything under `josho-hr/`. These rules are non-negotiable in this tree.

## Core-lock contract

1. **User-specific logic lives in data, never in code.** Niches, prompts, brand preferences, and templates belong in Postgres rows or Supabase Storage objects — not in files.
2. **No hardcoded identifiers.** Never commit a person's name, email, phone, LinkedIn, or GitHub handle into `web/` or `worker/`. The only allowed hardcoded identity is the Sijoy system-user seed in [supabase/migrations/0004_seed_sijoy_system.sql](supabase/migrations/0004_seed_sijoy_system.sql).
3. **All user-scoped tables must have RLS.** If you add a table referencing `auth.users`, you must add a policy in [supabase/migrations/0002_rls.sql](supabase/migrations/0002_rls.sql) in the same change.
4. **Encrypted columns stay encrypted end-to-end.** Never add a code path that logs, returns, or stores a decrypted user API key, Gmail app password, HMAC secret, or companion token.
5. **Single chokepoint for the Sijoy tax.** Tax enforcement lives only in [worker/tax_trigger.py](worker/tax_trigger.py). Do not duplicate the counter logic anywhere else.

## Gate artifacts

Every `GATE-*` listed in the plan Section 17.1 owns a specific file in this tree. If you touch the file, you are expected to keep every required section heading present — a renamed or removed heading fails the gate. If you add a new gate, add a new file and wire it into [docs/launch-packet.md](docs/launch-packet.md).

## Before committing

- Every user-scoped DB query goes through the Supabase client with the user's JWT, never the `service_role` key (except inside `worker/`).
- Run `gitnexus_impact` on any symbol under `automation/sijoy-os/job_hunter_v2/` that you touch; this tree is allowed to wrap but not modify those modules in Phase 3+.
- Secrets must not appear in diffs. The CI gitleaks step will fail the PR.
- The plan file at `.cursor/plans/josho-hr_multi-tenant_redesign_*.plan.md` is the source of truth for scope. Do not implement features not listed in a phase.

## Phase boundaries

- Phase 1: skeleton only. No runtime logic, no network calls, no DB writes.
- Phase 2+: see plan Section 14 roadmap and Section 17.3 phase-entry contract.
