# Start email processing when feedback arrives

Requires the existing 001 migration and scheduled worker. Do not rerun that
migration. Keep the one-minute trigger for retries and missed webhook requests.

1. In Apps Script replace ONLY the `doPost` function with the one in
   `EmailWorker.gs`, preserving your customized email text. Save.
2. In Project Settings → Script Properties add `EMAIL_WEBHOOK_TOKEN`: a random
   secret with at least 32 characters, generated with a password manager. Use
   letters and numbers for easy URL handling. This must not be a Supabase key.
3. Deploy → Manage deployments → edit the existing web app → New version.
   Set execution to your account and access to Anyone so Supabase can call it
   without a Google login. The handler requires the separate secret token.
   Deploy. Saving alone does not update this HTTP endpoint.
4. In Supabase, Database → Webhooks, enable Webhooks if prompted and create:
   - Name: `wake_feedback_email_worker`
   - Schema/table: `public.feedback_email_jobs`
   - Event: INSERT only (not UPDATE, which would cause repeated wake-ups).
   - Type: HTTP Request; method: POST.
   - URL: your existing Apps Script `/exec` URL followed by
     `?token=YOUR_EMAIL_WEBHOOK_TOKEN`.
   - Header: `Content-Type: application/json`.
   - Timeout: 10000 milliseconds if available.
5. Submit one test comment to a business inbox you control. Check Apps Script
   Executions for a Web App / `doPost` execution and inspect the job below.
   Under low load it should start without waiting for the one-minute timer.

The token-bearing webhook URL is a credential. Store it only in Supabase webhook
configuration; do not commit it, paste it into chat, or include it in screenshots.
Webhook configuration/log access should be limited to trusted administrators.
The standard webhook payload contains the job's anonymous comment. The handler
ignores that payload and reads authoritative saved jobs from Supabase.

```sql
select feedback_id, status, attempts, created_at, sent_at,
       sent_at - created_at as time_until_send, last_error
from public.feedback_email_jobs
order by created_at desc
limit 10;
```

`sent_at` measures MailApp acceptance, not inbox arrival. A quick `sent_at` with a
late inbox arrival points to mail delivery delay. If no `doPost` execution appears,
check webhook configuration, deployment access, and Supabase webhook logs. An
`unauthorized` JSON response means the token is missing or mismatched; Apps Script
may return HTTP 200 even for that response. Google response redirects or webhook
timeouts can occur after processing has started; inspect the queue before retrying.

Existing worker locks and database leases coordinate the timer with webhooks.
Busy workers, Apps Script startup, quotas, retries, and inbox delivery can still
add latency. This removes the deliberate polling wait; it does not guarantee an
exact delivery time. Disable the webhook to return to timer-only processing.

Reference: https://supabase.com/docs/guides/database/webhooks
