# Data model (GATE-DATA-01, GATE-DATA-03)

> Owner: Database Engineer. Status: `not_started`.
> Authoritative SQL: [../supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql).

## Tables

- `auth.users` — managed by Supabase Auth
- `public.profiles` — one row per user; holds parsed resume as `structured_data` JSONB; flag `is_sijoy_system` marks the single target of the contribution model
- `public.user_api_keys` — BYOK and trial-pool state; all provider keys as `bytea` encrypted
- `public.user_quota` — per-user counter for 20:1 contribution model
- `public.user_integrations` — n8n (inbound/outbound) and future Zapier config; `hmac_secret_encrypted`
- `public.companion_tokens` — sha256 hashes of issued companion JWTs; supports rotation
- `public.applications` — one row per job application; references resume/cover-letter/trace paths in Storage
- `public.application_events` — append-only structured event stream per application (GATE-DATA-03)
- `public.application_skill_gaps` — "what to study next" per application
- `public.emails` — classified emails, either from builtin scanner or user's n8n
- `public.job_runs` — queue rows consumed by the worker (queued / running / done / error / dead_letter)
- `public.sijoy_contributions` — attribution rows for contributor badge; never exposes Sijoy's target company
- `public.daily_stats` — aggregate rollups per user per day
- `public.templates` — niches + cover-letter hooks; `user_id IS NULL` means a system template
- `public.trial_quota_log` — per-user per-provider daily call count for trial pool

## Relationships

- `profiles.user_id FK auth.users` (cascade)
- `user_api_keys.user_id FK auth.users` (cascade)
- `user_quota.user_id FK auth.users` (cascade)
- `user_integrations.user_id FK auth.users` (cascade)
- `companion_tokens.user_id FK auth.users` (cascade)
- `applications.user_id FK auth.users` (cascade), unique (user_id, url)
- `application_events.application_id FK applications` (cascade)
- `application_skill_gaps.application_id FK applications` (cascade)
- `emails.application_id FK applications` (cascade, nullable)
- `sijoy_contributions.sijoy_job_run_id FK job_runs`

## Indexes

- `idx_applications_user_status (user_id, status)`
- `idx_applications_user_created (user_id, created_at desc)`
- `idx_application_events_app_at (application_id, at)`
- `idx_application_events_payload GIN (payload)` — GATE-DATA-01 hard requirement
- `idx_emails_user (user_id, received_at desc)`
- `idx_job_runs_status_created (status, created_at)`
- `idx_job_runs_user (user_id, created_at desc)`
- `idx_sijoy_contributions_user (contributor_user_id)`
- Unique partial `profiles_single_sijoy_system (is_sijoy_system) where is_sijoy_system`
- Unique `templates_user_kind_key (coalesce(user_id, 0-uuid), kind, key)`

## Event taxonomy v1

`eventTaxonomy = "v1"`. Frozen. Adding a new kind is a schema bump and requires a CHANGELOG entry plus a worker `event_emitter.KINDS` update.

| kind | payload schema |
|---|---|
| `form_field_filled` | `{"selector": string, "label": string, "value_redacted": bool, "source": "user"\|"llm"\|"learned"}` |
| `dropdown_selected` | `{"selector": string, "label": string, "option": string, "source": "llm"\|"learned"}` |
| `file_uploaded` | `{"selector": string, "kind": "resume"\|"cover_letter"\|"other", "bytes": int}` |
| `answer_generated` | `{"prompt_hash": string, "provider": string, "question": string, "answer_preview": string}` |
| `submission_confirmed` | `{"confirmation_id": string, "platform": string, "url": string}` |
| `error` | `{"stage": string, "message": string, "retry": int}` |
