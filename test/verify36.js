// verify36.js — "⧉ Duplicate" next to New Card: stages a copy of the
// currently-loaded card (every field, including portrait art) as a new,
// unsaved card with " (copy)" appended to the name, ready to edit and
// save separately — without touching the original card it was copied from.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8877;
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

  // ---- 1. Build and save an original card with art, a Theme, non-default
  // stats, and an ability. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.fill('#f-name', 'Original Hero');
  await page.fill('#f-collection', 'Star Wars');
  const fixture = path.join(__dirname, 'fixture-opaque-square.png');
  await page.setInputFiles('#f-portrait', fixture);
  await page.waitForTimeout(300);
  await page.fill('#f-zoom', '0.6');
  await page.dispatchEvent('#f-zoom', 'input');
  await page.locator('.stat-row[data-stat="brawl"] input[type="number"]').fill('4');
  await page.selectOption('.stat-row[data-stat="brawl"] select', '12');
  await page.click('#add-ability');
  const nameInputs = await page.$$('.ability-item input[data-field="name"]');
  await nameInputs[0].fill('Marksman');
  const textInputs = await page.$$('.ability-item textarea[data-field="text"]');
  await textInputs[0].fill('Re-roll one failed Shoot die per activation.');
  await page.fill('#f-quote', 'Original line.');
  await page.waitForTimeout(150);
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);

  const originalPortraitDataURL = await page.evaluate(() => state.portraitOriginalDataURL);
  assert(originalPortraitDataURL && originalPortraitDataURL.startsWith('data:image'), 'expected the original card to have portrait art loaded before duplicating');

  // ---- 2. Load it back from My Cards (as if returning to make a
  // variation of a saved character, the described real-world use case),
  // then click Duplicate. ----
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Original Hero") [data-act="edit"]');
  await page.waitForTimeout(200);

  await page.click('#btn-duplicate-card');
  await page.waitForTimeout(150);

  const nameAfterDuplicate = await page.inputValue('#f-name');
  assert.strictEqual(nameAfterDuplicate, 'Original Hero (copy)', `expected the name to gain " (copy)", got "${nameAfterDuplicate}"`);
  ok('Duplicate appends " (copy)" to the Character Name');

  const editingIdAfterDuplicate = await page.evaluate(() => state.editingId);
  assert.strictEqual(editingIdAfterDuplicate, null, 'expected Duplicate to clear state.editingId so Save creates a new record instead of overwriting the original');
  ok('Duplicate detaches from the original record (editingId cleared) so Save won\'t overwrite it');

  // Everything else — stats, ability, quote, Theme, portrait art — carried
  // over unchanged.
  const brawlN = await page.locator('.stat-row[data-stat="brawl"] input[type="number"]').inputValue();
  const brawlD = await page.locator('.stat-row[data-stat="brawl"] select').inputValue();
  assert.strictEqual(brawlN, '4', 'expected Brawl\'s number to carry over to the duplicate');
  assert.strictEqual(brawlD, '12', 'expected Brawl\'s die-type to carry over to the duplicate');
  const abilityName = await page.locator('.ability-item input[data-field="name"]').first().inputValue();
  assert.strictEqual(abilityName, 'Marksman', 'expected the ability to carry over to the duplicate');
  const quote = await page.inputValue('#f-quote');
  assert.strictEqual(quote, 'Original line.', 'expected the quote to carry over to the duplicate');
  const collection = await page.inputValue('#f-collection');
  assert.strictEqual(collection, 'Star Wars', 'expected the Theme to carry over to the duplicate');
  const portraitAfterDuplicate = await page.evaluate(() => state.portraitOriginalDataURL);
  assert.strictEqual(portraitAfterDuplicate, originalPortraitDataURL, 'expected the portrait art to carry over to the duplicate unchanged');
  const zoomAfterDuplicate = await page.inputValue('#f-zoom');
  assert.strictEqual(zoomAfterDuplicate, '0.6', 'expected the portrait\'s zoom framing to carry over to the duplicate');
  ok('Stats, Abilities, Quote, Theme, and the portrait art (with its zoom framing) all carry over unchanged');

  // ---- 3. Saving the duplicate creates a second, separate card — the
  // original is untouched. ----
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  const galleryNames = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(galleryNames, ['Original Hero', 'Original Hero (copy)'], `expected both the original and the duplicate to exist as separate cards, got ${JSON.stringify(galleryNames)}`);
  ok('Saving the duplicate creates a second, separate card in My Cards — the original is untouched');

  // Both cards' saved records carry the same portrait art (duplicated, not
  // re-uploaded), and the original's own name/stats weren't mutated.
  const cards = await page.evaluate(() => getAllCards());
  const original = cards.find(c => c.formData.name === 'Original Hero');
  const copy = cards.find(c => c.formData.name === 'Original Hero (copy)');
  assert(original && copy, 'expected to find both saved records');
  assert.strictEqual(copy.portraitDataURL, original.portraitDataURL, 'expected the duplicate\'s saved portrait art to match the original\'s exactly');
  assert.strictEqual(original.formData.stats.brawl.n, 4, 'expected the original\'s own stats to be unaffected by duplicating it');
  ok('Both saved cards carry identical portrait art, and duplicating never mutated the original\'s own saved data');

  // ---- 4. Duplicating a card with no name yields just "(copy)", not a
  // leading space or an error. ----
  await page.click('.tab-btn[data-tab="designer"]');
  await page.waitForTimeout(150);
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  await page.click('#btn-duplicate-card');
  await page.waitForTimeout(150);
  const blankDuplicateName = await page.inputValue('#f-name');
  assert.strictEqual(blankDuplicateName, '(copy)', `expected duplicating an unnamed card to produce "(copy)", got "${blankDuplicateName}"`);
  ok('Duplicating a card with no name yields "(copy)" cleanly, no leading space');

  console.log('\nAll verify36 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
