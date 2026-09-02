// verify47.js — Everything lives only in this browser's IndexedDB, with no
// server copy, so a dismissible banner nags once enough has changed since
// the last Export Backup (BACKUP_NAG_THRESHOLD, currently 5 cards/rosters)
// — reminding the user before a cleared profile silently wipes everything.
// Exercised directly against localStorage + the db layer rather than
// saving 5 real cards through the UI for every scenario, to keep this fast.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8897;
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

  // ---- 1. Nothing saved yet: banner stays hidden. ----
  let hidden = await page.$eval('#backup-reminder-banner', el => el.classList.contains('hidden'));
  assert.strictEqual(hidden, true, 'expected the backup banner to be hidden with nothing saved yet');
  ok('The backup reminder banner is hidden with nothing saved');

  // ---- 2. Seed 4 cards (below BACKUP_NAG_THRESHOLD of 5) — still hidden. ----
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  await page.evaluate(async (pngData) => {
    for (let i = 0; i < 4; i++) {
      await saveCard({ id: `banner-card-${i}`, formData: { name: `Card ${i}` }, pngDataURL: pngData, createdAt: Date.now(), updatedAt: Date.now() });
    }
    await refreshBackupBanner();
  }, png);
  await page.waitForTimeout(150);
  hidden = await page.$eval('#backup-reminder-banner', el => el.classList.contains('hidden'));
  assert.strictEqual(hidden, true, 'expected the banner to stay hidden below the 5-change threshold (4 cards)');
  ok('The banner stays hidden below BACKUP_NAG_THRESHOLD (4 changes)');

  // ---- 3. A 5th card crosses the threshold — banner appears with a
  // message naming the count, and mentions no prior backup. ----
  await page.evaluate(async (pngData) => {
    await saveCard({ id: 'banner-card-4', formData: { name: 'Card 4' }, pngDataURL: pngData, createdAt: Date.now(), updatedAt: Date.now() });
    await refreshBackupBanner();
  }, png);
  await page.waitForTimeout(150);
  hidden = await page.$eval('#backup-reminder-banner', el => el.classList.contains('hidden'));
  assert.strictEqual(hidden, false, 'expected the banner to appear once 5 changes have accumulated with no backup yet');
  let bannerText = await page.$eval('#backup-reminder-text', el => el.textContent);
  assert.ok(/5/.test(bannerText), `expected the banner text to mention the count (5), got "${bannerText}"`);
  ok('The banner appears once the 5-change threshold is crossed, naming the count');

  // ---- 4. Clicking the banner's own Export Backup button runs an export
  // and resets the clock — the banner hides itself afterward. ----
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#backup-reminder-export'),
  ]);
  await download.path(); // ensure the download actually completed
  await page.waitForTimeout(200);
  hidden = await page.$eval('#backup-reminder-banner', el => el.classList.contains('hidden'));
  assert.strictEqual(hidden, true, 'expected the banner to hide itself right after a full Export Backup');
  const lastBackupAt = await page.evaluate(() => localStorage.getItem('pulp-alley-last-backup-at'));
  assert.ok(lastBackupAt && +lastBackupAt > 0, 'expected a lastBackupAt timestamp to be recorded in localStorage after exporting');
  ok('The banner\'s own Export Backup button exports and resets the "since last backup" clock');

  // ---- 5. More changes after that backup re-trigger the banner once 5
  // more accumulate — it's not a one-time nag. ----
  await page.evaluate(async (pngData) => {
    for (let i = 5; i < 10; i++) {
      await saveCard({ id: `banner-card-${i}`, formData: { name: `Card ${i}` }, pngDataURL: pngData, createdAt: Date.now(), updatedAt: Date.now() });
    }
    await refreshBackupBanner();
  }, png);
  await page.waitForTimeout(150);
  hidden = await page.$eval('#backup-reminder-banner', el => el.classList.contains('hidden'));
  assert.strictEqual(hidden, false, 'expected the banner to reappear after 5 more changes since the last backup');
  bannerText = await page.$eval('#backup-reminder-text', el => el.textContent);
  assert.ok(/since your last backup/i.test(bannerText), `expected the re-triggered banner to reference the prior backup, got "${bannerText}"`);
  ok('The banner re-triggers after further changes accumulate past a completed backup — not a one-time nag');

  // ---- 6. Dismissing (✕) hides it for the rest of this session, even
  // though the underlying condition still holds. ----
  await page.click('#backup-reminder-dismiss');
  await page.waitForTimeout(150);
  hidden = await page.$eval('#backup-reminder-banner', el => el.classList.contains('hidden'));
  assert.strictEqual(hidden, true, 'expected dismissing the banner to hide it immediately');
  await page.evaluate(() => refreshBackupBanner());
  await page.waitForTimeout(150);
  hidden = await page.$eval('#backup-reminder-banner', el => el.classList.contains('hidden'));
  assert.strictEqual(hidden, true, 'expected the banner to stay hidden after dismissal even when re-evaluated, for the rest of this session');
  ok('Dismissing the banner keeps it hidden for the rest of the session, even if the condition still holds');

  console.log('\nAll verify47 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
