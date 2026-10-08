-- 0005_audit.sql
-- GATE-SEC-02: admin access audit log.
-- Any read or write performed by a database role other than `authenticated`
-- or `anon` on sensitive tables is captured here for later review.

create table if not exists public.admin_audit (
    id bigserial primary key,
    at timestamptz default now(),
    role_name text not null,
    session_user_name text,
    action text not null check (action in ('select', 'insert', 'update', 'delete')),
    table_name text not null,
    row_pk text,
    notes text
);

create index if not exists idx_admin_audit_at on public.admin_audit (at desc);
create index if not exists idx_admin_audit_table on public.admin_audit (table_name, at desc);

-- Generic audit trigger function
create or replace function public.fn_admin_audit()
returns trigger language plpgsql security definer as $$
declare
    pk_text text;
begin
    if current_user in ('authenticated', 'anon') then
        -- Regular user actions are scoped by RLS; no audit row needed.
        return coalesce(new, old);
    end if;

    begin
        pk_text := coalesce(new, old)->>'id';
    exception when others then
        pk_text := null;
    end;

    insert into public.admin_audit (role_name, session_user_name, action, table_name, row_pk)
    values (current_user, session_user, tg_op::text, tg_table_name, pk_text);
    return coalesce(new, old);
end
$$;

-- Attach the trigger to sensitive tables
do $$
declare
    t text;
begin
    for t in select unnest(array[
        'user_api_keys',
        'user_integrations',
        'companion_tokens',
        'profiles',
        'applications',
        'emails'
    ])
    loop
        execute format(
            'drop trigger if exists trg_audit_%1$s on public.%1$s;
             create trigger trg_audit_%1$s
             after insert or update or delete on public.%1$s
             for each row execute function public.fn_admin_audit();',
            t
        );
    end loop;
end
$$;

-- Only service_role + postgres may read the audit table.
alter table public.admin_audit enable row level security;

drop policy if exists admin_audit_no_user_access on public.admin_audit;
create policy admin_audit_no_user_access on public.admin_audit
    for all to authenticated
    using (false);
