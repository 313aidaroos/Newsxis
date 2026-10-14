-- Newsxis · migration 004 · Supabase advisor fixes · 2026-10-06
--
-- Apply after 001, 002 and 003. Idempotent. Does not edit those files.
-- Safe on the live `newsxis` database (ref olwnstniusyyaswxboux) once 003 is in.
--
-- Public profiles
-- --------------
-- `profiles_public` was security_invoker = false, so it ran as the owner and
-- bypassed row security. It is now security_invoker = true.
--
-- A public SELECT policy on `profiles` cannot hide columns. Grants are per
-- role, not per row. Authenticated clients read their own full row
-- (`select *`, age flags, home coordinates) under "profiles self read".
-- Giving that role a policy that also returns everyone else's rows would
-- expose home coordinates and the Apixis id.
--
-- The directory therefore does not read `profiles` as the caller. The view
-- calls `private.profile_directory()`, a security-definer function in a schema
-- PostgREST does not expose. It returns only the public columns, and only
-- rows that are not banned and not age-blocked. Anon and authenticated can
-- select the view. They still cannot read another person's private columns
-- from `profiles`: anon has no SELECT policy, and authenticated's policy is
-- their own row or `is_owner()`.

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

create extension if not exists pg_trgm with schema extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;

-- Sessions that run as the API roles can resolve gin_trgm_ops and similarity().
alter role anon set search_path = public, extensions;
alter role authenticated set search_path = public, extensions;
alter role service_role set search_path = public, extensions;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set search_path = public, extensions';
  end if;
end $$;

-- ---------------------------------------------------------------- functions: fixed search_path
-- Includes set_updated_at, stories_near, is_owner and every other public function.
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, extensions',
      r.proname, r.args
    );
  end loop;
end $$;

-- Keep is_owner() from reintroducing a per-row auth.uid() if the planner inlines it.
create or replace function public.is_owner() returns boolean
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(
    (select p.is_owner from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- ---------------------------------------------------------------- security-definer execute
-- Trigger functions must not be callable through the Data API. The role that
-- actually fires each trigger keeps EXECUTE. take_request_allowance stays
-- service-role only (the server routes call it with the admin client).
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_owner_flags() from public, anon, authenticated;
revoke all on function public.take_request_allowance(text, int, timestamptz) from public, anon, authenticated;
revoke all on function public.guard_master_admins() from public, anon, authenticated;
revoke all on function public.guard_user_content() from public, anon, authenticated;

grant execute on function public.handle_new_user() to supabase_auth_admin, service_role;
grant execute on function public.sync_owner_flags() to service_role;
grant execute on function public.take_request_allowance(text, int, timestamptz) to service_role;
grant execute on function public.guard_master_admins() to service_role;
grant execute on function public.guard_user_content() to service_role;

-- Profile updates from a signed-in person fire these. Anon does not.
revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.protect_profile_privileges() from public, anon;
grant execute on function public.set_updated_at() to authenticated, service_role;
grant execute on function public.protect_profile_privileges() to authenticated, service_role;

-- is_owner() and is_service_role() are used inside policies and triggers.
grant execute on function public.is_owner() to anon, authenticated, service_role;
grant execute on function public.is_service_role() to anon, authenticated, service_role;

-- ---------------------------------------------------------------- public directory
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.profile_directory()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  verified_reporter boolean,
  reporter_points int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.verified_reporter,
    p.reporter_points,
    p.created_at
  from public.profiles p
  where p.banned = false and p.age_blocked = false;
$$;

revoke all on function private.profile_directory() from public;
grant execute on function private.profile_directory() to anon, authenticated, service_role;

drop view if exists public.profiles_public;
create view public.profiles_public
with (security_barrier = true, security_invoker = true) as
select
  id,
  username,
  display_name,
  avatar_url,
  bio,
  verified_reporter,
  reporter_points,
  created_at
from private.profile_directory();

grant select on public.profiles_public to anon, authenticated, service_role;

comment on view public.profiles_public is
  'Public profile columns only. security_invoker view over private.profile_directory(). Home coordinates and Apixis ids are not here.';

-- ---------------------------------------------------------------- RLS initplan: (select auth.uid())
drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts
  for select using (status = 'live' or author_id = (select auth.uid()) or public.is_owner());

drop policy if exists "comments public read" on public.comments;
create policy "comments public read" on public.comments
  for select using (status = 'live' or author_id = (select auth.uid()) or public.is_owner());

drop policy if exists "comments self delete" on public.comments;
create policy "comments self delete" on public.comments
  for delete using (author_id = (select auth.uid()) or public.is_owner());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = (select auth.uid()) or public.is_owner());

drop policy if exists "reactions self" on public.reactions;
drop policy if exists "reactions self insert" on public.reactions;
drop policy if exists "reactions self update" on public.reactions;
drop policy if exists "reactions self delete" on public.reactions;
create policy "reactions self insert" on public.reactions
  for insert with check (user_id = (select auth.uid()));
create policy "reactions self update" on public.reactions
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reactions self delete" on public.reactions
  for delete using (user_id = (select auth.uid()));

drop policy if exists "alerts self" on public.alert_subscriptions;
create policy "alerts self" on public.alert_subscriptions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "tickets self" on public.tickets;
create policy "tickets self" on public.tickets
  for select using (user_id = (select auth.uid()) or public.is_owner());

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert" on public.tickets
  for insert with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "members see own conversations" on public.conversation_members;
create policy "members see own conversations" on public.conversation_members
  for select using (user_id = (select auth.uid()));

drop policy if exists "conversations by membership" on public.conversations;
create policy "conversations by membership" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = id and m.user_id = (select auth.uid())
    )
  );

-- Qualify messages.conversation_id. An unqualified conversation_id binds to the
-- inner alias (m.conversation_id = m.conversation_id), which is true for every row.
drop policy if exists "messages by membership" on public.messages;
create policy "messages by membership" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "messages send by membership" on public.messages;
create policy "messages send by membership" on public.messages
  for insert with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id and m.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------- server-only tables: explicit no-access
-- RLS with zero policies already denied clients. A policy makes that choice visible to the advisor.
drop policy if exists "alert_deliveries no client access" on public.alert_deliveries;
create policy "alert_deliveries no client access" on public.alert_deliveries
  for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "master_admins no client access" on public.master_admins;
create policy "master_admins no client access" on public.master_admins
  for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "request_allowances no client access" on public.request_allowances;
create policy "request_allowances no client access" on public.request_allowances
  for all to anon, authenticated
  using (false) with check (false);

comment on table public.alert_deliveries is
  'Server-only. Clients have no access. The service role bypasses RLS.';
comment on table public.master_admins is
  'Server-only list of the two master admins. Clients have no access.';
comment on table public.request_allowances is
  'Server-only rate-limit buckets. Clients have no access.';

-- ---------------------------------------------------------------- foreign-key indexes
create index if not exists alert_deliveries_story_id_idx on public.alert_deliveries (story_id);
create index if not exists alert_subscriptions_user_id_idx on public.alert_subscriptions (user_id);
create index if not exists comments_author_id_idx on public.comments (author_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);
create index if not exists conversation_members_user_id_idx on public.conversation_members (user_id);
create index if not exists ingest_items_story_id_idx on public.ingest_items (story_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists posts_story_id_idx on public.posts (story_id);
create index if not exists revenue_events_user_id_idx on public.revenue_events (user_id);
create index if not exists social_posts_story_id_idx on public.social_posts (story_id);
create index if not exists stories_author_id_idx on public.stories (author_id);
create index if not exists stories_source_id_idx on public.stories (source_id);
create index if not exists story_sources_source_id_idx on public.story_sources (source_id);
create index if not exists tickets_story_id_idx on public.tickets (story_id);
create index if not exists tickets_user_id_idx on public.tickets (user_id);
create index if not exists transcripts_story_id_idx on public.transcripts (story_id);
