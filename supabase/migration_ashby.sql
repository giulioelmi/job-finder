-- Migration: add Ashby API support
-- Run this against your Supabase database.

-- 1. Create ashby_slugs table (separate from greenhouse_slugs)
create table if not exists ashby_slugs (
  slug text primary key,
  added_at timestamptz default now()
);

-- RLS for ashby_slugs
alter table ashby_slugs enable row level security;

create policy "Authenticated users can view ashby slugs" on ashby_slugs
  for select using (auth.role() = 'authenticated');

create policy "Service role can manage ashby slugs" on ashby_slugs
  for all using (auth.role() = 'service_role');

-- 2. Add ashby_companies column to user_settings
--    (mirrors "companies" which holds Greenhouse slugs)
alter table user_settings
  add column if not exists ashby_companies text[] default array[]::text[];
