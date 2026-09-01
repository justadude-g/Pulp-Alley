// verify38.js — Export Backup gains a Theme filter. By default ("All
// Themes") it exports everything, unchanged. Picking a specific Theme
// exports only that Theme's cards (and, deliberately, no rosters — a
// roster can mix colleagues from several Themes, so there's no single
// Theme a roster belongs to, and including every roster in a themed
// export would defeat the point of keeping it small). The filename also
// picks up a slug of the chosen Theme.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const fs = require('fs');
const assert = require('assert');
const PORT = 8879;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 0. The Theme filter dropdown exists next to Export Backup,
  // defaulting to "All Themes". ----
  const initialValue = await page.inputValue('#backup-theme-filter');
  assert.strictEqual(initialValue, '', 'expected the backup Theme filter to default to "All Themes" (empty value)');
  ok('Export Backup has a Theme filter dropdown, defaulting to "All Themes"');

  // ---- 1. With nothing saved yet, exporting (Theme filter still on "All
  // Themes") shows the existing "nothing saved yet" alert, not a download —
  // unchanged from before this feature. ----
  const [nothingSavedDialog] = await Promise.all([
    page.waitForEvent('dialog'),
    page.click('#btn-export-backup'),
  ]);
  assert.strictEqual(nothingSavedDialog.message(), 'Nothing saved yet — build and save a card or roster first.', `unexpected alert text: "${nothingSavedDialog.message()}"`);
  await nothingSavedDialog.accept();
  ok('Exporting with nothing saved yet still shows the original "nothing saved yet" alert');

  // ---- 2. Build up cards across two Themes plus one roster, so a filtered
  // export has something real to distinguish from a full one. ----
  async function saveCard(name, theme) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.fill('#f-name', name);
    await page.fill('#f-collection', theme);
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }
  await saveCard('Luke', 'Star Wars');
  await saveCard('Leia', 'Star Wars');
  await saveCard('McClane', 'Die Hard');

  // A roster with a colleague, so a full export has a roster to compare
  // against a themed export (which should drop it).
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.fill('#roster-name', 'Test League');
  await page.click('#roster-save');
  await page.waitForTimeout(200);

  // ---- 3. The Theme filter now offers both Themes used above, alongside
  // "All Themes". ----
  const backupOptions = await page.$$eval('#backup-theme-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(backupOptions.sort(), ['All Themes', 'Die Hard', 'Star Wars'].sort(), `expected the backup Theme filter to list both Themes, got ${JSON.stringify(backupOptions)}`);
  ok('The backup Theme filter is populated with every Theme in use, same as the other Theme dropdowns');

  // ---- 4. Exporting with "All Themes" (the default) still exports
  // everything, cards and rosters both — unchanged from before this
  // feature. ----
  let [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-backup'),
  ]);
  let fullFilename = download.suggestedFilename();
  assert.ok(/^pulp-alley-backup-\d{4}-\d{2}-\d{2}\.json$/.test(fullFilename), `expected an unfiltered export filename with no Theme suffix, got "${fullFilename}"`);
  let fullData = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.strictEqual(fullData.cards.length, 3, `expected all 3 cards in an unfiltered export, got ${fullData.cards.length}`);
  assert.strictEqual(fullData.rosters.length, 1, `expected the roster included in an unfiltered export, got ${fullData.rosters.length}`);
  assert.strictEqual(fullData.themeFilter, null, 'expected themeFilter to be null on an unfiltered export');
  ok('Exporting with "All Themes" still bundles every card and every roster, unchanged');

  // ---- 5. Exporting a specific Theme ("Star Wars") includes only that
  // Theme's cards, no rosters, and the filename picks up a Theme slug. ----
  await page.selectOption('#backup-theme-filter', 'Star Wars');
  await page.waitForTimeout(100);
  [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-backup'),
  ]);
  const swFilename = download.suggestedFilename();
  assert.ok(/^pulp-alley-backup-star-wars-\d{4}-\d{2}-\d{2}\.json$/.test(swFilename), `expected the filtered export filename to carry a "star-wars" slug, got "${swFilename}"`);
  const swData = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  const swNames = swData.cards.map(c => c.formData?.name).sort();
  assert.deepStrictEqual(swNames, ['Leia', 'Luke'], `expected only the Star Wars cards in a Star Wars-filtered export, got ${JSON.stringify(swNames)}`);
  assert.strictEqual(swData.rosters.length, 0, 'expected a Theme-filtered export to include no rosters');
  assert.strictEqual(swData.themeFilter, 'Star Wars', 'expected themeFilter to record which Theme was exported');
  ok('A Theme-filtered export ("Star Wars") includes only that Theme\'s cards, no rosters, and the filename carries a "star-wars" slug');

  // ---- 6. The other Theme (Die Hard, 1 card) exports just that one card —
  // proving the filter isn't hardcoded to whichever Theme was tested above. ----
  await page.selectOption('#backup-theme-filter', 'Die Hard');
  await page.waitForTimeout(100);
  [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-backup'),
  ]);
  const dhData = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.deepStrictEqual(dhData.cards.map(c => c.formData?.name), ['McClane'], `expected only McClane in a Die Hard-filtered export, got ${JSON.stringify(dhData.cards.map(c => c.formData?.name))}`);
  assert.strictEqual(dhData.rosters.length, 0, 'expected the Die Hard-filtered export to include no rosters either');
  ok('Switching the filter to the other Theme (Die Hard) exports only that Theme\'s card');

  // ---- 7. Re-importing a Theme-filtered backup works exactly like any
  // other backup (merge by id, existing behavior untouched). ----
  await page.evaluate(async (data) => {
    const result = await importAllData(data);
    window.__importResult = result;
  }, swData);
  const importResult = await page.evaluate(() => window.__importResult);
  assert.strictEqual(importResult.cardsImported, 2, `expected re-importing the Star Wars backup to import its 2 cards, got ${importResult.cardsImported}`);
  assert.strictEqual(importResult.rostersImported, 0, 'expected 0 rosters imported from a Theme-filtered backup (it had none)');
  ok('A Theme-filtered backup file imports back in normally (just with 0 rosters, since it was exported with none)');

  assert.deepStrictEqual(errors, [], `expected no page errors, got ${JSON.stringify(errors)}`);
  console.log('\nAll verify38 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
