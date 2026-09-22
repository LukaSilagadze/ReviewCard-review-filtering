# Queued feedback emails

For prompt delivery on an existing installation, follow
[webhook setup](WEBHOOK-SETUP.md). It wakes the worker on new jobs and retains the
scheduled trigger as a fallback. The base setup below uses the scheduled worker.

The feedback insert and email job commit in one database transaction. The page
shows success after that commit. Apps Script picks up pending jobs every minute,
sends the existing Georgian email, and records success or schedules a retry.
No customer identity or contact field is added. After applying the
[unrated-message migration](UNRATED-MESSAGES.md), every new private message is
queued, without an inferred rating. Existing feedback is not emailed retroactively.
The original `001` migration alone queues only `rating = 1`; apply `005` before
publishing the current frontend.

## Deployment order

Do not publish the updated webpage before the queue is installed.

1. Save a copy of the current Apps Script and its deployment version. Run
   `001-email-queue.sql` once in the Supabase SQL Editor. It checks required
   columns first and installs everything in a single transaction. If it fails,
   share the error rather than running selected fragments. The supplied schema
   report confirmed primary keys only; this has not been run against production.
2. Replace the Apps Script code with `EmailWorker.gs`. In **Project Settings →
   Script Properties**, add:
   - `SUPABASE_URL`: `https://tgzlwkouinonvoawoheb.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: your legacy Supabase `service_role` JWT key
     from project API keys. This is NOT the publishable key. Keep this powerful
     server credential only in Script Properties; never paste it into chat,
     the webpage, or Git. Access to the Apps Script project must be trusted.
3. Update the **existing** web-app deployment to a new version of this code
   (**Deploy → Manage deployments → Edit → New version → Deploy**). Its URL
   stays the same. The old browser notification endpoint now does nothing;
   the database queue owns sending. Do this before starting the worker.
4. Jobs created between steps 1 and 3 might have been emailed by the old script.
   Inspect those jobs before starting the worker. If you can verify an email
   was already sent, mark that specific job `sent` with `sent_at = now()` in
   SQL Editor. Do not bulk-mark unverified jobs: they may not have been emailed.
   A short maintenance window without submissions avoids this transition issue.
5. Run `installEmailWorker` manually once and grant the requested permissions.
   It installs one one-minute trigger; repeating it does not add another.
6. With a test business whose notification inbox you control, submit one anonymous
   comment. Verify the feedback row, its queue job, and email arrival. Run
   `processFeedbackEmails` manually if desired. The worker processes up to 20
   jobs per run, within a four-minute budget.
7. Publish the updated `script.js` and `reviewcard.html` through your normal
   website deployment. Verify a submission creates one database POST and no
   browser request to Google Apps Script.

The scheduled worker runs saved Apps Script code. Web-app callers use the
deployed version, which is why both saving and updating the deployment matter.

## Monitoring and recovery

Use the Apps Script Executions panel for worker failures. In Supabase SQL Editor:

```sql
select id, feedback_id, status, attempts, created_at, sent_at, last_error
from public.feedback_email_jobs
order by created_at desc
limit 50;
```

The queue is inaccessible to browser roles. Worker RPCs are executable only by
`service_role`. Existing business/feedback table permissions are unchanged.

Jobs retry after 2, 4, 8, and 16 minutes, then remain `failed` after five attempts.
A worker crash releases its job after a ten-minute lease. Exhausted mail quota
leaves unclaimed jobs pending without consuming attempts. Fix a missing email,
ambiguous business ID, or mail configuration before retrying a failed job:

```sql
update public.feedback_email_jobs
set status = 'pending', attempts = 0, available_at = now(),
    lease_token = null, last_error = null
where id = 'REPLACE-WITH-JOB-UUID' and status = 'failed';
```

`sent` means MailApp accepted the send call, not that the recipient's inbox
confirmed delivery. MailApp cannot atomically send and acknowledge a database
job: if sending succeeds but acknowledgement fails, a retry can send a duplicate.
The feedback reference helps recognize it. This queue provides retryable delivery,
not exactly-once email. The webpage's existing insert retry can also create two
feedback rows if a successful save response is lost; submission idempotency is a
separate improvement and is not implemented here.

The queue retains a copy of each comment. Include it in any future feedback
deletion/retention process. Mail quota or a backlog can delay delivery beyond a
minute; neither delays the customer's confirmation.

## Local checks

Run `node --test tests/email-queue.test.cjs`. These use mocked Apps Script services
and browser requests; they do not send real email or access production. The SQL
migration and trigger still need verification in Supabase before deployment.

## Rollback

Prefer fixing the worker while jobs remain pending. If reverting fully, pause
submissions, stop only the `processFeedbackEmails` time trigger, disable the
`feedback_email_enqueue` trigger on `public.feedbacks`, restore the old Apps
Script deployment and previous webpage together, then resume submissions.
Retain queue rows for reconciliation; do not automatically replay them alongside
the old email path. Re-enabling the queue later requires reviewing pending jobs.

## References

- [Apps Script time-driven triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- [Script Properties](https://developers.google.com/apps-script/guides/properties)
- [MailApp and recipient quotas](https://developers.google.com/apps-script/reference/mail/mail-app)
- [Supabase function permissions](https://supabase.com/docs/guides/database/functions)
