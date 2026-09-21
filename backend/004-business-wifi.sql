-- Apply before publishing the Wi-Fi button. Safe to run again.
begin;
alter table public.businesses
  add column if not exists wifi_ssid text,
  add column if not exists wifi_password text;
commit;
