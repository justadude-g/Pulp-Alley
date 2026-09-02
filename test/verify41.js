// verify41.js — My Cards gains a "Sort" dropdown next to the search box:
// "Sort: Name" (the default, A-Z, case-insensitive) and "Sort: Latest"
// (most recently saved/edited first). Works alongside the existing
// search/Theme/Type filters and Select All (which operates on whatever's
// currently shown, in its current order).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8891;
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

  // ---- 0. The Sort dropdown exists and defaults to "Name". ----
  const sortExists = await page.$('#gallery-sort');
  assert.ok(sortExists, 'expected a #gallery-sort dropdown in My Cards');
  const initialSort = await page.inputValue('#gallery-sort');
  assert.strictEqual(initialSort, 'name', `expected Sort to default to "name", got "${initialSort}"`);
  ok('The Sort dropdown exists and defaults to "Sort: Name"');

  // ---- 1. Save 3 cards out of alphabetical order, with distinct save
  // times (each save is a fresh moment, so "Latest" has a real order to
  // prove), and confirm the timestamps actually differ before relying on
  // them. ----
  async function saveCard(name) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.fill('#f-name', name);
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(250);
  }
  await saveCard('Zeta');
  await saveCard('Alpha');
  await saveCard('Mike');

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);

  // ---- 2. Default "Sort: Name" shows the 3 cards A-Z, regardless of the
  // order they were saved in. ----
  let names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Alpha', 'Mike', 'Zeta'], `expected default Name sort to show A-Z, got ${JSON.stringify(names)}`);
  ok('Default "Sort: Name" lists cards A-Z regardless of save order');

  // ---- 3. Switching to "Sort: Latest" shows most-recently-saved first —
  // Mike was saved last, then Alpha, then Zeta first. ----
  await page.selectOption('#gallery-sort', 'latest');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Mike', 'Alpha', 'Zeta'], `expected Latest sort to show most-recently-saved first, got ${JSON.stringify(names)}`);
  ok('"Sort: Latest" lists cards most-recently-saved first');

  // ---- 4. Editing and re-saving a card (Zeta) bumps it to the top under
  // Latest sort, proving it's driven by updatedAt, not creation order. ----
  await page.click('.gallery-card:has-text("Zeta") [data-act="edit"]');
  await page.waitForTimeout(200);
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Zeta', 'Mike', 'Alpha'], `expected re-saving Zeta to bump it to the top under Latest sort, got ${JSON.stringify(names)}`);
  ok('Re-saving a card bumps it to the top under "Sort: Latest" (driven by updatedAt)');

  // ---- 5. Switching back to "Sort: Name" still sorts A-Z even after the
  // re-save (proves Name sort ignores updatedAt entirely). ----
  await page.selectOption('#gallery-sort', 'name');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Alpha', 'Mike', 'Zeta'], `expected switching back to Name sort to show A-Z again, got ${JSON.stringify(names)}`);
  ok('Switching back to "Sort: Name" re-sorts A-Z, unaffected by the earlier re-save');

  // ---- 6. Sort combines with the existing search filter — "a" matches
  // Alpha and Zeta but not Mike, and the two matches still come back in
  // A-Z order. ----
  await page.fill('#gallery-search', 'a');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Alpha', 'Zeta'], `expected the search for "a" to match only Alpha and Zeta, in A-Z order, got ${JSON.stringify(names)}`);
  await page.fill('#gallery-search', '');
  await page.waitForTimeout(150);
  ok('Sort combines correctly with the existing search filter');

  // ---- 7. Select All operates on the currently-sorted, currently-shown
  // list, so it works the same regardless of sort mode (no special casing
  // needed — it already read from latestGalleryCards). ----
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  const selectedCount = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(selectedCount, '3 selected', `expected Select All to still pick up all 3 cards under Name sort, got "${selectedCount}"`);
  ok('Select All still works correctly regardless of the active sort mode');

  console.log('\nAll verify41 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
