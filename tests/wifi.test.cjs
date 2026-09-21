const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');

function fixture(clipboard) {
  const elements = new Map();
  const document = { activeElement: null, getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, textContent: '', dataset: {}, events: {}, open: false,
      addEventListener(name, handler) { this.events[name] = handler; },
      focus() { document.activeElement = this; },
      showModal() { this.open = true; },
      close() { this.open = false; this.events.close(); },
      getBoundingClientRect() { return { left: 20, right: 300, top: 20, bottom: 400 }; }
    });
    return elements.get(id);
  } };
  const context = vm.createContext({ document, navigator: { clipboard }, translate: key => key });
  vm.runInContext(source.slice(source.indexOf('function renderWifi'), source.indexOf('function preconnectToGoogle')), context);
  context.setupWifi();
  return { context, document, get: id => document.getElementById(id) };
}

test('hides incomplete configuration and preserves exact plain-text credentials', () => {
  const { context, get } = fixture();
  const password = ' <b>&秘密 password </b> ';
  context.renderWifi({ wifi_ssid: ' Guest ', wifi_password: password });
  assert.equal(get('joinWifiBtn').hidden, false);
  assert.equal(get('wifiSsid').textContent, ' Guest ');
  assert.equal(get('wifiPassword').textContent, password);
  for (const row of [{}, { wifi_ssid: 'Guest' }, { wifi_ssid: 'Guest', wifi_password: ' ' },
    { wifi_ssid: null, wifi_password: 'secret' }, { wifi_ssid: 12, wifi_password: 'secret' }]) {
    context.renderWifi(row);
    assert.equal(get('joinWifiBtn').hidden, true);
    assert.equal(get('wifiPassword').textContent, '');
  }
});

test('copies without trimming and resets status when reopened', async () => {
  let copied;
  const { context, get } = fixture({ writeText: async value => { copied = value; } });
  context.renderWifi({ wifi_ssid: 'Guest', wifi_password: ' secret & ' });
  get('joinWifiBtn').events.click();
  await get('copyWifiBtn').events.click();
  assert.equal(copied, ' secret & ');
  assert.equal(get('wifiCopyStatus').textContent, 'wifiCopied');
  assert.equal(get('copyWifiBtn').dataset.copied, 'true');
  assert.equal(get('copyWifiBtn').textContent, 'wifiCopied');
  get('closeWifiBtn').events.click();
  get('joinWifiBtn').events.click();
  assert.equal(get('wifiCopyStatus').textContent, '');
  assert.equal(get('wifiCopyStatus').dataset.i18n, undefined);
  assert.equal(get('copyWifiBtn').dataset.copied, 'false');
  assert.equal(get('copyWifiBtn').textContent, 'copyPassword');
});

test('missing or denied clipboard leaves password available with manual instructions', async () => {
  for (const clipboard of [undefined, { writeText: async () => { throw new Error('Denied'); } }]) {
    const { context, get } = fixture(clipboard);
    context.renderWifi({ wifi_ssid: 'Guest', wifi_password: 'secret' });
    get('joinWifiBtn').events.click();
    await get('copyWifiBtn').events.click();
    assert.equal(get('wifiCopyStatus').textContent, 'wifiCopyFailed');
    assert.equal(get('copyWifiBtn').dataset.copied, 'false');
    assert.equal(get('wifiPassword').textContent, 'secret');
  }
});

test('late clipboard completion does not update a reopened dialog', async () => {
  let resolve;
  const { get } = fixture({ writeText: () => new Promise(done => { resolve = done; }) });
  get('joinWifiBtn').events.click();
  const pending = get('copyWifiBtn').events.click();
  get('closeWifiBtn').events.click();
  get('joinWifiBtn').events.click();
  resolve();
  await pending;
  assert.equal(get('wifiCopyStatus').textContent, '');
});

test('wraps keyboard focus and only dismisses gestures outside the panel', () => {
  const { document, get } = fixture();
  const dialog = get('wifiDialog');
  get('joinWifiBtn').events.click();
  get('closeWifiBtn').focus();
  dialog.events.keydown({ key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(document.activeElement, get('copyWifiBtn'));
  dialog.events.keydown({ key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(document.activeElement, get('closeWifiBtn'));
  const inside = { target: dialog, clientX: 50, clientY: 50 };
  const outside = { target: dialog, clientX: 0, clientY: 0 };
  dialog.events.pointerdown(inside);
  dialog.events.click(outside);
  assert.equal(dialog.open, true);
  dialog.events.pointerdown(outside);
  dialog.events.click(outside);
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, get('joinWifiBtn'));
});
