ALTER TABLE autofill_profiles
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS resume_url      text;
