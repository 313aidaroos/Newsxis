-- Newsxis · migration 005 · receipts the buyer can read
-- Apply after 004. Does not edit 001–004. Not applied to the live project from this file.
-- The app records purchases in the existing revenue_events.note column, so a site
-- that has not run this file yet still stores a receipt. This file lets the buyer
-- read their own rows and stores card vs Ixis in its own column.

alter table public.revenue_events add column if not exists method text;

alter table public.revenue_events drop constraint if exists revenue_events_method_check;
alter table public.revenue_events
  add constraint revenue_events_method_check check (method is null or method in ('card', 'ixis'));

drop policy if exists "buyer reads own revenue" on public.revenue_events;
create policy "buyer reads own revenue" on public.revenue_events
  for select using (user_id = (select auth.uid()));

grant select on public.revenue_events to authenticated;
