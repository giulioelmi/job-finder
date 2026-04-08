-- Migration: mark manually-added jobs so they are excluded from the shared Recent Jobs feed.
-- Run this against your existing Supabase database.

alter table jobs
  add column if not exists is_manual boolean not null default false;
