// verify67.js — page footer: Feedback (GitHub issues) link, version, community
// credit with the Pulp Alley link. Appears below every tab, hidden in print.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8867;
const ROOT = path.join(__dirname, '..');
function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  const text = (await page.textContent('.site-footer')).replace(/\s+/g, ' ').trim();
  assert(/Feedback · Version \d{4}-\d{2}-\d{2}/.test(text), `footer line 1, got "${text}"`);
  assert(/Community tool for the Pulp Alley, made with permission from David Phipps\. Pulp Alley/.test(text), `footer line 2, got "${text}"`);
  const links = await page.$$eval('.site-footer a', as => as.map(a => [a.textContent, a.href, a.target, a.rel]));
  assert.deepStrictEqual(links, [
    ['Feedback', 'https://github.com/justadude-g/Pulp-Alley/issues', '_blank', 'noopener'],
    ['Pulp Alley', 'https://www.pulpalley.com/', '_blank', 'noopener'],
  ]);
  ok('Footer text and both links are correct');

  // Sits below the content on every tab.
  for (const tab of ['designer', 'gallery', 'roster', 'quickref']) {
    await page.click(`.tab-btn[data-tab="${tab}"]`);
    await page.waitForTimeout(150);
    const below = await page.evaluate(() => {
      const f = document.querySelector('.site-footer').getBoundingClientRect().top + scrollY;
      const m = document.querySelector('main').getBoundingClientRect().bottom + scrollY;
      return f >= m - 1;
    });
    assert(below, `footer below main on ${tab}`);
    assert.strictEqual(await page.isVisible('.site-footer'), true);
  }
  ok('Footer shows below the content on every tab');

  await page.emulateMedia({ media: 'print' });
  assert.strictEqual(await page.isVisible('.site-footer'), false, 'hidden when printing');
  ok('Footer is hidden in print');

  console.log('\nAll verify67 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
