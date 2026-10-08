const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../reviewcard.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
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

test('places the styled Font Awesome YouTube button after TikTok', () => {
  assert.ok(html.indexOf('id="youtubeLink"') > html.indexOf('id="tiktokLink"'));
  assert.match(html, /class="fa-brands fa-youtube social-icon"/);
  assert.match(css, /\.social-link-youtube\s*\{[\s\S]*?--social-gradient:\s*linear-gradient\([^}]*#ff2d3b/i);
});

test('accepts HTTPS platform profiles and Facebook numeric-ID links', () => {
  for (const [url, platform] of [
    ['https://www.facebook.com/profile.php?id=123', 'facebook'],
    ['https://facebook.com/example', 'facebook'],
    ['https://www.instagram.com/example/', 'instagram'],
    ['https://www.youtube.com/@example', 'youtube'],
    ['https://youtube.com/channel/example', 'youtube']
  ]) assert.equal(context.socialProfileUrl(url, platform), url);
});

test('rejects unsafe URLs, lookalike domains and wrong platforms', () => {
  for (const url of [null, '', 'broken', 'http://facebook.com/example', 'javascript:alert(1)',
    'https://facebook.com.evil.test/example', 'https://notfacebook.com/example',
    'https://facebook.com@evil.test/example', 'https://user:pass@facebook.com/example',
    'https://facebook.com:8443/example', 'https://instagram.com/example']) {
    assert.equal(context.socialProfileUrl(url, 'facebook'), null, String(url));
  }
  for (const url of ['http://youtube.com/@example', 'https://youtube.com.evil.test/@example',
    'https://youtube.com@evil.test/@example', 'https://user:pass@youtube.com/@example',
    'https://youtube.com:8443/@example', 'https://youtu.be/example', 'https://tiktok.com/@example']) {
    assert.equal(context.socialProfileUrl(url, 'youtube'), null, String(url));
  }
});

test('renders optional accounts with plain text, accessible names and fallback', () => {
  context.renderSocialLinks({ name: 'Cafe', facebook_url: 'https://facebook.com/cafe',
    facebook_username: '<b>Cafe</b>', instagram_url: 'https://instagram.com/cafe', instagram_username: ' ',
    youtube_url: 'https://youtube.com/@cafe', youtube_username: '<b>@cafe</b>' });
  assert.equal(get('socialLinks').hidden, false);
  assert.equal(get('facebookUsername').textContent, '<b>Cafe</b>');
  assert.equal(get('instagramUsername').textContent, 'Cafe');
  assert.match(get('instagramLink')['aria-label'], /Instagram: Cafe/);
  assert.equal(get('youtubeUsername').textContent, '<b>@cafe</b>');
  assert.equal(get('youtubeLink').href, 'https://youtube.com/@cafe');
  assert.match(get('youtubeLink')['aria-label'], /YouTube: Cafe/);
  context.renderSocialLinks({ name: 'Cafe', instagram_url: 'https://instagram.com/cafe' });
  assert.equal(get('facebookLink').hidden, true);
  assert.equal(get('facebookLink').href, undefined);
  assert.equal(get('instagramLink').hidden, false);
  assert.equal(get('youtubeLink').hidden, true);
  assert.equal(get('youtubeLink').href, undefined);
  context.renderSocialLinks({ name: 'Cafe', youtube_url: 'https://youtube.com/@cafe', youtube_username: ' ' });
  assert.equal(get('youtubeLink').hidden, false);
  assert.equal(get('youtubeUsername').textContent, 'Cafe');
  context.renderSocialLinks({ name: 'Cafe' });
  assert.equal(get('socialLinks').hidden, true);
  assert.equal(get('instagramLink').href, undefined);
  assert.equal(get('youtubeLink').href, undefined);
});
