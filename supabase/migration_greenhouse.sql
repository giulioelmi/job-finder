-- Migration: switch from LinkedIn scraping to Greenhouse API
-- Run this against your existing Supabase database.

-- 1. Rename linkedin_id → external_id in jobs table
alter table jobs rename column linkedin_id to external_id;

-- 2. Add new columns to user_settings
alter table user_settings add column if not exists search_all_companies boolean default false;
alter table user_settings add column if not exists companies text[] default array[]::text[];
alter table user_settings add column if not exists job_types text[] default array['internship', 'fulltime'];

-- 4. Clear existing jobs and notifications (they were LinkedIn jobs, no longer valid)
truncate table jobs cascade;
