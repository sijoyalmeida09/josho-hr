# Launch packet

> Owner: Architect. Status: `in_review` (Phase 3–5 code complete; non-code gates require sign-off).
> This is the bundle of required, signed artifacts that must all be `passed` before the public launch. Mirrors plan Section 17.5.

## Gate index (post-Phase 5)

| ID | Area | Artifact | Status | Notes |
|---|---|---|---|---|
| GATE-POLICY-01 | Product | [policy.md](policy.md) | `draft` | Content is skeleton — PM must fill niches, cadence, cool-off rules before soft launch. |
| GATE-LEGAL-01  | Legal   | [terms.md](terms.md) + [../web/app/terms/page.tsx](../web/app/terms/page.tsx) | `soft_launch_ok` | Plain-English Terms shipped at `/terms` for soft launch. Counsel review still required for public launch. |
| GATE-LEGAL-02  | Legal   | [privacy.md](privacy.md) + [retention.md](retention.md) + [../web/app/privacy/page.tsx](../web/app/privacy/page.tsx) | `soft_launch_ok` | Plain-English Privacy notice now renders at `/privacy` (matching the link in `/signup`). Retention cron + delete + export endpoints already live. Counsel review still required for public launch. |
| GATE-SEC-01    | Security | [security.md](security.md) + [../web/lib/encryption.ts](../web/lib/encryption.ts) + [../worker/encryption.py](../worker/encryption.py) | `passed` | AES-256-GCM implementations are byte-compatible; encryption roundtrip tests green on both tiers. |
| GATE-SEC-02    | Security | [security.md](security.md) + [../supabase/migrations/0005_audit.sql](../supabase/migrations/0005_audit.sql) | `passed` | admin_audit triggers present on sensitive tables; RLS enabled across all user-scoped tables. |
| GATE-DATA-01   | Data | [data-model.md](data-model.md) + [../supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql) + [../supabase/migrations/0007_phase3_additions.sql](../supabase/migrations/0007_phase3_additions.sql) | `passed` | Schema matches doc after 0007 additive migration. |
| GATE-DATA-02   | Data | [../supabase/migrations/0002_rls.sql](../supabase/migrations/0002_rls.sql) + [../web/__tests__/rls.isolation.test.ts](../web/__tests__/rls.isolation.test.ts) | `ready_to_run` | Test body implemented (8 assertions across 14 tables + 3 storage buckets). Auto-skips when `TEST_SUPABASE_*` env vars are missing. Marked `passed` once executed green against a real test Supabase project — see [SOFT_LAUNCH_RUNBOOK.md](SOFT_LAUNCH_RUNBOOK.md) step 2. |
| GATE-DATA-03   | Data | [data-model.md](data-model.md) `## Event taxonomy v1` + [../worker/event_emitter.py](../worker/event_emitter.py) | `passed` | KINDS tuple in event_emitter matches doc; rejecting unknown kinds is unit-tested. |
| GATE-REL-01    | Reliability | [runbook.md](runbook.md) + [../worker/tax_trigger.py](../worker/tax_trigger.py) | `passed` | Single tax chokepoint enforced; cycle math tested. |
| GATE-REL-02    | Reliability | [ux-failure-modes.md](ux-failure-modes.md) + trace-size cap | `passed` | trace_capture.py enforces MAX_TRACE_SIZE_MB; oversized traces emit an `error` event. |
| GATE-COST-01   | Cost | [limits.md](limits.md) + [../worker/config/limits.py](../worker/config/limits.py) | `passed` | Limits constants consumed by worker; retention constants mirrored in [../web/lib/retention.ts](../web/lib/retention.ts). |
| GATE-COST-02   | Cost | [retention.md](retention.md) + [../.github/workflows/retention-cron.yml](../.github/workflows/retention-cron.yml) + [/api/worker/retention](../web/app/api/worker/retention/route.ts) | `passed` | Retention job implemented end-to-end; schedule: daily 03:00 UTC. |
| GATE-INT-01    | Integrations | [n8n-integration.md](n8n-integration.md) + [../worker/n8n_dispatcher.py](../worker/n8n_dispatcher.py) + [../n8n-templates/16-josho-hr-email-tracker.json](../n8n-templates/16-josho-hr-email-tracker.json) | `passed` | Contract v1 stable; HMAC signing + 3-attempt retry + DLQ unit-tested. |
| GATE-INT-02    | Integrations | [companion.md](companion.md) + [../companion/josho_hr_sync.py](../companion/josho_hr_sync.py) | `passed` | Companion CLI round-trips manifest + signed URLs + inbox upload. |
| GATE-OBS-01    | Operations | [observability.md](observability.md) | `draft` | Logs emit structured fields; dashboards not yet provisioned in Supabase / Fly. |
| GATE-OPS-01    | Operations | [rollback.md](rollback.md) + [deploy.md](deploy.md) | `passed` | Rollback procedure documented; deploy guide complete. |

## Signoff (required for Go)

All of the following must link to a commit on `main` where the document's pass-rule verification passes:

- [ ] [security-signoff.md](security-signoff.md) — signed by Security Engineer
- [ ] [reliability-report.md](reliability-report.md) — signed by Backend + DevOps
- [ ] [incident-playbook.md](incident-playbook.md) — signed by DevOps + Architect

## Decision matrix (as of Phase 5 code-complete)

- **Go**: all 16 gates `passed`, KPIs above minimums (plan 17.4). **Not met yet** — 4 gates in `draft` or `in_review` (POLICY-01, LEGAL-01, LEGAL-02, DATA-02, OBS-01).
- **Conditional Go**: GATE-POLICY-01, GATE-LEGAL-01, GATE-LEGAL-02, GATE-SEC-01, GATE-SEC-02, GATE-DATA-02 `passed` AND open issues are cosmetic only. Issue written commitment to close gaps within 2 weeks, invite-gate the soft launch.
- **No-Go**: any of those six failing.

**Current recommendation**: **No-Go for public launch**; **Conditional Go for invite-only soft launch** once:

1. GATE-DATA-02 `rls.isolation.test.ts` is run against two real Supabase accounts and passes.
2. GATE-LEGAL-01 + GATE-LEGAL-02 have at minimum a reviewed Privacy Notice visible on `/signup`.
3. GATE-OBS-01 dashboard exists with queue depth, DLQ count, LLM error rate.
