-- Newsxis · migration 006 · opt-in daily report
-- Apply after 005. Not applied to the live project from this file.
-- The column is off until a person turns it on. Reports are readable only by that person.

alter table public.profiles add column if not exists daily_report_opt_in boolean not null default false;

grant update (daily_report_opt_in) on table public.profiles to authenticated;

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_date date not null,
  title text not null,
  body text not null,
  ai_label text not null,
  created_at timestamptz not null default now(),
  unique (user_id, report_date)
);

-- Re-running after a partial create still gets the one-report-per-day key.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'daily_reports_user_id_report_date_key'
      and conrelid = 'public.daily_reports'::regclass
  ) then
    alter table public.daily_reports
      add constraint daily_reports_user_id_report_date_key unique (user_id, report_date);
  end if;
end $$;

alter table public.daily_reports enable row level security;

drop policy if exists "daily reports self read" on public.daily_reports;
create policy "daily reports self read" on public.daily_reports
  for select using (user_id = (select auth.uid()));

revoke all on public.daily_reports from anon, authenticated;
grant select on public.daily_reports to authenticated;
grant select, insert, update, delete on public.daily_reports to service_role;
