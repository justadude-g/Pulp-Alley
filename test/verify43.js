// verify43.js — My Cards gains a "Rename Theme" button next to the Theme
// filter: pick a Theme in the filter, click Rename, and every card
// currently in that Theme gets bulk-updated to the new name — no more
// having to open and re-save each card individually. The button is
// disabled until a real Theme (not "All Themes" or "No Theme") is picked.
// Renaming to an existing different Theme's name merges the two.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8893;
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

  async function saveCard(name, theme) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.fill('#f-name', name);
    if (theme) await page.fill('#f-collection', theme);
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }
  await saveCard('Han Solo', 'Star Wras'); // deliberate typo to fix via rename
  await saveCard('Chewbacca', 'Star Wras');
  await saveCard('John McClane', 'Die Hard');

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);

  // ---- 1. The Rename Theme button starts disabled (filter is "All
  // Themes"). ----
  let disabled = await page.$eval('#btn-rename-theme', el => el.disabled);
  assert.strictEqual(disabled, true, 'expected "Rename Theme" to start disabled under "All Themes"');
  ok('"Rename Theme" is disabled while the filter is "All Themes"');

  // ---- 2. Selecting "No Theme" also keeps it disabled. ----
  await page.selectOption('#gallery-theme-filter', '__none__');
  await page.waitForTimeout(100);
  disabled = await page.$eval('#btn-rename-theme', el => el.disabled);
  assert.strictEqual(disabled, true, 'expected "Rename Theme" to stay disabled under "No Theme"');
  ok('"Rename Theme" stays disabled under "No Theme" too');

  // ---- 3. Picking an actual Theme enables the button. ----
  await page.selectOption('#gallery-theme-filter', 'Star Wras');
  await page.waitForTimeout(100);
  disabled = await page.$eval('#btn-rename-theme', el => el.disabled);
  assert.strictEqual(disabled, false, 'expected "Rename Theme" to be enabled once a real Theme is selected');
  ok('"Rename Theme" enables once a real Theme is picked in the filter');

  // ---- 4. Clicking it, typing a corrected name, renames every card in
  // that Theme — and only that Theme (Die Hard's card is untouched). ----
  page.once('dialog', async d => { await d.accept('Star Wars'); });
  await page.click('#btn-rename-theme');
  await page.waitForTimeout(300);

  const themeOptionsAfter = await page.$$eval('#gallery-theme-filter option', els => els.map(e => e.value));
  assert.ok(themeOptionsAfter.includes('Star Wars'), `expected "Star Wars" to appear in the Theme filter after renaming, got ${JSON.stringify(themeOptionsAfter)}`);
  assert.ok(!themeOptionsAfter.includes('Star Wras'), `expected the old "Star Wras" Theme to be gone after renaming, got ${JSON.stringify(themeOptionsAfter)}`);
  ok('Renaming updates the Theme filter dropdown itself');

  const currentFilterValue = await page.inputValue('#gallery-theme-filter');
  assert.strictEqual(currentFilterValue, 'Star Wars', 'expected the filter to stay on the renamed Theme, now showing its new name');
  const namesAfterRename = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(namesAfterRename, ['Chewbacca', 'Han Solo'], `expected both renamed cards to show under "Star Wars", got ${JSON.stringify(namesAfterRename)}`);
  ok('Both cards in the renamed Theme show up under the new name, filter stays applied');

  const statusText = await page.$eval('#theme-rename-status', el => el.textContent);
  assert.ok(statusText.includes('Star Wras') && statusText.includes('Star Wars') && statusText.includes('2 cards'), `expected a status message summarizing the rename, got "${statusText}"`);
  ok('A status message confirms what was renamed and how many cards were affected');

  // ---- 5. The Die Hard card was untouched by the Star Wars rename. ----
  await page.selectOption('#gallery-theme-filter', 'Die Hard');
  await page.waitForTimeout(100);
  const dieHardNames = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(dieHardNames, ['John McClane'], `expected Die Hard's card to be untouched, got ${JSON.stringify(dieHardNames)}`);
  ok('A Theme rename only touches cards in that Theme — others are untouched');

  // ---- 6. Renaming "Die Hard" into the existing "Star Wars" Theme merges
  // the two, and says so in the status message. ----
  page.once('dialog', async d => { await d.accept('Star Wars'); });
  await page.click('#btn-rename-theme');
  await page.waitForTimeout(300);
  const mergedStatusText = await page.$eval('#theme-rename-status', el => el.textContent);
  assert.ok(/merged/i.test(mergedStatusText), `expected the status message to mention the merge, got "${mergedStatusText}"`);
  await page.selectOption('#gallery-theme-filter', 'Star Wars');
  await page.waitForTimeout(100);
  const mergedNames = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(mergedNames, ['Chewbacca', 'Han Solo', 'John McClane'], `expected all 3 cards under "Star Wars" after the merge, got ${JSON.stringify(mergedNames)}`);
  ok('Renaming into an existing Theme merges the two and reports it as a merge');

  // ---- 7. Cancelling the prompt (dismiss) leaves everything unchanged. ----
  const beforeCancelOptions = await page.$$eval('#gallery-theme-filter option', els => els.map(e => e.value));
  page.once('dialog', async d => { await d.dismiss(); });
  await page.click('#btn-rename-theme');
  await page.waitForTimeout(200);
  const afterCancelOptions = await page.$$eval('#gallery-theme-filter option', els => els.map(e => e.value));
  assert.deepStrictEqual(afterCancelOptions, beforeCancelOptions, 'expected cancelling the rename prompt to leave the Theme list unchanged');
  ok('Cancelling the rename prompt makes no changes');

  console.log('\nAll verify43 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
