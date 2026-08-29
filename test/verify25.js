// verify25.js — My Cards gets a "Select All" button next to the selection
// counter, so building a Print Sheet from many saved cards doesn't require
// clicking each one individually. It's a single toggle: press it with
// nothing selected to select up to 9 (the Print Sheet's own cap); press it
// again (anything selected) to clear back to zero.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8864;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- Seed 3 cards directly via the DB layer (fast, and this test is
  // about selection, not card-building) — same saveCard() the app itself
  // uses when you hit "Save to My Cards". ----
  await page.evaluate(async (png) => {
    for (let i = 0; i < 3; i++) {
      await saveCard({
        id: `verify25-card-${i}`,
        formData: { name: `Card ${i}`, cardType: 'Leader' },
        pngDataURL: png,
        createdAt: Date.now() + i,
      });
    }
  }, TINY_PNG);

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);

  // ---- 1. Starting state: nothing selected, button reads "Select All". ----
  let count = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(count, '0 / 9 selected', `expected nothing selected initially, got: ${count}`);
  let label = await page.$eval('#select-all-btn', el => el.textContent);
  assert.strictEqual(label, 'Select All', `expected the button to read "Select All" when nothing is selected, got: ${label}`);
  ok('Starting state: 0/9 selected, button reads "Select All"');

  // ---- 2. Click it: all 3 cards get selected in one click, no need to
  // click each individually. ----
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  count = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(count, '3 / 9 selected', `expected all 3 saved cards to be selected after one click, got: ${count}`);
  const selectedCards = await page.$$eval('.gallery-card.selected', els => els.length);
  assert.strictEqual(selectedCards, 3, 'expected all 3 gallery cards to show as selected');
  ok('Select All selects every saved card in one click');

  // ---- 3. Button now reads "Deselect All". Clicking it clears everything
  // back to zero — the toggle behavior asked for. ----
  label = await page.$eval('#select-all-btn', el => el.textContent);
  assert.strictEqual(label, 'Deselect All', `expected the button to read "Deselect All" once something is selected, got: ${label}`);
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  count = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(count, '0 / 9 selected', `expected pressing the toggle again to clear the selection, got: ${count}`);
  label = await page.$eval('#select-all-btn', el => el.textContent);
  assert.strictEqual(label, 'Select All', 'expected the button to read "Select All" again after clearing');
  const selectedAfterClear = await page.$$eval('.gallery-card.selected', els => els.length);
  assert.strictEqual(selectedAfterClear, 0, 'expected no gallery cards to show as selected after clearing');
  ok('Pressing the button again deselects everything and the label reverts to "Select All"');

  // ---- 4. Manually selecting a couple, then hitting the button, clears
  // rather than "topping up" — a single predictable toggle action. ----
  await page.locator('.gallery-card').first().click();
  await page.waitForTimeout(100);
  count = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(count, '1 / 9 selected', 'expected manually clicking one card to select just that one');
  label = await page.$eval('#select-all-btn', el => el.textContent);
  assert.strictEqual(label, 'Deselect All', 'expected the button to already read "Deselect All" with a partial selection');
  await page.click('#select-all-btn');
  await page.waitForTimeout(100);
  count = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(count, '0 / 9 selected', 'expected the toggle to clear a partial selection back to zero, not top it up to all');
  ok('With a partial selection, the button clears everything rather than topping up');

  // ---- 5. More than 9 saved cards: Select All picks the first 9 (the
  // Print Sheet's own cap) and tells the user, rather than silently
  // dropping cards or breaking. ----
  await page.evaluate(async (png) => {
    for (let i = 3; i < 12; i++) { // 9 more -> 12 total
      await saveCard({
        id: `verify25-card-${i}`,
        formData: { name: `Card ${i}`, cardType: 'Leader' },
        pngDataURL: png,
        createdAt: Date.now() + i,
      });
    }
  }, TINY_PNG);
  await page.click('.tab-btn[data-tab="designer"]');
  await page.click('.tab-btn[data-tab="gallery"]'); // force a refresh with the new cards
  await page.waitForTimeout(200);

  dialogs.length = 0;
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  count = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(count, '9 / 9 selected', `expected Select All to cap at 9 with 12 saved cards, got: ${count}`);
  assert(dialogs.some(m => /first 9/i.test(m)), `expected a heads-up that only the first 9 were selected, got dialogs: ${JSON.stringify(dialogs)}`);
  ok('With more than 9 saved cards, Select All picks the first 9 and tells the user why');

  console.log('\nAll verify25 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
