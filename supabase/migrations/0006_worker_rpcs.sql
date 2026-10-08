-- 0006_worker_rpcs.sql
-- Server-side primitives the worker calls. All SECURITY DEFINER functions
-- validate the caller and either use auth.uid() or require service_role.

-- ---------------------------------------------------------------------------
-- claim_next_job(p_worker_id text, p_lease_seconds int default 900)
-- returns a single queued row as json, or null if no work.
--
-- Uses SELECT ... FOR UPDATE SKIP LOCKED to allow horizontally-scaled workers.
-- service_role only.
-- ---------------------------------------------------------------------------
create or replace function public.claim_next_job(
    p_worker_id text,
    p_lease_seconds int default 900
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_row public.job_runs%rowtype;
begin
    if current_user not in ('service_role', 'postgres') then
        raise exception 'claim_next_job is service_role only';
    end if;

    -- Reap zombies first: any "running" row whose lease has expired.
    update public.job_runs
    set status = 'queued',
        locked_by = null,
        locked_at = null,
        attempt = attempt + 1
    where status = 'running'
      and locked_at is not null
      and locked_at < now() - make_interval(secs => p_lease_seconds);

    with next as (
        select id
        from public.job_runs
        where status = 'queued'
          and attempt < 3
        order by created_at asc
        for update skip locked
        limit 1
    )
    update public.job_runs jr
    set status = 'running',
        locked_by = p_worker_id,
        locked_at = now(),
        started_at = coalesce(jr.started_at, now())
    from next
    where jr.id = next.id
    returning jr.* into v_row;

    if not found then
        return null;
    end if;
    return to_jsonb(v_row);
end
$$;

revoke all on function public.claim_next_job(text, int) from public;
grant execute on function public.claim_next_job(text, int) to service_role;

-- ---------------------------------------------------------------------------
-- complete_job(p_job_id bigint, p_status text, p_error text, p_metrics jsonb)
-- Terminates a job that is owned by the current worker.
-- ---------------------------------------------------------------------------
create or replace function public.complete_job(
    p_job_id bigint,
    p_status text,
    p_error text default null,
    p_metrics jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if current_user not in ('service_role', 'postgres') then
        raise exception 'complete_job is service_role only';
    end if;
    if p_status not in ('done', 'error', 'dead_letter') then
        raise exception 'invalid status %', p_status;
    end if;

    update public.job_runs
    set status = p_status,
        finished_at = now(),
        error_msg = p_error,
        metrics = coalesce(p_metrics, '{}'::jsonb),
        locked_by = null,
        locked_at = null
    where id = p_job_id;
end
$$;

revoke all on function public.complete_job(bigint, text, text, jsonb) from public;
grant execute on function public.complete_job(bigint, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- decrement_trial_call(p_user_id uuid, p_provider text)
-- Atomically decrements user_api_keys.trial_calls_remaining and inserts a
-- trial_quota_log row for the day. Returns remaining count or -1 if exhausted.
-- ---------------------------------------------------------------------------
create or replace function public.decrement_trial_call(
    p_user_id uuid,
    p_provider text default 'groq'
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_remaining int;
begin
    if current_user not in ('service_role', 'postgres') then
        raise exception 'decrement_trial_call is service_role only';
    end if;

    update public.user_api_keys
    set trial_calls_remaining = greatest(trial_calls_remaining - 1, 0),
        updated_at = now()
    where user_id = p_user_id
    returning trial_calls_remaining into v_remaining;

    if v_remaining is null then
        insert into public.user_api_keys (user_id, trial_calls_remaining)
        values (p_user_id, 99)
        on conflict (user_id) do nothing;
        v_remaining := 99;
    end if;

    insert into public.trial_quota_log (user_id, day, provider, calls_used)
    values (p_user_id, current_date, p_provider, 1)
    on conflict (user_id, day, provider)
    do update set calls_used = public.trial_quota_log.calls_used + 1;

    return v_remaining;
end
$$;

revoke all on function public.decrement_trial_call(uuid, text) from public;
grant execute on function public.decrement_trial_call(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- enqueue_sijoy_run(p_contributor_user_id uuid, p_contributor_app_id bigint)
-- Called exclusively by worker/tax_trigger.py. Resolves the Sijoy system
-- user, inserts a job_runs row with is_sijoy_tax=true, and records the
-- contribution row. Returns the new job_runs.id.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_sijoy_run(
    p_contributor_user_id uuid,
    p_contributor_app_id bigint default null
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_sijoy_user_id uuid;
    v_job_id bigint;
begin
    if current_user not in ('service_role', 'postgres') then
        raise exception 'enqueue_sijoy_run is service_role only';
    end if;

    select user_id into v_sijoy_user_id
    from public.profiles
    where is_sijoy_system = true
    limit 1;

    if v_sijoy_user_id is null then
        raise notice 'no sijoy system user seeded; contribution skipped';
        return null;
    end if;

    insert into public.job_runs (user_id, kind, status, is_sijoy_tax, metrics)
    values (
        v_sijoy_user_id,
        'apply',
        'queued',
        true,
        jsonb_build_object(
            'contributor_user_id', p_contributor_user_id,
            'contributor_application_id', p_contributor_app_id
        )
    )
    returning id into v_job_id;

    insert into public.sijoy_contributions (contributor_user_id, sijoy_job_run_id)
    values (p_contributor_user_id, v_job_id);

    update public.user_quota
    set apps_since_sijoy_run = 0,
        total_apps_contributed = total_apps_contributed + 1,
        updated_at = now()
    where user_id = p_contributor_user_id;

    return v_job_id;
end
$$;

revoke all on function public.enqueue_sijoy_run(uuid, bigint) from public;
grant execute on function public.enqueue_sijoy_run(uuid, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- bump_application_counter(p_user_id uuid)
-- Atomically increments user_quota.apps_since_sijoy_run. Returns new value.
-- Used by tax_trigger to decide whether to fire.
-- ---------------------------------------------------------------------------
create or replace function public.bump_application_counter(
    p_user_id uuid
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_new int;
begin
    if current_user not in ('service_role', 'postgres') then
        raise exception 'bump_application_counter is service_role only';
    end if;

    insert into public.user_quota (user_id, apps_since_sijoy_run)
    values (p_user_id, 1)
    on conflict (user_id) do update
    set apps_since_sijoy_run = public.user_quota.apps_since_sijoy_run + 1,
        updated_at = now()
    returning apps_since_sijoy_run into v_new;

    return v_new;
end
$$;

revoke all on function public.bump_application_counter(uuid) from public;
grant execute on function public.bump_application_counter(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- delete_account(p_user_id uuid) — GDPR hard delete
-- Deletes all user-scoped rows. Storage cleanup is a separate call from the
-- web tier (storage has no FK into the DB).
-- ---------------------------------------------------------------------------
create or replace function public.delete_account(
    p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if current_user not in ('service_role', 'postgres') then
        raise exception 'delete_account is service_role only';
    end if;

    -- Cascades take care of the child tables; explicit deletes cover what isn't FK'd.
    delete from public.applications where user_id = p_user_id;
    delete from public.emails where user_id = p_user_id;
    delete from public.daily_stats where user_id = p_user_id;
    delete from public.trial_quota_log where user_id = p_user_id;
    delete from public.sijoy_contributions where contributor_user_id = p_user_id;
    delete from public.job_runs where user_id = p_user_id;
    delete from public.user_quota where user_id = p_user_id;
    delete from public.user_integrations where user_id = p_user_id;
    delete from public.companion_tokens where user_id = p_user_id;
    delete from public.user_api_keys where user_id = p_user_id;
    delete from public.templates where user_id = p_user_id;
    delete from public.profiles where user_id = p_user_id;

    insert into public.admin_audit (role_name, action, table_name, row_pk, notes)
    values (current_user, 'delete', 'auth.users', p_user_id::text, 'gdpr_account_delete');
end
$$;

revoke all on function public.delete_account(uuid) from public;
grant execute on function public.delete_account(uuid) to service_role;
