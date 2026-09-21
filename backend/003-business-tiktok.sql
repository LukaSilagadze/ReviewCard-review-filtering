-- Apply before publishing the TikTok social button. Safe to run again.
begin;
alter table public.businesses
  add column if not exists tiktok_url text,
  add column if not exists tiktok_username text;
commit;
