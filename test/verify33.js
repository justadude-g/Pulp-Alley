// verify33.js — the Export Backup filename now uses the browser's local
// calendar date, not UTC. toISOString() (the old implementation) always
// reports UTC, so anyone far enough behind or ahead of UTC could get a
// filename dated a day off from their actual local date depending on the
// time of day. Reproduces that mismatch deterministically with a fixed
// clock + timezone rather than depending on when the test happens to run.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8874;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // Pacific/Kiritimati is UTC+14 with no DST — the furthest-ahead real
  // timezone, which makes it easy to land on a fixed moment where the local
  // calendar date is a full day ahead of the UTC date.
  const ctx = await browser.newContext({ timezoneId: 'Pacific/Kiritimati', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));

  // Fix "now" to 2026-08-29T20:00:00Z, before navigating so the page's own
  // Date is fixed from first load. In Kiritimati (UTC+14) that instant is
  // already 2026-08-30 10:00 local — a full calendar day ahead of its UTC
  // date, the same kind of gap (just in the opposite direction) that
  // produced the reported bug for a user west of UTC late in their evening.
  await page.clock.install({ time: new Date('2026-08-29T20:00:00Z') });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Sanity-check the fixture: confirm this moment really does have
  // mismatched UTC vs. local calendar dates in this browser. ----
  const utcDate = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  const localDate = await page.evaluate(() => localDateStamp(new Date()));
  assert.strictEqual(utcDate, '2026-08-29', `fixture check: expected UTC date 2026-08-29, got ${utcDate}`);
  assert.strictEqual(localDate, '2026-08-30', `fixture check: expected local (Kiritimati) date 2026-08-30, got ${localDate}`);
  ok('Fixture confirmed: this fixed moment is 2026-08-29 in UTC but 2026-08-30 local (Kiritimati, UTC+14)');

  // ---- 2. Save a card, export a backup, and check the actual downloaded
  // filename uses the local date, not the UTC date. ----
  await page.fill('#f-name', 'Timezone Test Card');
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-backup'),
  ]);
  const filename = download.suggestedFilename();
  assert.strictEqual(filename, 'pulp-alley-backup-2026-08-30.json', `expected the export filename to use the local date (2026-08-30), got "${filename}"`);
  ok(`Export Backup filename ("${filename}") uses the browser's local calendar date, not UTC`);

  assert.deepStrictEqual(errors, [], `expected no page errors, got ${JSON.stringify(errors)}`);
  console.log('\nAll verify33 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
