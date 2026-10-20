-- Billing: one row per user, written only by the Stripe webhook (service role).
-- Kept out of user_settings so users can't flip is_pro on themselves.
create table if not exists billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  is_pro boolean default false,
  updated_at timestamptz default now()
);

alter table billing enable row level security;

drop policy if exists "Users can view own billing" on billing;
create policy "Users can view own billing" on billing
  for select using (auth.uid() = user_id);
