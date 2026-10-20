-- AI job agent: career profile built from resumes, plan tier, and agent matches

-- Subscription state. Users can only read it: every write comes from the Stripe webhook
-- (service role), so nobody can upgrade themselves through the Supabase client.
create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text,
  updated_at timestamptz default now()
);

alter table subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on subscriptions;
create policy "Users can view own subscription" on subscriptions
  for select using (auth.uid() = user_id);

-- Per-user agent state: the uploaded source resumes and the agent's settings.
-- The profile itself lives in autofill_profiles (see migration_agent_profile.sql).
create table if not exists career_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  resume_paths text[] default array[]::text[],
  agent_enabled boolean default true,
  send_resumes boolean default true,
  last_agent_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table career_profiles enable row level security;

drop policy if exists "Users can view own career profile" on career_profiles;
create policy "Users can view own career profile" on career_profiles
  for select using (auth.uid() = user_id);
-- Select only: writes go through the API routes (service role) so users cannot
-- reset last_agent_run_at and skip the schedule limit.

drop trigger if exists update_career_profiles_updated_at on career_profiles;
create trigger update_career_profiles_updated_at
  before update on career_profiles
  for each row execute function update_updated_at();

-- Jobs the agent matched to a user (also prevents emailing the same job twice)
create table if not exists agent_matches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  company text,
  location text,
  source text check (source in ('greenhouse', 'ashby', 'linkedin', 'indeed', 'web')),
  score int,
  reason text,
  resume_path text,
  created_at timestamptz default now(),
  unique(user_id, url)
);

alter table agent_matches enable row level security;

drop policy if exists "Users can view own agent matches" on agent_matches;
create policy "Users can view own agent matches" on agent_matches
  for select using (auth.uid() = user_id);
