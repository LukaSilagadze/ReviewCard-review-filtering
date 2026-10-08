const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../reviewcard.html'), 'utf8');

function fixture() {
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
  const context = vm.createContext({ document, translate: key => key });
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

test('dialog displays credentials without a copy-password control', () => {
  const { context, get } = fixture();
  context.renderWifi({ wifi_ssid: 'Guest', wifi_password: ' secret & ' });
  get('joinWifiBtn').events.click();
  assert.equal(get('wifiPassword').textContent, ' secret & ');
  assert.doesNotMatch(html, /copyWifiBtn|wifiCopyStatus|data-i18n="copyPassword"/);
  assert.doesNotMatch(source, /navigator\.clipboard|copyPassword|wifiCopied|wifiCopyFailed/);
});

test('restores focus and only dismisses gestures outside the panel', () => {
  const { document, get } = fixture();
  const dialog = get('wifiDialog');
  get('joinWifiBtn').events.click();
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
