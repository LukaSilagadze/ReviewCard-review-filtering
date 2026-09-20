// Local-only browser fixture: no production requests or real feedback/email writes.
// Run: node tests/preview-socials.cjs; open http://localhost:8765/reviewcard.html?biz=preview
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' })[ext] || 'text/plain');
  let data = fs.readFileSync(file);
  if (ext === '.html') {
    const row = { name: url.searchParams.has('long') ? 'A very long business name without clipping' : 'Garden Cafe',
      google_review_link: 'https://www.google.com/', logo_url: null,
      facebook_url: 'https://www.facebook.com/gardencafe', facebook_username: 'garden.cafe',
      instagram_url: 'https://www.instagram.com/gardencafe/', instagram_username: '@garden.cafe' };
    if (url.searchParams.has('long')) row.instagram_username = '@' + 'verylongusername'.repeat(5);
    if (url.searchParams.has('none')) { row.facebook_url = null; row.instagram_url = null; }
    if (url.searchParams.has('one')) row.facebook_url = 'https://evil.test/';
    const fixture = `<script>window.fetch=async()=>({ok:true,json:async()=>[${JSON.stringify(row)}]});</script>`;
    const language = ['ka', 'en', 'ru'].includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'ka';
    data = data.toString().replace('<script src="script.js"></script>', fixture + '<script src="script.js"></script>' + `<script>applyLanguage(${JSON.stringify(language)});</script>`);
  }
  res.end(data);
}).listen(8765, '127.0.0.1', () => console.log('Local mocked preview: http://localhost:8765/reviewcard.html?biz=preview'));
