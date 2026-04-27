alter table user_settings
  add column if not exists extension_prompt_seen boolean default false;

update user_settings
set extension_prompt_seen = false
where extension_prompt_seen is null;
