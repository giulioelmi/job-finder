-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User settings table
create table if not exists user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  search_all_companies boolean default false,
  companies text[] default array[]::text[],
  categories text[] default array['Data Scientist', 'Data Analyst'],
  job_types text[] default array['internship', 'fulltime'],
  location text default '',
  email_notifications boolean default true,
  notification_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Jobs table (central catalog, shared across all users)
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique not null,
  title text not null,
  company text,
  location text,
  url text not null,
  posted_at timestamptz,
  found_at timestamptz default now(),
  description text
);

-- Job notifications (tracks which users were notified of which jobs)
create table if not exists job_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  notified_at timestamptz default now(),
  unique(user_id, job_id)
);

-- Applications table
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  status text default 'applied' check (status in ('applied', 'interview', 'offer', 'rejected', 'saved')),
  notes text default '',
  applied_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, job_id)
);

-- RLS Policies
alter table user_settings enable row level security;
alter table job_notifications enable row level security;
alter table applications enable row level security;
alter table jobs enable row level security;

-- user_settings: users can only read/write their own settings
drop policy if exists "Users can view own settings" on user_settings;
create policy "Users can view own settings" on user_settings
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own settings" on user_settings;
create policy "Users can insert own settings" on user_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own settings" on user_settings;
create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);

-- job_notifications: users can only see their own
drop policy if exists "Users can view own notifications" on job_notifications;
create policy "Users can view own notifications" on job_notifications
  for select using (auth.uid() = user_id);

-- applications: users can manage their own
drop policy if exists "Users can view own applications" on applications;
create policy "Users can view own applications" on applications
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own applications" on applications;
create policy "Users can insert own applications" on applications
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own applications" on applications;
create policy "Users can update own applications" on applications
  for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own applications" on applications;
create policy "Users can delete own applications" on applications
  for delete using (auth.uid() = user_id);

-- jobs: readable by all authenticated users (inserted by service role)
drop policy if exists "Authenticated users can view jobs" on jobs;
create policy "Authenticated users can view jobs" on jobs
  for select using (auth.role() = 'authenticated');

-- Service role can do everything (for the job fetcher)
drop policy if exists "Service role can manage jobs" on jobs;
create policy "Service role can manage jobs" on jobs
  for all using (auth.role() = 'service_role');
drop policy if exists "Service role can manage notifications" on job_notifications;
create policy "Service role can manage notifications" on job_notifications
  for all using (auth.role() = 'service_role');

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_settings_updated_at on user_settings;
create trigger update_user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();

drop trigger if exists update_applications_updated_at on applications;
create trigger update_applications_updated_at
  before update on applications
  for each row execute function update_updated_at();
