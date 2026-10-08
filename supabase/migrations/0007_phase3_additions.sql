-- 0007_phase3_additions.sql
-- Non-breaking additions required by Phase 3 worker + web tier.
-- No column is dropped, no type is changed; everything is additive.

-- applications: fields that the wrappers write back
alter table public.applications
    add column if not exists job_url text,
    add column if not exists ats_platform text,
    add column if not exists source text default 'manual',
    add column if not exists job_snapshot jsonb,
    add column if not exists skill_gaps jsonb,
    add column if not exists confirmation text;

-- Backfill: keep job_url and url in sync on insert (one-way is fine here).
update public.applications
set job_url = url
where job_url is null and url is not null;

-- Keep a partial index for quick filter by status on modern timestamp.
create index if not exists idx_applications_user_applied_at
    on public.applications (user_id, applied_at desc nulls last);

-- application_events: the worker emits with `created_at`; provide a generated
-- column so both `at` and `created_at` are queryable without a migration risk.
alter table public.application_events
    add column if not exists created_at timestamptz default now();

update public.application_events
set created_at = at
where created_at is null;

-- job_runs: worker consumes `params` jsonb (job payload + application_id).
alter table public.job_runs
    add column if not exists params jsonb default '{}'::jsonb;

-- Extended event kind constraint (the previous migration didn't constrain).
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'application_events_kind_v1'
    ) then
        alter table public.application_events
            add constraint application_events_kind_v1
            check (kind in (
                'form_field_filled',
                'dropdown_selected',
                'file_uploaded',
                'answer_generated',
                'submission_confirmed',
                'error'
            ));
    end if;
end
$$;

-- emails: retention cron sets body_scrubbed=true after 30 days.
alter table public.emails
    add column if not exists body boolean default null,  -- no-op placeholder
    add column if not exists body_scrubbed boolean default false;

-- Revert the accidental `body` add above to a proper column if it came in wrong.
-- (idempotent: if body already existed it stays.)
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'emails' and column_name = 'body' and data_type = 'boolean'
    ) then
        alter table public.emails drop column body;
        alter table public.emails add column body text;
    end if;
end
$$;
