// verify68.js — site icon: favicon links (SVG, PNG, ICO, Apple touch icon) all
// resolve, and the same icon shows at the top left of the header.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8868;
const ROOT = path.join(__dirname, '..');
function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  const links = await page.$$eval('head link[rel~="icon"], head link[rel="apple-touch-icon"]', ls => ls.map(l => [l.rel, l.getAttribute('href')]));
  const hrefs = links.map(l => l[1]).sort();
  assert.deepStrictEqual(hrefs, ['assets/apple-touch-icon.png', 'assets/favicon-32.png', 'assets/favicon.ico', 'assets/favicon.svg']);
  for (const h of hrefs) {
    const res = await page.request.get(`http://localhost:${PORT}/${h}`);
    assert.strictEqual(res.status(), 200, `${h} should load`);
    assert((await res.body()).length > 200, `${h} should not be empty`);
  }
  ok('SVG, PNG, ICO and Apple touch icon links all resolve');

  // Header: the icon is the first thing at the top left, ahead of the title.
  const box = await page.$eval('.brand .brand-mark', el => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, x: r.left, y: r.top, w: r.width, h: r.height, loaded: el.naturalWidth > 0 };
  });
  assert.strictEqual(box.tag, 'IMG');
  assert(box.loaded, 'icon image loaded');
  assert(box.x < 60 && box.y < 40, `icon at top left, got ${box.x},${box.y}`);
  assert(box.w >= 28 && box.h >= 28, 'icon is a readable size');
  const titleX = await page.$eval('.brand span', el => el.getBoundingClientRect().left);
  assert(titleX > box.x + box.w - 1, 'title sits to the right of the icon');
  ok('Icon sits at the top left of the header, left of the title');

  // Same in dark mode.
  await page.click('#btn-theme-toggle');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.$eval('.brand .brand-mark', el => el.naturalWidth > 0), true);
  ok('Icon also shows in dark mode');

  console.log('\nAll verify68 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
