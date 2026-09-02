// verify50.js — Affiliation: an optional second, independent grouping field
// alongside Theme (e.g. "Rebel"/"Empire"/"Mercenaries" within a "Star Wars"
// Theme), for filtering/organizing in My Cards and the League Roster's "Add
// from My Cards" picker only — same free-text/autocomplete/Rename pattern
// as Theme, but it never appears on the rendered/printed card itself.
// Unlike Theme, Affiliation suggestions/options are scoped to whichever
// Theme is currently in play (the Designer's own Theme field, or each
// filter dropdown's paired Theme filter) — an Affiliation name can be
// reused across unrelated Themes, so a "Star Wars" Theme should never
// suggest/offer "Rebel"/"Empire" while a "Die Hard" Theme is selected.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8900;
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

  async function saveCard(name, theme, affiliation) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.fill('#f-name', name);
    if (theme) await page.fill('#f-collection', theme);
    if (affiliation) await page.fill('#f-affiliation', affiliation);
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }

  // ---- 1. Affiliation never touches the rendered card: two cards, same in
  // every field EXCEPT Affiliation, render byte-identical PNGs. ----
  await saveCard('Twin A', 'Star Wars', 'Rebel');
  const pngA = await page.evaluate(async () => (await getAllCards())[0].pngDataURL);
  await saveCard('Twin A', 'Star Wars', 'Empire');
  const cardsAfterB = await page.evaluate(() => getAllCards());
  const pngB = cardsAfterB.find(c => c.formData?.affiliation === 'Empire').pngDataURL;
  assert.strictEqual(pngA, pngB, 'expected two otherwise-identical cards with different Affiliations to render byte-identical PNGs');
  ok('Affiliation has zero effect on the rendered/printed card — identical fields but for Affiliation render identical PNGs');

  // ---- 2. Editing a saved card loads its Affiliation back into the form. ----
  const gridCards = await page.evaluate(() => getAllCards());
  const twinAId = gridCards.find(c => c.formData?.affiliation === 'Rebel').id;
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  await page.evaluate(async (id) => {
    const card = await getCard(id);
    loadCardIntoForm(card);
  }, twinAId);
  await page.waitForTimeout(100);
  const loadedAffiliation = await page.inputValue('#f-affiliation');
  assert.strictEqual(loadedAffiliation, 'Rebel', `expected the Affiliation field to reload "Rebel" when editing that card, got "${loadedAffiliation}"`);
  ok('Editing a saved card loads its Affiliation back into the Designer form');

  // ---- 3. Seed the rest of the roster: a Die Hard card with no
  // Affiliation, to exercise the optional / "No Affiliation" path. ----
  await saveCard('McClane', 'Die Hard', '');

  // ---- 3b. Saving refreshes the Designer's own Affiliation autocomplete
  // right away — same as Theme — without needing a trip through My Cards
  // first. But unlike Theme, it's scoped to the Designer's current Theme
  // field: right after saving McClane, the Theme field still reads "Die
  // Hard", so the autocomplete should NOT leak "Rebel"/"Empire" in from
  // the unrelated "Star Wars" cards saved in steps 1-2. ----
  let designerAffiliationOptions = await page.$$eval('#affiliation-options option', els => els.map(e => e.value).sort());
  assert.deepStrictEqual(designerAffiliationOptions, [], `expected the Affiliation autocomplete to be empty while Theme reads "Die Hard" (no Die Hard card has an Affiliation yet) — no leakage from Star Wars's "Rebel"/"Empire", got ${JSON.stringify(designerAffiliationOptions)}`);
  ok('The Designer\'s Affiliation autocomplete is scoped to its own Theme field — "Die Hard" shows none of Star Wars\'s Affiliations');

  // ---- 3c. Retyping the Theme field re-scopes the autocomplete live, with
  // no save required: switching to "Star Wars" immediately surfaces
  // "Empire"/"Rebel"; clearing Theme back to blank falls back to every
  // Affiliation in use, since there's no Theme left to scope by. ----
  await page.fill('#f-collection', 'Star Wars');
  await page.waitForTimeout(150);
  designerAffiliationOptions = await page.$$eval('#affiliation-options option', els => els.map(e => e.value).sort());
  assert.deepStrictEqual(designerAffiliationOptions, ['Empire', 'Rebel'], `expected retyping Theme to "Star Wars" to immediately surface its Affiliations, got ${JSON.stringify(designerAffiliationOptions)}`);
  ok('Retyping the Designer\'s Theme field live re-scopes the Affiliation autocomplete — no save needed');

  await page.fill('#f-collection', '');
  await page.waitForTimeout(150);
  designerAffiliationOptions = await page.$$eval('#affiliation-options option', els => els.map(e => e.value).sort());
  assert.deepStrictEqual(designerAffiliationOptions, ['Empire', 'Rebel'], `expected a blank Theme to fall back to every Affiliation in use (nothing to scope by yet), got ${JSON.stringify(designerAffiliationOptions)}`);
  ok('A blank Theme field falls back to every Affiliation in use, since there\'s no Theme yet to scope by');

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);

  // ---- 4. The Affiliation filter lists "All Affiliations", "No
  // Affiliation", and every distinct Affiliation in use, alphabetically. ----
  const affiliationOptions = await page.$$eval('#gallery-affiliation-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(affiliationOptions, ['All Affiliations', 'No Affiliation', 'Empire', 'Rebel'], `expected the Affiliation filter to list All/No Affiliation plus Empire and Rebel (alphabetical) under "All Themes" (no Theme scoping yet), got ${JSON.stringify(affiliationOptions)}`);
  ok('Under "All Themes", the Affiliation filter falls back to every Affiliation in use');

  // ---- 4b. Picking a Theme in the Theme filter scopes the Affiliation
  // filter's own option list the same way it scopes the Designer's
  // autocomplete: "Die Hard" offers nothing but "All Affiliations" (no
  // Affiliation has ever been used on a Die Hard card), while "Star Wars"
  // offers Empire/Rebel. ----
  await page.selectOption('#gallery-theme-filter', 'Die Hard');
  await page.waitForTimeout(150);
  let scopedAffiliationOptions = await page.$$eval('#gallery-affiliation-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(scopedAffiliationOptions, ['All Affiliations', 'No Affiliation'], `expected the Affiliation filter to offer no Affiliation names (just "All"/"No Affiliation") when the Theme filter is "Die Hard", got ${JSON.stringify(scopedAffiliationOptions)}`);

  await page.selectOption('#gallery-theme-filter', 'Star Wars');
  await page.waitForTimeout(150);
  scopedAffiliationOptions = await page.$$eval('#gallery-affiliation-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(scopedAffiliationOptions, ['All Affiliations', 'No Affiliation', 'Empire', 'Rebel'], `expected the Affiliation filter to offer Empire/Rebel when the Theme filter is "Star Wars", got ${JSON.stringify(scopedAffiliationOptions)}`);
  ok('The My Cards Affiliation filter\'s own options are scoped to whichever Theme is picked in the Theme filter');

  await page.selectOption('#gallery-theme-filter', '');
  await page.waitForTimeout(150);

  // ---- 5. Filtering to "Rebel" alone shows just that card; combined with
  // the Theme filter ("Star Wars" + "Empire") narrows to the other twin. ----
  await page.selectOption('#gallery-affiliation-filter', 'Rebel');
  await page.waitForTimeout(150);
  let names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Twin A'], `expected the "Rebel" Affiliation filter to show just that card, got ${JSON.stringify(names)}`);

  await page.selectOption('#gallery-affiliation-filter', 'Empire');
  await page.selectOption('#gallery-theme-filter', 'Star Wars');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Twin A'], `expected Theme "Star Wars" + Affiliation "Empire" to combine to just the Empire twin, got ${JSON.stringify(names)}`);
  ok('The Affiliation filter narrows My Cards on its own, and combines with the Theme filter (AND, not OR)');

  // ---- 6. "No Affiliation" shows the Die Hard card, which was saved with
  // none. ----
  await page.selectOption('#gallery-theme-filter', '');
  await page.selectOption('#gallery-affiliation-filter', '__none__');
  await page.waitForTimeout(150);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['McClane'], `expected "No Affiliation" to show only the card saved with none, got ${JSON.stringify(names)}`);
  ok('"No Affiliation" finds the card that was saved with the field left blank');

  // ---- 7. Rename Affiliation: disabled under "All"/"No Affiliation",
  // enabled on a real pick, and bulk-renames every card carrying it. ----
  await page.selectOption('#gallery-affiliation-filter', '');
  await page.waitForTimeout(100);
  let disabled = await page.$eval('#btn-rename-affiliation', el => el.disabled);
  assert.strictEqual(disabled, true, 'expected "Rename Affiliation" to start disabled under "All Affiliations"');
  await page.selectOption('#gallery-affiliation-filter', '__none__');
  await page.waitForTimeout(100);
  disabled = await page.$eval('#btn-rename-affiliation', el => el.disabled);
  assert.strictEqual(disabled, true, 'expected "Rename Affiliation" to stay disabled under "No Affiliation"');

  await page.selectOption('#gallery-affiliation-filter', 'Rebel');
  await page.waitForTimeout(100);
  disabled = await page.$eval('#btn-rename-affiliation', el => el.disabled);
  assert.strictEqual(disabled, false, 'expected "Rename Affiliation" to enable once a real Affiliation is picked');

  page.once('dialog', async d => { await d.accept('Rebel Alliance'); });
  await page.click('#btn-rename-affiliation');
  await page.waitForTimeout(300);
  const statusText = await page.$eval('#affiliation-rename-status', el => el.textContent);
  assert.ok(statusText.includes('Rebel') && statusText.includes('Rebel Alliance') && statusText.includes('1 card'), `expected a status message summarizing the Affiliation rename, got "${statusText}"`);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(names, ['Twin A'], 'expected the renamed Affiliation filter to still show the same card under its new name');
  ok('Rename Affiliation bulk-renames every card with the picked Affiliation, mirroring Rename Theme');

  // ---- 8. Renaming "Empire" into the now-existing "Rebel Alliance" merges
  // the two, same merge behavior as Rename Theme. ----
  await page.selectOption('#gallery-affiliation-filter', 'Empire');
  await page.waitForTimeout(100);
  page.once('dialog', async d => { await d.accept('Rebel Alliance'); });
  await page.click('#btn-rename-affiliation');
  await page.waitForTimeout(300);
  const mergedStatusText = await page.$eval('#affiliation-rename-status', el => el.textContent);
  assert.ok(/merged/i.test(mergedStatusText), `expected the status message to mention the merge, got "${mergedStatusText}"`);
  await page.selectOption('#gallery-affiliation-filter', 'Rebel Alliance');
  await page.waitForTimeout(100);
  names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Twin A', 'Twin A'], `expected both twins under "Rebel Alliance" after the merge, got ${JSON.stringify(names)}`);
  ok('Renaming an Affiliation into an existing one merges the two, same as Rename Theme');

  // ---- 9. The League Roster "Add from My Cards" picker also gets an
  // Affiliation filter (no "No Affiliation" option there, matching Theme's
  // own asymmetry), and it narrows the picker list. ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);
  const pickerAffiliationOptions = await page.$$eval('#colleague-affiliation-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(pickerAffiliationOptions, ['All Affiliations', 'Rebel Alliance'], `expected the picker's Affiliation filter to list "All Affiliations" + "Rebel Alliance" only (no "No Affiliation"), got ${JSON.stringify(pickerAffiliationOptions)}`);
  await page.selectOption('#colleague-affiliation-filter', 'Rebel Alliance');
  await page.waitForTimeout(150);
  const pickerNames = await page.$$eval('.library-item-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(pickerNames, ['Twin A', 'Twin A'], `expected the picker's Affiliation filter to narrow to just the "Rebel Alliance" cards, got ${JSON.stringify(pickerNames)}`);
  ok('The "Add from My Cards" picker gets its own Affiliation filter, narrowing the list the same way Theme does');

  // ---- 9b. The colleague picker's Affiliation filter is likewise scoped
  // to its own Theme filter — "Die Hard" offers nothing but "All
  // Affiliations" (McClane has none), "Star Wars" offers "Rebel Alliance". ----
  await page.selectOption('#colleague-theme-filter', 'Die Hard');
  await page.waitForTimeout(150);
  let pickerScopedOptions = await page.$$eval('#colleague-affiliation-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(pickerScopedOptions, ['All Affiliations'], `expected the colleague picker's Affiliation filter to offer nothing but "All Affiliations" when its Theme filter is "Die Hard", got ${JSON.stringify(pickerScopedOptions)}`);

  await page.selectOption('#colleague-theme-filter', 'Star Wars');
  await page.waitForTimeout(150);
  pickerScopedOptions = await page.$$eval('#colleague-affiliation-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(pickerScopedOptions, ['All Affiliations', 'Rebel Alliance'], `expected the colleague picker's Affiliation filter to offer "Rebel Alliance" when its Theme filter is "Star Wars", got ${JSON.stringify(pickerScopedOptions)}`);
  ok('The colleague picker\'s Affiliation filter is likewise scoped to its own Theme filter');

  // ---- 10. A fresh page load (a new session against the same IndexedDB —
  // e.g. tomorrow, or a browser restart) populates the Designer's
  // Affiliation autocomplete immediately from whatever's already saved,
  // without requiring a first trip through My Cards or the colleague
  // picker. This is the actual bug report this test guards against: the
  // init-time refresh used to cover Theme only, leaving Affiliation's
  // autocomplete empty until My Cards was opened at least once. ----
  await page.reload();
  await page.waitForTimeout(400);
  const freshLoadAffiliationOptions = await page.$$eval('#affiliation-options option', els => els.map(e => e.value).sort());
  assert.deepStrictEqual(freshLoadAffiliationOptions, ['Rebel Alliance'], `expected a fresh page load to populate the Affiliation autocomplete from already-saved cards immediately, without visiting My Cards first, got ${JSON.stringify(freshLoadAffiliationOptions)}`);
  ok('A fresh page load populates the Affiliation autocomplete right away, same as Theme — no trip through My Cards required');

  console.log('\nAll verify50 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
