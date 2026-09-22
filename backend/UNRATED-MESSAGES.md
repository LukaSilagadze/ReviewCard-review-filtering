# Unrated private messages

The page now offers every visitor a Google review or a private message. Private
messages send `rating: null`; no sentiment is inferred. Historical ratings remain.

## Deploy in order

1. Inspect the live schema in Supabase SQL Editor before applying the migration:

   ```sql
   select column_name, data_type, is_nullable, column_default, domain_name
   from information_schema.columns
   where table_schema = 'public' and table_name = 'feedbacks';
   select conname, pg_get_constraintdef(oid)
   from pg_constraint where conrelid = 'public.feedbacks'::regclass;
   select policyname, cmd, qual, with_check from pg_policies
   where schemaname = 'public' and tablename = 'feedbacks';
   ```

   Confirm checks, any rating domain and INSERT policies accept a null rating.
   Ordinary range checks allow null, but explicit non-null checks or policies may
   reject it. Resolve such constraints before deployment; do not remove unrelated
   validation or access controls. The base feedback table is not defined in this
   repository, so its live constraints cannot be verified from these files.
2. With the queue from `001-email-queue.sql` installed, apply
   `005-unrated-messages.sql`. It removes the rating NOT NULL/default and queues
   every new private message. It does not backfill or change existing jobs.
3. Update Apps Script from `EmailWorker.gs` and update the webhook deployment if
   used. Unrated emails omit the rating line; historical rated jobs retain it.
   Keep the scheduled `processFeedbackEmails` trigger installed: the current
   repository's `doPost` only acknowledges requests and does not wake the worker.
   Five existing webhook tests fail on the baseline for this reason; webhook
   repair is separate from removing review filtering.
4. On a staging database, insert an unrated message through the same anonymous
   REST role as the page. Verify exactly one job contains the comment and null
   rating. Verify a rated insert also queues one job. Roll back fixture data or
   use a test business and inbox. Check worker delivery and retries there.
5. Publish the frontend after these checks pass.

Run `node --test tests/*.test.cjs` for local regression checks. These mock the
backend; the SQL/policy and actual queue checks above require a staging database.

For rollback, restore the previous frontend and worker; the nullable column and
broader queue trigger remain compatible. Do not restore NOT NULL while unrated
messages exist, or relabel those messages with fabricated ratings.
