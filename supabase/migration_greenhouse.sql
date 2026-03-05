-- Migration: switch from LinkedIn scraping to Greenhouse API
-- Run this against your existing Supabase database.

-- 1. Rename linkedin_id → external_id in jobs table
alter table jobs rename column linkedin_id to external_id;

-- 2. Add companies column to user_settings
alter table user_settings add column if not exists companies text[] default array[]::text[];

-- 3. Drop job_types column (no longer used)
alter table user_settings drop column if exists job_types;

-- 4. Clear existing jobs and notifications (they were LinkedIn jobs, no longer valid)
truncate table job_notifications;
truncate table jobs;
