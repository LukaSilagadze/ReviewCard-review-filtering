-- Apply after 001-email-queue.sql, before publishing the new frontend.
-- Review the constraint/policy queries in UNRATED-MESSAGES.md first.
begin;

alter table public.feedbacks alter column rating drop not null;
alter table public.feedbacks alter column rating drop default;

create or replace function public.enqueue_feedback_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.feedback_email_jobs (feedback_id, biz_id, rating, comment)
  values (new.id::text, new.biz_id::text, new.rating::text, coalesce(new.comment::text, ''));
  return new;
end;
$$;

-- Preserve the existing trigger, permissions, historical feedback and queued jobs.
commit;
