-- 0004_seed_sijoy_system.sql
-- Seeds:
--   1. System niche templates (user_id IS NULL) mirrored from
--      automation/sijoy-os/job_hunter_v2/templates/niches/__init__.py
--   2. The Sijoy system user profile used for 20:1 tax-triggered applications.
--
-- Sijoy's personal structured_data is intentionally left as an empty JSON
-- object here. The real values are loaded in Phase 3 by an admin-only script
-- that reads automation/sijoy-os/job_hunter_v2/resume_data.py and uploads
-- them into this row. Do not inline any personal data in this migration.

-- 1. System niche templates --------------------------------------------------
-- key = niche slug, content.summary + top_projects + top_skills + bullet_boost
insert into public.templates (user_id, kind, key, content)
values
    (null, 'niche', 'default', '{"summary":"","top_projects":[],"top_skills":[],"bullet_boost":[]}'::jsonb)
on conflict do nothing;

-- 2. Sijoy system user profile placeholder -----------------------------------
-- The matching auth.users row is created manually by the maintainer after
-- deploying the project so we do not hardcode a user UUID here.
-- Phase 3 admin script will UPDATE this row by joining on email match
-- against the stored Sijoy account.

-- Sentinel row enabling the partial unique index `profiles_single_sijoy_system`
-- to work without violating FK if no Sijoy user exists yet.

-- A placeholder auth.users row cannot be inserted directly from a migration
-- safely (Supabase manages that table), so this section is intentionally a
-- no-op. The admin UI at /admin/seed-sijoy (phase 3) performs the insert.

comment on column public.profiles.is_sijoy_system is
    'Exactly one profile row may set this flag to true. That profile is the target of 20:1 Sijoy-tax application runs and is seeded via the Phase 3 admin tool, not this migration.';
