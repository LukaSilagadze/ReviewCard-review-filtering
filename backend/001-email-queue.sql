-- Run once in Supabase SQL Editor. All changes commit together.
begin;

-- Fail before making changes if the existing schema differs from the webpage.
do $$
begin
  perform id, biz_id, rating, comment from public.feedbacks limit 0;
  perform biz_id, name, notify_email from public.businesses limit 0;
end;
$$;

create table public.feedback_email_jobs (
  id uuid primary key default gen_random_uuid(),
  feedback_id text not null unique,
  biz_id text not null,
  rating text,
  comment text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);
create index feedback_email_jobs_due on public.feedback_email_jobs (available_at)
  where status in ('pending', 'processing');
alter table public.feedback_email_jobs enable row level security;
revoke all on public.feedback_email_jobs from public, anon, authenticated;
grant all on public.feedback_email_jobs to service_role;

create function public.enqueue_feedback_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Match the negative experience value used by the current page.
  if new.rating::text = '1' then
    insert into public.feedback_email_jobs (feedback_id, biz_id, rating, comment)
    values (new.id::text, new.biz_id::text, new.rating::text, coalesce(new.comment::text, ''));
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_feedback_email() from public, anon, authenticated;
create trigger feedback_email_enqueue after insert on public.feedbacks
for each row execute function public.enqueue_feedback_email();

create function public.claim_feedback_email() returns setof public.feedback_email_jobs
language plpgsql security definer set search_path = '' as $$
begin
  -- A worker that dies on its last attempt must still leave an actionable failure.
  update public.feedback_email_jobs
  set status = 'failed', lease_token = null, last_error = 'worker_lease_expired'
  where status = 'processing' and available_at <= now() and attempts >= 5;

  return query
  with candidate as (
    select id from public.feedback_email_jobs
    where status in ('pending', 'processing') and available_at <= now() and attempts < 5
    order by available_at, created_at
    for update skip locked limit 1
  )
  update public.feedback_email_jobs j
  set status = 'processing', attempts = j.attempts + 1,
      lease_token = gen_random_uuid(), available_at = now() + interval '10 minutes'
  from candidate c where j.id = c.id returning j.*;
end;
$$;

create function public.finish_feedback_email(p_id uuid, p_lease_token uuid, p_sent boolean, p_error text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.feedback_email_jobs
  set status = case when p_sent then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
      sent_at = case when p_sent then now() else null end,
      available_at = now() + make_interval(mins => least(60, (power(2, attempts))::integer)),
      last_error = case when p_sent then null else left(coalesce(p_error, 'send_failed'), 100) end,
      lease_token = null
  where id = p_id and status = 'processing' and lease_token = p_lease_token;
  return found;
end;
$$;

revoke all on function public.claim_feedback_email() from public, anon, authenticated;
revoke all on function public.finish_feedback_email(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_feedback_email() to service_role;
grant execute on function public.finish_feedback_email(uuid, uuid, boolean, text) to service_role;
commit;
