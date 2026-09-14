// Replace the old Apps Script with this file. See backend/README.md for setup.
// Credentials belong in Script Properties, never in the webpage or this file.
function queueConfig() {
  const properties = PropertiesService.getScriptProperties();
  const url = properties.getProperty('SUPABASE_URL');
  const key = properties.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Script Properties.');
  }
  return { url: url, key: key };
}

function queueRequest(path, payload) {
  const config = queueConfig();
  const options = {
    method: payload === undefined ? 'get' : 'post',
    headers: { apikey: config.key, Authorization: 'Bearer ' + config.key },
    muteHttpExceptions: true
  };
  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  const response = UrlFetchApp.fetch(config.url + '/rest/v1/' + path, options);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    // Do not log response bodies: they may contain private feedback.
    throw new Error('Supabase request failed: HTTP ' + response.getResponseCode());
  }
  return JSON.parse(response.getContentText());
}

function processFeedbackEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    queueConfig();
    const deadline = Date.now() + 4 * 60 * 1000;
    for (let count = 0; count < 20 && Date.now() < deadline; count++) {
      // Leave jobs pending while quota is exhausted; do not consume their attempts.
      if (MailApp.getRemainingDailyQuota() < 1) return;
      const jobs = queueRequest('rpc/claim_feedback_email', {});
      if (!Array.isArray(jobs)) throw new Error('Invalid queue response');
      if (jobs.length === 0) return;
      const job = jobs[0];
      let sent = false;
      let errorCode = 'business_lookup_failed';
      try {
        const rows = queueRequest('businesses?biz_id=eq.' + encodeURIComponent(job.biz_id) + '&select=name,notify_email&limit=2');
        if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].notify_email) {
          errorCode = 'missing_or_ambiguous_business_email';
        } else {
          const business = rows[0];
          errorCode = 'mail_send_failed';
          MailApp.sendEmail(
            business.notify_email,
            'ახალი უკუკავშირი კლიენტისგან ' + business.name + '-ზე',
            'თქვენმა მომხმარებელმა ახლახანს დატოვა უკუკავშირი თქვენი ბიზნესის შესახებ.\n\n' +
            'Business: ' + business.name + '\n' +
            'Rating: ' + job.rating + '\n' +
            'Comment: ' + (job.comment || '(no comment left)') + '\n\n' +
            'Feedback reference: ' + job.feedback_id + '\n'
          );
          sent = true;
        }
      } catch (error) {
        // Store only the operation that failed, not customer text or provider errors.
      }
      // If acknowledgement fails, stop. The lease will recover this job later.
      // MailApp has no idempotency key: a crash after sending can cause a duplicate.
      const acknowledged = queueRequest('rpc/finish_feedback_email', {
        p_id: job.id, p_lease_token: job.lease_token,
        p_sent: sent, p_error: sent ? null : errorCode
      });
      if (acknowledged !== true) throw new Error('Email job acknowledgement failed');
    }
  } finally {
    lock.releaseLock();
  }
}

function installEmailWorker() {
  queueConfig();
  // Request mail authorization during manual setup, before the first scheduled run.
  MailApp.getRemainingDailyQuota();
  const triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'processFeedbackEmails';
  });
  if (triggers.length === 0) {
    ScriptApp.newTrigger('processFeedbackEmails').timeBased().everyMinutes(1).create();
  }
}

// Compatibility for already-open pages. Only database inserts can enqueue email.
// Update the existing web-app deployment to this version during rollout.
function doPost() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, queuedByDatabase: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
