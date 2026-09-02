// verify42.js — My Cards' Theme filter gains a "No Theme" option so cards
// that were never assigned a Theme (an empty formData.collection) can be
// found. Sits right after "All Themes" in the dropdown, ahead of the
// alphabetical Theme names. Only the My Cards gallery filter gets it — the
// League Roster "Add from My Cards" picker and the Print Sheet's backup/
// restore Theme filter are unaffected.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8892;
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

  // ---- 1. Save 3 cards: two with no Theme, one with a Theme set. ----
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
  await saveCard('Orphan One', null);
  await saveCard('Themed Hero', 'Wild West');
  await saveCard('Orphan Two', null);

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);

  // ---- 2. The "No Theme" option exists in the gallery's Theme filter,
  // positioned right after "All Themes". ----
  const optionInfo = await page.$$eval('#gallery-theme-filter option', els =>
    els.map(e => ({ value: e.value, text: e.textContent })));
  assert.strictEqual(optionInfo[0].value, '', `expected the first option to be "All Themes", got ${JSON.stringify(optionInfo[0])}`);
  assert.strictEqual(optionInfo[1].value, '__none__', `expected the second option to be "No Theme", got ${JSON.stringify(optionInfo[1])}`);
  assert.strictEqual(optionInfo[1].text, 'No Theme', `expected the "No Theme" option's label to read "No Theme", got "${optionInfo[1].text}"`);
  ok('The gallery Theme filter offers a "No Theme" option right after "All Themes"');

  // ---- 3. Selecting "No Theme" shows only the two cards with a blank
  // Theme, not the one with "Wild West" set. ----
  await page.selectOption('#gallery-theme-filter', '__none__');
  await page.waitForTimeout(150);
  let names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Orphan One', 'Orphan Two'], `expected "No Theme" to show only the two themeless cards, got ${JSON.stringify(names)}`);
  ok('Selecting "No Theme" shows only cards with no Theme assigned');

  // ---- 4. It combines with search — searching "Two" under "No Theme"
  // narrows to just "Orphan Two". ----
  await page.fill('#gallery-search', 'Two');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Orphan Two'], `expected "No Theme" + search "Two" to show only Orphan Two, got ${JSON.stringify(names)}`);
  await page.fill('#gallery-search', '');
  await page.waitForTimeout(150);
  ok('"No Theme" combines correctly with the search box');

  // ---- 5. Switching back to a named Theme ("Wild West") shows only the
  // themed card, and back to "All Themes" shows all 3. ----
  await page.selectOption('#gallery-theme-filter', 'Wild West');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Themed Hero'], `expected "Wild West" filter to show only Themed Hero, got ${JSON.stringify(names)}`);

  await page.selectOption('#gallery-theme-filter', '');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Orphan One', 'Orphan Two', 'Themed Hero'], `expected "All Themes" to show all 3 cards, got ${JSON.stringify(names)}`);
  ok('Switching between "No Theme", a named Theme, and "All Themes" all filter correctly');

  // ---- 6. The League Roster "Add from My Cards" picker's Theme filter
  // does NOT get a "No Theme" option — only the gallery does. ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);
  const pickerOptionValues = await page.$$eval('#colleague-theme-filter option', els => els.map(e => e.value));
  assert.ok(!pickerOptionValues.includes('__none__'), `expected the roster picker's Theme filter to NOT include "No Theme", got ${JSON.stringify(pickerOptionValues)}`);
  ok('The "Add from My Cards" picker\'s Theme filter is unaffected — no "No Theme" option there');

  console.log('\nAll verify42 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
