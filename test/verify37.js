// verify37.js — My Cards gains a "Card Type" filter dropdown alongside the
// existing Theme filter and name search, so e.g. "Leaders only from the
// Star Wars Theme" can be narrowed down directly instead of scanning the
// whole gallery. Combines with Theme/search using AND, same as Theme+search
// already did.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8878;
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

  // ---- 0. The Card Type filter dropdown exists with the 8 fixed types
  // (mirroring #f-cardType) plus "All Types". ----
  const typeOptions = await page.$$eval('#gallery-type-filter option', els => els.map(e => e.value));
  assert.deepStrictEqual(
    typeOptions,
    ['', 'Leader', 'Sidekick', 'Ally', 'Follower', 'Villain', 'Creature', 'Gang', 'Custom'],
    `expected the Card Type filter to offer All Types + the 8 fixed types, got ${JSON.stringify(typeOptions)}`
  );
  ok('Card Type filter dropdown offers "All Types" plus the 8 fixed card types');

  // ---- 1. Save four cards spanning two Themes and multiple Card Types. ----
  async function saveCard(cardType, name, theme) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.selectOption('#f-cardType', cardType);
    await page.fill('#f-name', name);
    await page.fill('#f-collection', theme);
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }
  await saveCard('Leader', 'Luke', 'Star Wars');
  await saveCard('Sidekick', 'R2-D2', 'Star Wars');
  await saveCard('Leader', 'McClane', 'Die Hard');
  await saveCard('Villain', 'Gruber', 'Die Hard');

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);

  const allNames = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(allNames, ['Gruber', 'Luke', 'McClane', 'R2-D2'], `expected all four saved cards to appear with no filter, got ${JSON.stringify(allNames)}`);
  ok('All four saved cards show up with no filter applied');

  // ---- 2. Filtering by Card Type alone (Leader) shows only Leaders across
  // all Themes. ----
  await page.selectOption('#gallery-type-filter', 'Leader');
  await page.waitForTimeout(150);
  let names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Luke', 'McClane'], `expected only Leaders (any Theme) with Type=Leader, got ${JSON.stringify(names)}`);
  ok('Card Type filter alone narrows to only Leaders, across both Themes');

  // ---- 3. Combining Card Type + Theme (Leader + Star Wars) matches the
  // user's described use case exactly. ----
  await page.selectOption('#gallery-theme-filter', 'Star Wars');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Luke'], `expected only "Leaders from Star Wars" with Type=Leader + Theme=Star Wars, got ${JSON.stringify(names)}`);
  ok('Card Type + Theme combine with AND: only Leader cards from the Star Wars Theme show ("Leaders only from Star Wars")');

  // ---- 4. Adding a name search on top narrows further; a search for a
  // name that doesn't match shows the no-match state, not the empty state
  // (since there ARE saved cards, just none matching the filters). ----
  await page.fill('#gallery-search', 'luke');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Luke'], 'expected search+Type+Theme all combined to still find Luke');
  ok('Search combines with Card Type + Theme too (all three AND together)');

  await page.fill('#gallery-search', 'nonexistent');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, [], 'expected no cards to match an unmatched search combined with the filters');
  const noMatchVisible = await page.$eval('#gallery-no-match', el => getComputedStyle(el).display !== 'none');
  const emptyVisible = await page.$eval('#gallery-empty', el => getComputedStyle(el).display !== 'none');
  assert.strictEqual(noMatchVisible, true, 'expected the "no cards match your search/filter" message when filters exclude everything');
  assert.strictEqual(emptyVisible, false, 'expected the "no saved cards yet" empty-state message to stay hidden since cards do exist, they\'re just filtered out');
  ok('An unmatched combination shows the no-match state, not the "no cards yet" empty state');
  await page.fill('#gallery-search', '');
  await page.waitForTimeout(150);

  // ---- 5. Clearing the Card Type filter back to "All Types" (with Theme
  // still set) restores both Star Wars cards. ----
  await page.selectOption('#gallery-type-filter', '');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Luke', 'R2-D2'], `expected both Star Wars cards back once Card Type is reset to All Types, got ${JSON.stringify(names)}`);
  ok('Resetting Card Type to "All Types" restores all cards matching the remaining Theme filter');

  await page.selectOption('#gallery-theme-filter', '');
  await page.waitForTimeout(150);

  // ---- 6. Select All operates on the currently-filtered set, so it
  // automatically respects the Card Type filter without any extra wiring. ----
  await page.selectOption('#gallery-type-filter', 'Leader');
  await page.waitForTimeout(150);
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  const selectedCount = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(selectedCount, '2 selected', `expected Select All to pick only the 2 filtered Leaders, got "${selectedCount}"`);
  ok('Select All respects the active Card Type filter (only selects the filtered-in cards)');

  console.log('\nAll verify37 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
