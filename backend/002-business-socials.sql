-- Apply before publishing the social-link frontend. Safe to run again.
begin;
alter table public.businesses
  add column if not exists facebook_url text,
  add column if not exists facebook_username text,
  add column if not exists instagram_url text,
  add column if not exists instagram_username text;
commit;
