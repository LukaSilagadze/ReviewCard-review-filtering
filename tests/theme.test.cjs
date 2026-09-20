const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const properties = new Map();
const context = vm.createContext({ document: { documentElement: { style: { setProperty: (k,v) => properties.set(k,v) } } } });
vm.runInContext(source.slice(source.indexOf('function applyAccentColor('), source.indexOf('function goToGoogle(')), context);
function luminance(channels) {
  return channels.map(c => c/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
    .reduce((sum,c,i) => sum+c*[.2126,.7152,.0722][i], 0);
}
function ratio(fill, foreground) {
  const l = luminance(fill);
  return foreground === '#ffffff' ? 1.05/(l+.05) : (l+.05)/.05;
}
test('business accent and hover text meet 4.5:1 across the color range', () => {
  for(let r=0;r<=255;r+=17) for(let g=0;g<=255;g+=17) for(let b=0;b<=255;b+=17) {
    const hex = '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
    context.applyAccentColor(hex);
    assert.equal(properties.get('--blue'), hex);
    assert.ok(ratio([r,g,b],properties.get('--button-text')) >= 4.5, hex);
    assert.ok(ratio([r,g,b].map(c=>Math.round(c*.84)),properties.get('--button-hover-text')) >= 4.5, hex+' hover');
  }
});
test('invalid accents do not overwrite the palette', () => {
  context.applyAccentColor('#fff');
  const before = [...properties];
  context.applyAccentColor('invalid');
  assert.deepEqual([...properties], before);
  assert.equal(properties.get('--button-text'), '#000000');
});
test('theme text and defaults meet contrast on their surfaces', () => {
  const cases = [
    ['343a46','ffffff'],['646d7b','ffffff'],['47658c','ffffff'],
    ['f1f3f7','181e28'],['f1f3f7','222b38'],['b0bac9','181e28'],['b0bac9','222b38'],['a9c9ff','181e28']
  ];
  const rgb = hex => hex.match(/../g).map(c=>parseInt(c,16));
  for(const [fg,bg] of cases) {
    const [lo,hi] = [luminance(rgb(fg)),luminance(rgb(bg))].sort((a,b)=>a-b);
    assert.ok((hi+.05)/(lo+.05)>=4.5, fg+' on '+bg);
  }
  assert.ok(ratio(rgb('637fa8'),'#000000')>=4.5);
  assert.ok(ratio(rgb('526d94'),'#ffffff')>=4.5);
});
