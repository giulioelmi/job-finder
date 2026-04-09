-- Migration: store manually-added job details directly on the applications row.
-- Manual entries no longer touch the shared jobs catalog.
-- Run this against your existing Supabase database.

-- Make job_id optional (manual entries have no linked jobs row)
alter table applications
  alter column job_id drop not null;

-- Inline job details for manual entries
alter table applications
  add column if not exists title    text,
  add column if not exists company  text,
  add column if not exists location text,
  add column if not exists url      text;

-- Remove the is_manual flag added in a previous migration (no longer needed)
alter table jobs
  drop column if exists is_manual;
