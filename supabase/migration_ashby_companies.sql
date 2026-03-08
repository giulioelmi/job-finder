-- Migration: add ashby_companies column to user_settings
-- Run this against your existing Supabase database if upgrading from a version
-- that predates the Ashby integration.

alter table user_settings
  add column if not exists ashby_companies text[] default array[]::text[];
