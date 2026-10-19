-- AI job agent: career profile built from resumes, plan tier, and agent matches

alter table user_settings add column if not exists plan text default 'free'
  check (plan in ('free', 'pro'));

-- One career profile per user, built by Claude from all uploaded resumes
create table if not exists career_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  profile jsonb,
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
drop policy if exists "Users can insert own career profile" on career_profiles;
create policy "Users can insert own career profile" on career_profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own career profile" on career_profiles;
create policy "Users can update own career profile" on career_profiles
  for update using (auth.uid() = user_id);

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
