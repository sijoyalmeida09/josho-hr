-- 0003_storage_policies.sql
-- GATE-DATA-02 (storage portion): path-prefix RLS on buckets.
-- Each user can only read/write objects under their own user_id/ prefix.

-- Create buckets (idempotent) ------------------------------------------------
insert into storage.buckets (id, name, public)
values
    ('resumes',        'resumes',        false),
    ('cover_letters',  'cover_letters',  false),
    ('traces',         'traces',         false),
    ('inbox',          'inbox',          false)
on conflict (id) do nothing;

-- Helper: the first path segment must equal the authenticated user's UUID ---
-- storage.objects.name is a path like "<user_id>/<rest>..."

-- resumes --------------------------------------------------------------------
drop policy if exists resumes_owner_select on storage.objects;
create policy resumes_owner_select on storage.objects
    for select to authenticated
    using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resumes_owner_insert on storage.objects;
create policy resumes_owner_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resumes_owner_update on storage.objects;
create policy resumes_owner_update on storage.objects
    for update to authenticated
    using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resumes_owner_delete on storage.objects;
create policy resumes_owner_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- cover_letters --------------------------------------------------------------
drop policy if exists cover_letters_owner_select on storage.objects;
create policy cover_letters_owner_select on storage.objects
    for select to authenticated
    using (bucket_id = 'cover_letters' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists cover_letters_owner_insert on storage.objects;
create policy cover_letters_owner_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'cover_letters' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists cover_letters_owner_update on storage.objects;
create policy cover_letters_owner_update on storage.objects
    for update to authenticated
    using (bucket_id = 'cover_letters' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists cover_letters_owner_delete on storage.objects;
create policy cover_letters_owner_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'cover_letters' and (storage.foldername(name))[1] = auth.uid()::text);

-- traces ---------------------------------------------------------------------
drop policy if exists traces_owner_select on storage.objects;
create policy traces_owner_select on storage.objects
    for select to authenticated
    using (bucket_id = 'traces' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists traces_owner_delete on storage.objects;
create policy traces_owner_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'traces' and (storage.foldername(name))[1] = auth.uid()::text);

-- inbox (companion-writeable) ------------------------------------------------
drop policy if exists inbox_owner_all on storage.objects;
create policy inbox_owner_all on storage.objects
    for all to authenticated
    using (bucket_id = 'inbox' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'inbox' and (storage.foldername(name))[1] = auth.uid()::text);
