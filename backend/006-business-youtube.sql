-- Apply before publishing the YouTube social button. Safe to run again.
begin;
alter table public.businesses
  add column if not exists youtube_url text,
  add column if not exists youtube_username text;
commit;
