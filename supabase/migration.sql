-- Migration: replace keywords/time_period with categories/job_types
-- Run this against your existing Supabase database.

alter table user_settings
  add column if not exists categories text[] default array['data-scientist', 'data-analyst'],
  add column if not exists job_types  text[] default array['internship', 'fulltime'];

alter table user_settings
  drop column if exists keywords,
  drop column if exists time_period;
