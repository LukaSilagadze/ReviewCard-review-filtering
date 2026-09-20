const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const elements = new Map();
function get(id) {
  if (!elements.has(id)) elements.set(id, {
    hidden: false, textContent: '',
    setAttribute(key, value) { this[key] = value; },
    removeAttribute(key) { delete this[key]; }
  });
  return elements.get(id);
}
const context = vm.createContext({ URL, document: { getElementById: get } });
vm.runInContext(source.slice(source.indexOf('function socialProfileUrl'), source.indexOf('function preconnectToGoogle')), context);

test('accepts HTTPS platform profiles and Facebook numeric-ID links', () => {
  for (const [url, platform] of [
    ['https://www.facebook.com/profile.php?id=123', 'facebook'],
    ['https://facebook.com/example', 'facebook'],
    ['https://www.instagram.com/example/', 'instagram']
  ]) assert.equal(context.socialProfileUrl(url, platform), url);
});

test('rejects unsafe URLs, lookalike domains and wrong platforms', () => {
  for (const url of [null, '', 'broken', 'http://facebook.com/example', 'javascript:alert(1)',
    'https://facebook.com.evil.test/example', 'https://notfacebook.com/example',
    'https://facebook.com@evil.test/example', 'https://user:pass@facebook.com/example',
    'https://facebook.com:8443/example', 'https://instagram.com/example']) {
    assert.equal(context.socialProfileUrl(url, 'facebook'), null, String(url));
  }
});

test('renders optional accounts with plain text, accessible names and fallback', () => {
  context.renderSocialLinks({ name: 'Cafe', facebook_url: 'https://facebook.com/cafe',
    facebook_username: '<b>Cafe</b>', instagram_url: 'https://instagram.com/cafe', instagram_username: ' ' });
  assert.equal(get('socialLinks').hidden, false);
  assert.equal(get('facebookUsername').textContent, '<b>Cafe</b>');
  assert.equal(get('instagramUsername').textContent, 'Cafe');
  assert.match(get('instagramLink')['aria-label'], /Instagram: Cafe/);
  context.renderSocialLinks({ name: 'Cafe', instagram_url: 'https://instagram.com/cafe' });
  assert.equal(get('facebookLink').hidden, true);
  assert.equal(get('facebookLink').href, undefined);
  assert.equal(get('instagramLink').hidden, false);
  context.renderSocialLinks({ name: 'Cafe' });
  assert.equal(get('socialLinks').hidden, true);
  assert.equal(get('instagramLink').href, undefined);
});
