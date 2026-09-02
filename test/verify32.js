// verify32.js — Themes (user-defined card collections) + My Cards search:
// 1. The Designer has a free-text "Theme" field (#f-collection) that saves
//    and reloads with the card, and typed Theme names show up in its own
//    autocomplete <datalist> for reuse on later cards.
// 2. My Cards gets a name-search box and a "Filter by Theme" dropdown, both
//    of which narrow the gallery grid (and combine with each other), and a
//    "no match" message appears when a search/filter combination matches
//    nothing (distinct from the "no cards at all" empty state).
// 3. Select All only selects the currently-filtered/searched cards, not
//    every saved card.
// 4. The League Roster's "Add from My Cards" picker offers the same Theme
//    filter and a name search, scoped to that modal.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8873;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Save three cards: two Themed, one Theme-less. ----
  async function saveCardNamed(name, collection) {
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.fill('#f-name', name);
    await page.fill('#f-collection', collection);
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }
  await saveCardNamed('Han Solo', 'Star Wars');
  await saveCardNamed('Chewbacca', 'Star Wars');
  await saveCardNamed('John McClane', 'Die Hard');
  await saveCardNamed('The Raven', ''); // no Theme

  // ---- 2. The Theme typed on a saved card shows up in the Designer's own
  // autocomplete <datalist> for the next card. ----
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  const datalistOptions = await page.$$eval('#collection-options option', els => els.map(e => e.value).sort());
  assert.deepStrictEqual(datalistOptions, ['Die Hard', 'Star Wars'], `expected the Theme autocomplete to offer both Theme names typed so far, got ${JSON.stringify(datalistOptions)}`);
  ok('Designer\'s Theme field autocompletes from Themes typed on previously saved cards');

  // ---- 3. A saved card's Theme round-trips through edit/reload. ----
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Han Solo") [data-act="edit"]');
  await page.waitForTimeout(200);
  const reloadedCollection = await page.inputValue('#f-collection');
  assert.strictEqual(reloadedCollection, 'Star Wars', `expected "Han Solo" to reload with its saved Theme, got "${reloadedCollection}"`);
  ok('A saved card\'s Theme persists and reloads correctly');

  // ---- 4. My Cards: the Theme filter dropdown lists every distinct Theme
  // (plus "All Themes"), and filtering narrows the grid. ----
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  const galleryThemeOptions = await page.$$eval('#gallery-theme-filter option', els => els.map(e => e.value));
  // "__none__" (the "No Theme" option, see verify42.js) always sits right
  // after "All Themes", ahead of the alphabetical Theme names.
  assert.deepStrictEqual(galleryThemeOptions, ['', '__none__', 'Die Hard', 'Star Wars'], `expected My Cards' Theme filter to list [All, No Theme, Die Hard, Star Wars], got ${JSON.stringify(galleryThemeOptions)}`);
  ok('My Cards\' Theme filter dropdown lists every distinct Theme in use');

  async function visibleGalleryNames() {
    return page.$$eval('#gallery-grid .gc-name', els => els.map(e => e.textContent).sort());
  }
  await page.selectOption('#gallery-theme-filter', 'Star Wars');
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await visibleGalleryNames(), ['Chewbacca', 'Han Solo'], 'expected filtering by "Star Wars" to show only the two Star Wars cards');
  ok('Filtering My Cards by Theme shows only cards saved under that Theme');

  // ---- 5. Name search narrows further, and combines with the Theme filter
  // (both must match). ----
  await page.fill('#gallery-search', 'chew');
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await visibleGalleryNames(), ['Chewbacca'], 'expected the name search "chew" combined with the Star Wars Theme filter to leave only Chewbacca');
  ok('Name search combines with the Theme filter (both conditions apply together)');

  // Search alone (Theme filter back to All) finds by partial, case-insensitive name.
  await page.selectOption('#gallery-theme-filter', '');
  await page.fill('#gallery-search', 'RAVEN');
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await visibleGalleryNames(), ['The Raven'], 'expected a case-insensitive partial-name search to find "The Raven"');
  ok('My Cards search finds a card by partial, case-insensitive name match');

  // ---- 6. A search/filter with no matches shows the distinct "no match"
  // message, not the "no cards at all" empty state. ----
  await page.fill('#gallery-search', 'zzz-nonexistent');
  await page.waitForTimeout(150);
  const noMatchVisible = await page.locator('#gallery-no-match').isVisible();
  const emptyVisible = await page.locator('#gallery-empty').isVisible();
  assert.strictEqual(noMatchVisible, true, 'expected the "no cards match" message to show when a search matches nothing');
  assert.strictEqual(emptyVisible, false, 'expected the "no saved cards yet" message to stay hidden when cards exist but none match');
  ok('An unmatched search/filter shows "no cards match", not the "no saved cards yet" empty state');

  // ---- 7. Select All only picks the currently filtered/visible cards. ----
  await page.fill('#gallery-search', '');
  await page.selectOption('#gallery-theme-filter', 'Star Wars');
  await page.waitForTimeout(150);
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  const selectedCountText = await page.locator('#selected-count').textContent();
  assert.strictEqual(selectedCountText.trim(), '2 / 9 selected', `expected Select All to select only the 2 filtered (Star Wars) cards, got "${selectedCountText}"`);
  ok('Select All only selects the cards currently shown by the search/Theme filter, not every saved card');
  // Clean up selection/filter state for what follows.
  await page.click('#select-all-btn'); // deselect
  await page.selectOption('#gallery-theme-filter', '');
  await page.waitForTimeout(150);

  // ---- 8. League Roster's "Add from My Cards" picker offers the same
  // Theme filter and a name search, scoped to that modal. ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);
  const colleagueThemeOptions = await page.$$eval('#colleague-theme-filter option', els => els.map(e => e.value));
  assert.deepStrictEqual(colleagueThemeOptions, ['', 'Die Hard', 'Star Wars'], `expected the colleague picker's Theme filter to list [All, Die Hard, Star Wars], got ${JSON.stringify(colleagueThemeOptions)}`);

  async function visibleColleagueNames() {
    return page.$$eval('#colleague-picker-list .library-item-name', els => els.map(e => e.textContent).sort());
  }
  await page.selectOption('#colleague-theme-filter', 'Die Hard');
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await visibleColleagueNames(), ['John McClane'], 'expected the colleague picker\'s Theme filter to narrow to just the Die Hard card');
  ok('League Roster\'s colleague picker filters by Theme too');

  await page.selectOption('#colleague-theme-filter', '');
  await page.fill('#colleague-search', 'solo');
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await visibleColleagueNames(), ['Han Solo'], 'expected the colleague picker\'s search box to find "Han Solo" by partial name');
  ok('League Roster\'s colleague picker also has a name search, scoped to that modal');

  // Adding a colleague still works normally with a filter/search active.
  await page.locator('#colleague-picker-list .library-add-btn').first().click();
  await page.waitForTimeout(150);
  const memberNames = await page.$$eval('#roster-members .roster-row-name', els => els.map(e => e.textContent));
  assert(memberNames.some(n => n && n.includes('Han Solo')), `expected Han Solo to have been added to the roster's Colleagues list, got ${JSON.stringify(memberNames)}`);
  ok('Adding a colleague from the filtered/searched picker list still works');

  assert.deepStrictEqual(errors, [], `expected no page errors, got ${JSON.stringify(errors)}`);
  console.log('\nAll verify32 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
