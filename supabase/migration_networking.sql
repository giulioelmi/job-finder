-- Networking contacts table
create table if not exists networking_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  role text,
  email text,
  linkedin_url text,
  notes text,
  last_contacted_at timestamptz,
  -- Set automatically to created_at + 14 days on insert, then updated on "mark contacted"
  next_followup_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table networking_contacts enable row level security;

drop policy if exists "Users can view own contacts" on networking_contacts;
create policy "Users can view own contacts" on networking_contacts
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own contacts" on networking_contacts;
create policy "Users can insert own contacts" on networking_contacts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own contacts" on networking_contacts;
create policy "Users can update own contacts" on networking_contacts
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own contacts" on networking_contacts;
create policy "Users can delete own contacts" on networking_contacts
  for delete using (auth.uid() = user_id);
