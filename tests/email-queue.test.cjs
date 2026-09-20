const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'backend/EmailWorker.gs'), 'utf8');
const page = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

function harness(options = {}) {
  const jobs = options.jobs || [{ id: 'job-1', lease_token: 'lease-1', biz_id: 'test', feedback_id: '42', rating: '1', comment: 'Anonymous comment' }];
  const state = { sent: [], acknowledgements: [], claims: 0, released: false, triggers: 0 };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => {
      if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
      if (key === 'EMAIL_WEBHOOK_TOKEN') return options.webhookToken ?? 'test-webhook-token-with-at-least-32-characters';
      return 'server-only-test-key';
    } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => options.locked !== true, releaseLock: () => { state.released = true; } }) },
    MailApp: {
      getRemainingDailyQuota: () => options.quota ?? 10,
      sendEmail: (...args) => { if (options.mailFails) throw Error('private provider message'); state.sent.push(args); }
    },
    UrlFetchApp: { fetch: (url, request) => {
      assert.equal(request.headers.Authorization, 'Bearer server-only-test-key');
      let body;
      let status = 200;
      if (url.endsWith('rpc/claim_feedback_email')) {
        state.claims++;
        body = jobs.length ? [jobs.shift()] : [];
      } else if (url.endsWith('rpc/finish_feedback_email')) {
        state.acknowledgements.push(JSON.parse(request.payload));
        body = true;
        if (options.ackFails) status = 503;
      } else {
        body = options.businesses || [{ name: 'Test Business', notify_email: 'owner@example.com' }];
        if (options.lookupFails) status = 503;
      }
      return { getResponseCode: () => status, getContentText: () => JSON.stringify(body) };
    } },
    ScriptApp: {
      getProjectTriggers: () => state.triggers ? [{ getHandlerFunction: () => 'processFeedbackEmails' }] : [],
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: n => { assert.equal(n, 1); return { create: () => { state.triggers++; } }; } }) })
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ setMimeType: () => JSON.parse(text) })
    }
  });
  vm.runInContext(worker, context);
  return { state, context };
}

test('two comments for the same business both send, without a throttle', () => {
  const jobs = [1, 2].map(id => ({ id: String(id), lease_token: 'lease', biz_id: 'same', feedback_id: String(id), rating: '1', comment: 'Feedback ' + id }));
  const { state, context } = harness({ jobs });
  context.processFeedbackEmails();
  assert.equal(state.sent.length, 2);
  assert.ok(state.sent[0][2].includes('Feedback 1'));
  assert.ok(state.sent[0][1].includes('ახალი უკუკავშირი'));
  assert.ok(state.acknowledgements.every(ack => ack.p_sent && ack.p_error === null));
  assert.equal(state.released, true);
});

for (const [name, options, code] of [
  ['mail error', { mailFails: true }, 'mail_send_failed'],
  ['lookup error', { lookupFails: true }, 'business_lookup_failed'],
  ['missing business', { businesses: [] }, 'missing_or_ambiguous_business_email'],
  ['duplicate business', { businesses: [{ notify_email: 'a' }, { notify_email: 'b' }] }, 'missing_or_ambiguous_business_email']
]) {
  test(name + ' records a retryable failure without logging customer data', () => {
    const { state, context } = harness(options);
    context.processFeedbackEmails();
    assert.equal(state.sent.length, 0);
    assert.equal(state.acknowledgements[0].p_sent, false);
    assert.equal(state.acknowledgements[0].p_error, code);
    assert.equal(state.released, true);
  });
}

test('quota exhaustion leaves jobs unclaimed', () => {
  const { state, context } = harness({ quota: 0 });
  context.processFeedbackEmails();
  assert.equal(state.claims, 0);
  assert.equal(state.released, true);
});

test('overlapping worker exits without claiming', () => {
  const { state, context } = harness({ locked: true });
  context.processFeedbackEmails();
  assert.equal(state.claims, 0);
  assert.equal(state.released, false);
});

test('failed acknowledgement stops processing and releases the lock', () => {
  const { state, context } = harness({ ackFails: true });
  assert.throws(() => context.processFeedbackEmails(), /HTTP 503/);
  assert.equal(state.sent.length, 1);
  assert.equal(state.claims, 1);
  assert.equal(state.released, true);
});

test('worker installation is repeatable without duplicate triggers', () => {
  const { state, context } = harness();
  context.installEmailWorker();
  context.installEmailWorker();
  assert.equal(state.triggers, 1);
});

test('old browser endpoint cannot send or enqueue an email', () => {
  const { state, context } = harness();
  assert.equal(context.doPost().ok, false);
  assert.equal(state.sent.length, 0);
  assert.equal(state.claims, 0);
});

test('authenticated webhook immediately processes saved jobs', () => {
  const { state, context } = harness();
  const response = context.doPost({ parameter: { token: 'test-webhook-token-with-at-least-32-characters' },
    postData: { contents: JSON.stringify({ comment: 'Untrusted incoming text' }) } });
  assert.equal(response.ok, true);
  assert.equal(state.sent.length, 1);
  assert.ok(state.sent[0][2].includes('Anonymous comment'));
  assert.ok(!state.sent[0][2].includes('Untrusted incoming text'));
});

for (const webhookToken of ['', 'too-short', 'a-different-long-secret-token-value']) {
  test('webhook rejects missing, short, or mismatched configuration: ' + webhookToken, () => {
    const { state, context } = harness({ webhookToken });
    assert.equal(context.doPost({ parameter: { token: 'test-webhook-token-with-at-least-32-characters' } }).ok, false);
    assert.equal(state.claims, 0);
  });
}

for (const fails of [false, true]) {
  test('page ' + (fails ? 'offers retry on save failure' : 'confirms after save') + ' without a browser email request', async () => {
    const elements = new Map();
    const get = id => {
      if (!elements.has(id)) elements.set(id, { value: 'Anonymous comment', style: {}, disabled: false });
      return elements.get(id);
    };
    let calls = 0;
    const context = vm.createContext({
      document: { getElementById: get }, console: { error() {} },
      fetch: async (url, request) => {
        calls++;
        assert.equal(url, 'db/rest/v1/feedbacks');
        assert.equal(JSON.parse(request.body).comment, 'Anonymous comment');
        return { ok: !fails, status: fails ? 503 : 201 };
      }
    });
    vm.runInContext(`const SUPABASE_URL='db', SUPABASE_KEY='key', bizId='test', rating=1;
      const business={notifyEmail:'owner@example.com',name:'Test'};
      function translate(key){return key;}
      ${page.slice(page.indexOf('function show('), page.indexOf('async function loadBusiness('))}
      ${page.slice(page.indexOf('async function saveFeedback('), page.indexOf("document.getElementById('sendFeedbackBtn').addEventListener"))}`, context);
    await context.submitFeedback();
    assert.equal(calls, fails ? 2 : 1);
    assert.equal(get(fails ? 'stageSendError' : 'stageThanks').style.display, 'flex');
    assert.equal(get('sendFeedbackBtn').disabled, false);
    assert.equal(get('feedbackText').value, 'Anonymous comment');
  });
}
