const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');

function harness() {
  const elements = new Map();
  let focused;
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      style: {}, handlers: {}, focus() { focused = id; },
      addEventListener(event, fn) { this.handlers[event] = fn; }
    });
    return elements.get(id);
  };
  const window = { location: { href: 'start' } };
  const context = vm.createContext({ document: { getElementById: get }, window });
  vm.runInContext(`const business = { googleReviewLink: 'https://example.com/review' };
    ${page.slice(page.indexOf('function show('), page.indexOf('async function loadBusiness('))}
    ${page.slice(page.indexOf('function goToGoogle('), page.indexOf('async function saveFeedback('))}`, context);
  return { get, window, context, focused: () => focused };
}

test('Google review is direct and available before or after opening a message', () => {
  const h = harness();
  h.get('googleReviewBtn').handlers.click();
  assert.equal(h.window.location.href, 'https://example.com/review');
  h.window.location.href = 'start';
  h.get('leaveMessageBtn').handlers.click();
  h.get('alsoGoogle').handlers.click();
  assert.equal(h.window.location.href, 'https://example.com/review');
});

test('message opens the form; back restores the actions and focus', () => {
  const h = harness();
  h.context.show('stageActions');
  h.get('leaveMessageBtn').handlers.click();
  assert.equal(h.get('stageFeedback').style.display, 'flex');
  assert.equal(h.get('stageActions').style.display, 'none');
  assert.equal(h.focused(), 'feedbackText');
  h.get('backToActionsBtn').handlers.click();
  assert.equal(h.get('stageActions').style.display, 'flex');
  assert.equal(h.get('stageFeedback').style.display, 'none');
  assert.equal(h.focused(), 'leaveMessageBtn');
});
