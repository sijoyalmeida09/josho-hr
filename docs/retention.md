# Retention (GATE-COST-02)

> Owner: DevOps / SRE. Status: `not_started`.
> Enforcement: [../.github/workflows/retention-cron.yml](../.github/workflows/retention-cron.yml) runs daily at 03:30 UTC and calls the worker's `/internal/retention` endpoint.

## Retention windows

| Artifact | Window | Storage |
|---|---|---|
| Playwright traces | **≤ 90 days** | `traces/{user_id}/*.zip` |
| Emails | **≤ 365 days** | `public.emails` rows |
| Application events | same as parent application | `public.application_events` rows |
| Application skill gaps | same as parent application | `public.application_skill_gaps` rows |
| Resumes and cover letters | user-controlled (kept until user deletes them or account deletion) | `resumes/`, `cover_letters/` |

## Hard-delete SLA

- Deleted-account purge: **≤ 24 hours** (target: 1 hour)
- Dropped rows cascade via `on delete cascade` on all user-scoped tables
- Storage objects deleted via worker's retention endpoint using `storage.from_(bucket).remove([...])`
- Post-purge verification: nightly cron dumps a count of orphaned paths to `admin_audit.notes`; count must be zero
