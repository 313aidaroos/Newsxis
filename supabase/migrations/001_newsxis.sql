-- Newsxis · migration 001 · 2026-10-06 (Claude)
-- Apply to the dedicated Supabase project `newsxis` only. Never to a sister site's project.
-- Public reads live stories/threads/briefings/sources. Everything else is owner-scoped or service-role.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- enums
do $$ begin
  create type source_kind as enum ('radio','scanner','rss','gdelt','gov','user','social');
exception when duplicate_object then null; end $$;
do $$ begin
  create type content_status as enum ('pending','live','held','removed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type story_category as enum ('war','attack','assassination','terror','disaster','weather','earthquake','crime','politics','government','economy','strike','health','tech','science','sports','culture','local','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type thread_kind as enum ('research','another_side','update','correction','context','cixy_note');
exception when duplicate_object then null; end $$;
do $$ begin
  create type briefing_scope as enum ('world','country','region','city');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- sources
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  kind source_kind not null,
  name text not null,
  slug text unique,
  url text,                       -- homepage / feed url
  stream_url text,                -- audio stream (radio / scanner)
  lang text not null default 'en',
  country text,                   -- ISO-3166 alpha-2
  region text,                    -- state / province
  city text,
  county text,
  lat double precision,
  lng double precision,
  active boolean not null default true,
  allows_transcript boolean not null default false,
  licensed boolean not null default true,     -- scanners: only licensed providers
  poll_seconds int not null default 300,
  last_polled_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sources_kind_active_idx on public.sources (kind, active);
create index if not exists sources_place_idx on public.sources (country, region, city);

-- ---------------------------------------------------------------- profiles (one per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  apixis_sub text unique,
  home_place text,
  home_country text,
  home_region text,
  home_city text,
  home_lat double precision,
  home_lng double precision,
  lang text not null default 'en',
  show_graphic_media boolean not null default true,   -- blurred by default, can be turned off
  alerts_push boolean not null default true,
  alerts_email boolean not null default false,
  alert_min_severity smallint not null default 4,
  reporter_points int not null default 0,
  verified_reporter boolean not null default false,
  reporter_active_until timestamptz,                   -- from the Wallet seat (newsxis.reporter.monthly)
  activated_at timestamptz,                            -- newsxis.activate captured
  is_owner boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- stories (Cixy-written + confirmed user posts promoted)
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  headline text not null,
  summary text not null,              -- 1–3 sentences
  body text,                          -- longer write-up (markdown)
  lang text not null default 'en',
  status content_status not null default 'live',
  category story_category not null default 'other',
  severity smallint not null default 2 check (severity between 1 and 5),
  breaking boolean not null default false,
  confirmed boolean not null default false,      -- 2+ independent sources
  disputed boolean not null default false,       -- sources contradict on facts
  confirmations int not null default 1,
  confidence real not null default 0.5,
  country text, region text, city text, county text, place_name text,
  lat double precision, lng double precision,
  source_id uuid references public.sources (id) on delete set null,
  source_url text,
  source_quote text,                  -- short quote (≤ 300 chars) from the source
  author_id uuid references public.profiles (id) on delete set null,   -- null = Cixy
  ai_label text not null default 'Written by Cixy',
  image_url text,
  media jsonb not null default '[]'::jsonb,      -- [{url, kind, graphic}]
  graphic boolean not null default false,
  pinned_until timestamptz,
  event_started_at timestamptz,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(headline,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(place_name,''))) stored
);
create index if not exists stories_published_idx on public.stories (published_at desc) where status = 'live';
create index if not exists stories_place_idx on public.stories (country, region, city);
create index if not exists stories_geo_idx on public.stories (lat, lng);
create index if not exists stories_search_idx on public.stories using gin (search);
create index if not exists stories_headline_trgm on public.stories using gin (headline gin_trgm_ops);
create index if not exists stories_severity_idx on public.stories (severity desc, published_at desc);

-- every source that confirms / disputes / adds context to a story
create table if not exists public.story_sources (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  source_id uuid references public.sources (id) on delete set null,
  url text,
  title text,
  publisher text,
  stance text not null default 'confirms' check (stance in ('confirms','disputes','context','origin')),
  quote text,
  created_at timestamptz not null default now()
);
create index if not exists story_sources_story_idx on public.story_sources (story_id);

-- the thread under a story: research, Another side, updates, corrections
create table if not exists public.story_threads (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  kind thread_kind not null,
  body text not null,
  sources jsonb not null default '[]'::jsonb,     -- [{url,title,publisher}]
  ai_label text not null default 'Written by Cixy',
  created_at timestamptz not null default now()
);
create index if not exists story_threads_story_idx on public.story_threads (story_id, created_at);

-- ---------------------------------------------------------------- transcripts (radio / scanner)
create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  lang text not null default 'en',
  text text not null,
  processed boolean not null default false,
  story_id uuid references public.stories (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists transcripts_source_time_idx on public.transcripts (source_id, started_at desc);
create index if not exists transcripts_unprocessed_idx on public.transcripts (processed) where processed = false;

-- raw feed items we have already seen (dedupe)
create table if not exists public.ingest_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources (id) on delete cascade,
  external_id text not null,
  title text,
  url text,
  published_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  story_id uuid references public.stories (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);
create index if not exists ingest_items_unprocessed_idx on public.ingest_items (processed) where processed = false;

-- ---------------------------------------------------------------- Cixy briefings (audio)
create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  scope briefing_scope not null,
  scope_key text not null,            -- 'world' | 'US' | 'US-NY' | 'US-NY-New York'
  lang text not null default 'en',
  kind text not null default 'hourly' check (kind in ('hourly','regional','breaking','recap')),
  title text not null,
  script text not null,
  audio_url text,
  duration_s int,
  story_ids uuid[] not null default '{}',
  sponsor text,
  created_at timestamptz not null default now()
);
create index if not exists briefings_scope_idx on public.briefings (scope, scope_key, created_at desc);

-- ---------------------------------------------------------------- user posts (reporters)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  media jsonb not null default '[]'::jsonb,     -- [{url,kind:'image'|'video'|'audio',graphic}]
  kind text not null default 'text' check (kind in ('text','photo','video','voice','live')),
  lang text not null default 'en',
  status content_status not null default 'pending',
  moderation jsonb not null default '{}'::jsonb, -- {state, reason, graphic, scores}
  place_name text, country text, region text, city text, county text,
  lat double precision, lng double precision,
  story_id uuid references public.stories (id) on delete set null,
  likes int not null default 0,
  comments int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists posts_live_idx on public.posts (created_at desc) where status = 'live';
create index if not exists posts_geo_idx on public.posts (lat, lng);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  status content_status not null default 'live',
  likes int not null default 0,
  created_at timestamptz not null default now(),
  check (story_id is not null or post_id is not null)
);
create index if not exists comments_story_idx on public.comments (story_id, created_at);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.reactions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('story','post','comment')),
  target_id uuid not null,
  kind text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

-- direct messages (chat)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------- alerts
create table if not exists public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('push','email','expo')),
  endpoint jsonb not null,            -- web push subscription | {email} | {expo_token}
  lat double precision, lng double precision, radius_km int not null default 50,
  country text,
  min_severity smallint not null default 4,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.alert_subscriptions (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  unique (subscription_id, story_id)
);

-- ---------------------------------------------------------------- social
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('x','facebook','bluesky')),
  handle text not null,
  scope briefing_scope not null default 'world',
  scope_key text not null default 'world',
  credentials text,                   -- AES-256-GCM encrypted JSON (TOKEN_ENC_KEY)
  min_severity smallint not null default 3,
  min_gap_seconds int not null default 600,
  active boolean not null default true,
  last_posted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (platform, handle)
);
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.social_accounts (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','posted','failed','skipped')),
  text text not null,
  image_url text,
  external_id text,
  external_url text,
  error text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, story_id)
);
create index if not exists social_posts_queue_idx on public.social_posts (status, created_at) where status = 'queued';

-- ---------------------------------------------------------------- back office (support, complaints, marketing, ads)
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'support' check (kind in ('support','complaint','correction','takedown','ads','partnership','other')),
  from_email text,
  user_id uuid references public.profiles (id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','agent_replied','needs_owner','closed')),
  story_id uuid references public.stories (id) on delete set null,
  agent_reply text,
  owner_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('activation','seat','boost','sponsor','ad','donation','other')),
  user_id uuid references public.profiles (id) on delete set null,
  ixis int not null default 0,
  usd numeric(12,2) not null default 0,
  wallet_receipt_id text,
  product_key text,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,               -- 'ingest.rss' | 'classify' | 'research' | 'briefing' | 'social' | 'support' …
  ok boolean not null default true,
  items int not null default 0,
  ms int,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_idx on public.agent_runs (agent, created_at desc);

-- simple fixed-window rate limiter (same shape as the family's take_request_allowance)
create table if not exists public.request_allowances (
  bucket_key text primary key,
  hits int not null default 0,
  expires_at timestamptz not null
);
create or replace function public.take_request_allowance(bucket_key text, max_hits int, expiry timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_hits int;
begin
  delete from public.request_allowances where expires_at < now();
  insert into public.request_allowances as r (bucket_key, hits, expires_at) values (bucket_key, 1, expiry)
    on conflict (bucket_key) do update set hits = r.hits + 1 returning hits into current_hits;
  return current_hits <= max_hits;
end $$;
revoke all on function public.take_request_allowance(text, int, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists stories_updated_at on public.stories;
create trigger stories_updated_at before update on public.stories for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists tickets_updated_at on public.tickets;
create trigger tickets_updated_at before update on public.tickets for each row execute function public.set_updated_at();

-- profile row on signup
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, apixis_sub, is_owner)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
    nullif(new.raw_app_meta_data->>'apixis_sub', ''),
    lower(coalesce(new.email,'')) in ('awad@apixis.dev','alaidaroosawad@gmail.com','newsxis@apixis.dev')
  ) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- stories near a point (for the globe + alerts). Haversine; fine for a radius filter.
create or replace function public.stories_near(p_lat double precision, p_lng double precision, p_km double precision, p_limit int default 100)
returns setof public.stories language sql stable as $$
  select * from public.stories s
  where s.status = 'live' and s.lat is not null and s.lng is not null
    and 6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(p_lng)) + sin(radians(p_lat)) * sin(radians(s.lat)))) <= p_km
  order by s.published_at desc limit p_limit;
$$;

create or replace function public.is_owner() returns boolean language sql stable as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------- RLS
alter table public.sources enable row level security;
alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.story_sources enable row level security;
alter table public.story_threads enable row level security;
alter table public.transcripts enable row level security;
alter table public.ingest_items enable row level security;
alter table public.briefings enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.alert_subscriptions enable row level security;
alter table public.alert_deliveries enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;
alter table public.tickets enable row level security;
alter table public.revenue_events enable row level security;
alter table public.agent_runs enable row level security;
alter table public.request_allowances enable row level security;

-- public reads
create policy "sources public read" on public.sources for select using (active);
create policy "stories public read" on public.stories for select using (status = 'live' or public.is_owner());
create policy "story_sources public read" on public.story_sources for select using (true);
create policy "story_threads public read" on public.story_threads for select using (true);
create policy "briefings public read" on public.briefings for select using (true);
create policy "posts public read" on public.posts for select using (status = 'live' or author_id = auth.uid() or public.is_owner());
create policy "comments public read" on public.comments for select using (status = 'live' or author_id = auth.uid() or public.is_owner());
create policy "profiles public read" on public.profiles for select using (true);
create policy "reactions public read" on public.reactions for select using (true);

-- self writes
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "posts self insert" on public.posts for insert with check (author_id = auth.uid());
create policy "posts self update" on public.posts for update using (author_id = auth.uid() or public.is_owner());
create policy "comments self insert" on public.comments for insert with check (author_id = auth.uid());
create policy "comments self delete" on public.comments for delete using (author_id = auth.uid() or public.is_owner());
create policy "reactions self" on public.reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "alerts self" on public.alert_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tickets self" on public.tickets for select using (user_id = auth.uid() or public.is_owner());
create policy "tickets insert" on public.tickets for insert with check (auth.uid() is not null and user_id = auth.uid());

-- chat
create policy "members see own conversations" on public.conversation_members for select using (user_id = auth.uid());
create policy "conversations by membership" on public.conversations for select using (exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid()));
create policy "messages by membership" on public.messages for select using (exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy "messages send by membership" on public.messages for insert with check (sender_id = auth.uid() and exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));

-- owner reads of back-office tables (writes are service-role only)
create policy "owner reads social_accounts" on public.social_accounts for select using (public.is_owner());
create policy "owner reads social_posts" on public.social_posts for select using (public.is_owner());
create policy "owner reads revenue" on public.revenue_events for select using (public.is_owner());
create policy "owner reads agent_runs" on public.agent_runs for select using (public.is_owner());
create policy "owner reads transcripts" on public.transcripts for select using (public.is_owner());
create policy "owner reads ingest" on public.ingest_items for select using (public.is_owner());

-- storage bucket for media (public read, authenticated upload to own folder)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media own upload" on storage.objects for insert with check (bucket_id = 'media' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
