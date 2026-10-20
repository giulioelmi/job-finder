-- The AI agent reads its profile from the existing Profiles (autofill_profiles) instead of a separate copy.

-- What the agent searches for, plus which profile it uses (at most one per user)
alter table autofill_profiles add column if not exists target_titles text[] default array[]::text[];
alter table autofill_profiles add column if not exists target_locations text[] default array[]::text[];
alter table autofill_profiles add column if not exists use_for_agent boolean default false;

create unique index if not exists autofill_profiles_one_agent_profile
  on autofill_profiles (user_id) where use_for_agent;

-- career_profiles now only holds source resumes and agent settings
alter table career_profiles drop column if exists profile;
