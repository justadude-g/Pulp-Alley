// verify48.js — The League Roster's "no perks selected" hint used to say
// "browse all 36" perks, a hardcoded number that had gone stale (the perk
// library actually has 41 entries by the time this was caught). It's now
// filled in from PERKS.length at load, so it can never silently drift out
// of sync with perksData.js again.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8898;
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

  const actualPerkCount = await page.evaluate(() => PERKS.length);
  assert.ok(actualPerkCount > 0, 'expected PERKS to be a non-empty array');

  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);

  const hintText = await page.$eval('#roster-perks-empty', el => el.textContent);
  assert.ok(hintText.includes(String(actualPerkCount)), `expected the "no perks selected" hint to cite the real perk count (${actualPerkCount}), got "${hintText}"`);
  assert.ok(!hintText.includes('36'), `expected the stale hardcoded "36" to be gone from the hint, got "${hintText}"`);
  ok(`The perk count hint correctly cites PERKS.length (${actualPerkCount}), not a stale hardcoded number`);

  console.log('\nAll verify48 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
