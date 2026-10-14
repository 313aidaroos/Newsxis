-- Newsxis · migration 003 · security locks · 2026-10-06
--
-- Why a new file, not an edit of 001:
-- 001 and 002 are the owner's setup scripts (docs/SETUP.md). They may already
-- have been pasted into the Supabase project. Rewriting them would leave a
-- database that already ran 001 wide open. This migration closes those holes
-- on top of 001. Apply 001, then 002, then this file.
--
-- What it locks:
--   * is_owner, activated_at, reporter_active_until, verified_reporter, banned
--     (and reporter points, Apixis id, age flags) change only from the server.
--   * Posts and comments are inserted only by the server, and only as pending.
--   * Home coordinates and Apixis ids are not on the public profile view.
--   * Media uploads: activated reporters, their own folder only.
--   * Master admins live in public.master_admins (two rows), not in a policy.
--   * Graphic media is off for new profiles.

-- ---------------------------------------------------------------- master admins
-- Config, not a policy. Change who is an admin by editing rows here.
-- newsxis@apixis.dev is the support mailbox and is never an admin.
create table if not exists public.master_admins (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint master_admins_email_lower check (email = lower(email))
);

alter table public.master_admins enable row level security;
revoke all on public.master_admins from public, anon, authenticated;

-- Dropped before the seed so re-running this file does not trip the "exactly two" guard.
drop trigger if exists master_admins_guard on public.master_admins;

insert into public.master_admins (email) values
  ('alaidaroosawad@gmail.com'),
  ('awad@apixis.dev')
on conflict (email) do nothing;

delete from public.master_admins where email = 'newsxis@apixis.dev';

create or replace function public.guard_master_admins() returns trigger
language plpgsql
set search_path = public
as $$
declare n int;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.email := lower(btrim(new.email));
  if new.email = 'newsxis@apixis.dev' then
    raise exception 'newsxis@apixis.dev is the support mailbox, not a master admin';
  end if;
  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'master admin email is not valid';
  end if;
  select count(*) into n from public.master_admins;
  if tg_op = 'INSERT' and n >= 2 then
    raise exception 'Newsxis has exactly two master admins; delete one before adding another';
  end if;
  return new;
end $$;

drop trigger if exists master_admins_guard on public.master_admins;
create trigger master_admins_guard
  before insert or update on public.master_admins
  for each row execute function public.guard_master_admins();

-- ---------------------------------------------------------------- who may write privileged rows
create or replace function public.is_service_role() returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  role text;
  claims text;
begin
  role := coalesce(auth.role(), '');
  if role = 'service_role' then return true; end if;
  role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if role = 'service_role' then return true; end if;
  begin
    claims := current_setting('request.jwt.claims', true);
    if claims is not null and claims <> '' and (claims::jsonb ->> 'role') = 'service_role' then
      return true;
    end if;
  exception when others then
    null;
  end;
  -- SQL editor, migrations, and security-definer functions (they run as the owner).
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return true;
  end if;
  return false;
end $$;

-- ---------------------------------------------------------------- profile privileges + age + graphic default
alter table public.profiles add column if not exists age_confirmed_at timestamptz;
alter table public.profiles add column if not exists age_blocked boolean not null default false;
alter table public.profiles alter column show_graphic_media set default false;

-- The old default was on, with no opt-in. Turn it off until the person chooses it in settings.
-- Rows someone already saved (updated_at moved) are left as they set them.
update public.profiles
set show_graphic_media = false
where show_graphic_media = true
  and updated_at <= created_at + interval '2 seconds';

create or replace function public.protect_profile_privileges() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_service_role() then
      new.is_owner := false;
      new.activated_at := null;
      new.reporter_active_until := null;
      new.verified_reporter := false;
      new.banned := false;
      new.reporter_points := 0;
      new.apixis_sub := null;
      new.age_confirmed_at := null;
      new.age_blocked := false;
      new.show_graphic_media := false;
    end if;
    return new;
  end if;

  if public.is_service_role() then
    return new;
  end if;

  if new.is_owner is distinct from old.is_owner
    or new.activated_at is distinct from old.activated_at
    or new.reporter_active_until is distinct from old.reporter_active_until
    or new.verified_reporter is distinct from old.verified_reporter
    or new.banned is distinct from old.banned
    or new.reporter_points is distinct from old.reporter_points
    or new.apixis_sub is distinct from old.apixis_sub
    or new.age_confirmed_at is distinct from old.age_confirmed_at
    or new.age_blocked is distinct from old.age_blocked
  then
    raise exception 'privileged profile columns are changed only by the Newsxis server';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Column grants: a signed-in person can update their own safe fields only.
revoke update on table public.profiles from anon, authenticated;
grant update (
  username, display_name, avatar_url, bio,
  home_place, home_country, home_region, home_city, home_lat, home_lng,
  lang, show_graphic_media, alerts_push, alerts_email, alert_min_severity
) on table public.profiles to authenticated;

-- Signup reads master_admins. Emails are not listed in a policy.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, apixis_sub, is_owner, show_graphic_media)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_app_meta_data->>'apixis_sub', ''),
    exists (
      select 1 from public.master_admins m
      where m.email = lower(coalesce(new.email, ''))
    ),
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Re-sync the flag from the table (drops newsxis@apixis.dev if 001 marked it).
update public.profiles p
set is_owner = exists (
  select 1 from auth.users u
  where u.id = p.id
    and lower(coalesce(u.email, '')) in (select email from public.master_admins)
);

create or replace function public.sync_owner_flags() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set is_owner = exists (
    select 1 from auth.users u
    where u.id = p.id
      and lower(coalesce(u.email, '')) in (select email from public.master_admins)
  );
  return null;
end $$;

drop trigger if exists master_admins_sync_owners on public.master_admins;
create trigger master_admins_sync_owners
  after insert or update or delete on public.master_admins
  for each statement execute function public.sync_owner_flags();

-- ---------------------------------------------------------------- public profile (no coordinates, no Apixis id)
drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.is_owner());

create or replace view public.profiles_public
with (security_barrier = true, security_invoker = false) as
select
  id,
  username,
  display_name,
  avatar_url,
  bio,
  verified_reporter,
  reporter_points,
  created_at
from public.profiles
where banned = false and age_blocked = false;

grant select on public.profiles_public to anon, authenticated;

-- ---------------------------------------------------------------- posts and comments: server only, insert as pending
alter table public.comments alter column status set default 'pending';

create or replace function public.guard_user_content() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_service_role() then
    raise exception 'posts and comments are written only through Newsxis server routes';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
  end if;
  return new;
end $$;

drop trigger if exists posts_server_only on public.posts;
create trigger posts_server_only
  before insert or update on public.posts
  for each row execute function public.guard_user_content();

drop trigger if exists comments_server_only on public.comments;
create trigger comments_server_only
  before insert or update on public.comments
  for each row execute function public.guard_user_content();

drop policy if exists "posts self insert" on public.posts;
drop policy if exists "posts self update" on public.posts;
drop policy if exists "comments self insert" on public.comments;

revoke insert, update on table public.posts from anon, authenticated;
revoke insert, update on table public.comments from anon, authenticated;

-- ---------------------------------------------------------------- media: activated reporters, own folder
drop policy if exists "media own upload" on storage.objects;
drop policy if exists "media reporter upload" on storage.objects;
create policy "media reporter upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name not like '%..%'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.banned = false
        and p.age_blocked = false
        and p.age_confirmed_at is not null
        and (
          p.is_owner
          or (
            p.activated_at is not null
            and p.reporter_active_until is not null
            and p.reporter_active_until > now()
          )
        )
    )
  );
