alter table user_settings
add column if not exists experience_levels text[] default array[]::text[];
