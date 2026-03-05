-- Migration: add greenhouse_slugs table for managing the company slug list
-- Run this against your Supabase database.

create table if not exists greenhouse_slugs (
  slug text primary key,
  added_at timestamptz default now()
);

-- RLS
alter table greenhouse_slugs enable row level security;

create policy "Authenticated users can view slugs" on greenhouse_slugs
  for select using (auth.role() = 'authenticated');

create policy "Service role can manage slugs" on greenhouse_slugs
  for all using (auth.role() = 'service_role');

-- Seed with the existing hardcoded list so nothing breaks on first deploy
insert into greenhouse_slugs (slug) values
  ('airtable'),
  ('airbnb'),
  ('amplitude'),
  ('anthropic'),
  ('asana'),
  ('box'),
  ('brex'),
  ('checkr'),
  ('chime'),
  ('cloudflare'),
  ('coinbase'),
  ('confluent'),
  ('contentful'),
  ('coreweave'),
  ('datadog'),
  ('databricks'),
  ('deel'),
  ('descript'),
  ('discord'),
  ('dropbox'),
  ('duolingo'),
  ('faire'),
  ('figma'),
  ('fivetran'),
  ('flexport'),
  ('gem'),
  ('gitlab'),
  ('gusto'),
  ('heap'),
  ('hubspot'),
  ('intercom'),
  ('ironclad'),
  ('lattice'),
  ('launchdarkly'),
  ('lob'),
  ('lyft'),
  ('marqeta'),
  ('masterclass'),
  ('mercury'),
  ('mixpanel'),
  ('moderntreasury'),
  ('mongodb'),
  ('navan'),
  ('openai'),
  ('pagerduty'),
  ('persona'),
  ('pinterest'),
  ('productboard'),
  ('reddit'),
  ('robinhood'),
  ('sentry'),
  ('snyk'),
  ('stripe'),
  ('substack'),
  ('twilio'),
  ('vanta'),
  ('verkada'),
  ('webflow'),
  ('workos'),
  ('zapier')
on conflict do nothing;
