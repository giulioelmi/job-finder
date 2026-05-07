-- supabase/migration_autofill_profiles.sql
create table if not exists autofill_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,

  -- Personal info
  first_name text,
  last_name text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  zip_code text,
  country text,

  -- Online presence
  linkedin_url text,
  github_url text,
  portfolio_url text,
  website_url text,

  -- Work authorization
  authorized_to_work boolean,
  requires_sponsorship boolean,
  visa_type text,

  -- Compensation & availability
  desired_salary integer,
  salary_type text check (salary_type in ('hourly', 'yearly')),
  willing_to_relocate boolean,
  available_start_date text,

  -- DEI (null = prefer not to say)
  gender text,
  pronouns text,
  ethnicity text,
  veteran_status text,
  disability_status text,

  -- JSONB arrays
  education jsonb not null default '[]'::jsonb,
  work_experience jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  custom_qa jsonb not null default '[]'::jsonb,

  -- Cover letter
  cover_letter_prompt text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table autofill_profiles enable row level security;

create policy "users own their autofill profiles"
  on autofill_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists update_autofill_profiles_updated_at on autofill_profiles;
create trigger update_autofill_profiles_updated_at
  before update on autofill_profiles
  for each row execute function update_updated_at();
