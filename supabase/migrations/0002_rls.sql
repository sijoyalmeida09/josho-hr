-- 0002_rls.sql
-- GATE-DATA-02: row-level security on every user-scoped table.
-- Verification: josho-hr/web/__tests__/rls.isolation.test.ts must prove
-- user A cannot read any row belonging to user B across all tables below.

-- Enable RLS on every user-scoped table --------------------------------------
alter table public.profiles              enable row level security;
alter table public.user_api_keys         enable row level security;
alter table public.user_quota            enable row level security;
alter table public.user_integrations     enable row level security;
alter table public.companion_tokens      enable row level security;
alter table public.applications          enable row level security;
alter table public.application_events    enable row level security;
alter table public.application_skill_gaps enable row level security;
alter table public.emails                enable row level security;
alter table public.job_runs              enable row level security;
alter table public.sijoy_contributions   enable row level security;
alter table public.daily_stats           enable row level security;
alter table public.templates             enable row level security;
alter table public.trial_quota_log       enable row level security;

-- Policy pattern --------------------------------------------------------------
-- Every policy below is:
--   using     (user_id = auth.uid())
--   with check(user_id = auth.uid())
-- The service_role key bypasses RLS and is used only by the worker.

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_api_keys --------------------------------------------------------------
drop policy if exists user_api_keys_owner on public.user_api_keys;
create policy user_api_keys_owner on public.user_api_keys
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_quota -----------------------------------------------------------------
drop policy if exists user_quota_owner on public.user_quota;
create policy user_quota_owner on public.user_quota
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_integrations ----------------------------------------------------------
drop policy if exists user_integrations_owner on public.user_integrations;
create policy user_integrations_owner on public.user_integrations
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- companion_tokens -----------------------------------------------------------
drop policy if exists companion_tokens_owner on public.companion_tokens;
create policy companion_tokens_owner on public.companion_tokens
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- applications ---------------------------------------------------------------
drop policy if exists applications_owner on public.applications;
create policy applications_owner on public.applications
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- application_events ---------------------------------------------------------
drop policy if exists application_events_owner on public.application_events;
create policy application_events_owner on public.application_events
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- application_skill_gaps -----------------------------------------------------
drop policy if exists application_skill_gaps_owner on public.application_skill_gaps;
create policy application_skill_gaps_owner on public.application_skill_gaps
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- emails ---------------------------------------------------------------------
drop policy if exists emails_owner on public.emails;
create policy emails_owner on public.emails
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- job_runs -------------------------------------------------------------------
drop policy if exists job_runs_owner on public.job_runs;
create policy job_runs_owner on public.job_runs
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- sijoy_contributions --------------------------------------------------------
-- Contributors can see their OWN contribution rows; company/role of Sijoy's
-- target are redacted at the API layer in the /api/sijoy-contributions route.
drop policy if exists sijoy_contributions_owner on public.sijoy_contributions;
create policy sijoy_contributions_owner on public.sijoy_contributions
    for select using (contributor_user_id = auth.uid());

-- daily_stats ----------------------------------------------------------------
drop policy if exists daily_stats_owner on public.daily_stats;
create policy daily_stats_owner on public.daily_stats
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- templates ------------------------------------------------------------------
-- user_id NULL means a system template: everyone can SELECT, nobody can UPDATE.
drop policy if exists templates_select_system_or_own on public.templates;
create policy templates_select_system_or_own on public.templates
    for select using (user_id is null or user_id = auth.uid());

drop policy if exists templates_owner_write on public.templates;
create policy templates_owner_write on public.templates
    for insert with check (user_id = auth.uid());

drop policy if exists templates_owner_update on public.templates;
create policy templates_owner_update on public.templates
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists templates_owner_delete on public.templates;
create policy templates_owner_delete on public.templates
    for delete using (user_id = auth.uid());

-- trial_quota_log ------------------------------------------------------------
drop policy if exists trial_quota_log_owner on public.trial_quota_log;
create policy trial_quota_log_owner on public.trial_quota_log
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
