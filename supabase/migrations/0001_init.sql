-- 0001_init.sql
-- GATE-DATA-01: multi-tenant schema for josho-hr.
-- Tables in this migration must match josho-hr/docs/data-model.md exactly.

create extension if not exists "pgcrypto";

-- profiles ----------------------------------------------------------------
create table if not exists public.profiles (
    user_id uuid primary key references auth.users on delete cascade,
    full_name text,
    email text,
    phone text,
    linkedin text,
    github text,
    location text,
    visa text,
    brand_preference text check (brand_preference in ('hardware', 'software', 'auto', 'custom')) default 'auto',
    structured_data jsonb,
    master_resume_path text,
    onboarding_complete boolean default false,
    is_sijoy_system boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create unique index if not exists profiles_single_sijoy_system
    on public.profiles ((is_sijoy_system))
    where is_sijoy_system = true;

-- user_api_keys -----------------------------------------------------------
create table if not exists public.user_api_keys (
    user_id uuid primary key references auth.users on delete cascade,
    groq_key_encrypted bytea,
    openrouter_key_encrypted bytea,
    anthropic_key_encrypted bytea,
    cerebras_key_encrypted bytea,
    mistral_key_encrypted bytea,
    gmail_address text,
    gmail_app_pw_encrypted bytea,
    telegram_bot_token_encrypted bytea,
    telegram_chat_id text,
    linkedin_session_encrypted bytea,
    use_trial_pool boolean default true,
    trial_calls_remaining int default 100,
    updated_at timestamptz default now()
);

-- user_quota --------------------------------------------------------------
create table if not exists public.user_quota (
    user_id uuid primary key references auth.users on delete cascade,
    apps_since_sijoy_run int default 0,
    cycle_size int default 20,
    total_apps_contributed int default 0,
    updated_at timestamptz default now()
);

-- user_integrations -------------------------------------------------------
create table if not exists public.user_integrations (
    id bigserial primary key,
    user_id uuid not null references auth.users on delete cascade,
    kind text not null check (kind in ('n8n_outbound', 'n8n_inbound', 'zapier')),
    webhook_url text,
    hmac_secret_encrypted bytea,
    enabled boolean default true,
    events text[] default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_user_integrations_user on public.user_integrations (user_id);

-- companion_tokens --------------------------------------------------------
create table if not exists public.companion_tokens (
    id bigserial primary key,
    user_id uuid not null references auth.users on delete cascade,
    token_hash text not null,
    last_used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz default now()
);

create unique index if not exists companion_tokens_hash on public.companion_tokens (token_hash);

-- applications ------------------------------------------------------------
create table if not exists public.applications (
    id bigserial primary key,
    user_id uuid not null references auth.users on delete cascade,
    company text,
    role text,
    location text,
    salary_min int,
    salary_max int,
    url text,
    platform text,
    score int default 0,
    ai_score int default 0,
    legitimacy_score int default 0,
    niche text,
    brand text,
    tier text,
    resume_storage_path text,
    cover_letter_storage_path text,
    cover_letter_text text,
    trace_storage_path text,
    status text default 'scraped',
    applied_at timestamptz,
    response_at timestamptz,
    notes text default '',
    upload_pending boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, url)
);

create index if not exists idx_applications_user_status on public.applications (user_id, status);
create index if not exists idx_applications_user_created on public.applications (user_id, created_at desc);

-- application_events ------------------------------------------------------
create table if not exists public.application_events (
    id bigserial primary key,
    user_id uuid not null,
    application_id bigint not null references public.applications on delete cascade,
    kind text not null,
    payload jsonb not null,
    at timestamptz default now()
);

create index if not exists idx_application_events_app_at on public.application_events (application_id, at);
create index if not exists idx_application_events_payload on public.application_events using gin (payload);

-- application_skill_gaps --------------------------------------------------
create table if not exists public.application_skill_gaps (
    id bigserial primary key,
    user_id uuid not null,
    application_id bigint not null references public.applications on delete cascade,
    missing_skill text,
    required_level text check (required_level in ('nice_to_have', 'required', 'critical')),
    study_suggestion text,
    resources jsonb,
    priority int,
    created_at timestamptz default now()
);

create index if not exists idx_skill_gaps_app on public.application_skill_gaps (application_id);

-- emails ------------------------------------------------------------------
create table if not exists public.emails (
    id bigserial primary key,
    user_id uuid not null,
    application_id bigint references public.applications on delete cascade,
    subject text,
    from_email text,
    classification text,
    received_at timestamptz,
    body_preview text,
    source text default 'builtin' check (source in ('builtin', 'n8n_inbound'))
);

create index if not exists idx_emails_user on public.emails (user_id, received_at desc);

-- job_runs ----------------------------------------------------------------
create table if not exists public.job_runs (
    id bigserial primary key,
    user_id uuid not null,
    kind text check (kind in ('scrape', 'apply', 'email_scan', 'digest', 'resume_build')),
    status text default 'queued' check (status in ('queued', 'running', 'done', 'error', 'dead_letter')),
    started_at timestamptz,
    finished_at timestamptz,
    error_msg text,
    metrics jsonb,
    locked_by text,
    locked_at timestamptz,
    attempt int default 0,
    is_sijoy_tax boolean default false,
    created_at timestamptz default now()
);

create index if not exists idx_job_runs_status_created on public.job_runs (status, created_at);
create index if not exists idx_job_runs_user on public.job_runs (user_id, created_at desc);

-- sijoy_contributions -----------------------------------------------------
create table if not exists public.sijoy_contributions (
    id bigserial primary key,
    contributor_user_id uuid not null,
    sijoy_job_run_id bigint references public.job_runs(id),
    company text,
    role text,
    created_at timestamptz default now()
);

create index if not exists idx_sijoy_contributions_user on public.sijoy_contributions (contributor_user_id);

-- daily_stats -------------------------------------------------------------
create table if not exists public.daily_stats (
    user_id uuid,
    date date,
    total_scraped int default 0,
    total_applied int default 0,
    tier_a int default 0,
    tier_b int default 0,
    interviews int default 0,
    rejections int default 0,
    primary key (user_id, date)
);

-- templates ---------------------------------------------------------------
create table if not exists public.templates (
    id bigserial primary key,
    user_id uuid,
    kind text not null,
    key text not null,
    content jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create unique index if not exists templates_user_kind_key
    on public.templates (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, key);

-- trial_quota_log ---------------------------------------------------------
create table if not exists public.trial_quota_log (
    user_id uuid,
    day date,
    calls_used int default 0,
    provider text,
    primary key (user_id, day, provider)
);

-- updated_at trigger ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end
$$;

do $$
declare
    t text;
begin
    for t in
        select unnest(array[
            'profiles', 'user_api_keys', 'user_quota',
            'user_integrations', 'applications', 'templates'
        ])
    loop
        execute format(
            'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
             create trigger trg_%1$s_updated_at before update on public.%1$s
             for each row execute function public.set_updated_at();',
            t
        );
    end loop;
end
$$;
