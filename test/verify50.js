// verify50.js — Affiliation: an optional second, independent grouping field
// alongside Theme (e.g. "Rebel"/"Empire"/"Mercenaries" within a "Star Wars"
// Theme), for filtering/organizing in My Cards and the League Roster's "Add
// from My Cards" picker only — same free-text/autocomplete/Rename pattern
// as Theme, but it never appears on the rendered/printed card itself.
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
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);

  // ---- 4. The Affiliation filter lists "All Affiliations", "No
  // Affiliation", and every distinct Affiliation in use, alphabetically. ----
  const affiliationOptions = await page.$$eval('#gallery-affiliation-filter option', els => els.map(e => e.textContent));
  assert.deepStrictEqual(affiliationOptions, ['All Affiliations', 'No Affiliation', 'Empire', 'Rebel'], `expected the Affiliation filter to list All/No Affiliation plus Empire and Rebel (alphabetical), got ${JSON.stringify(affiliationOptions)}`);
  ok('The Affiliation filter offers "All Affiliations", "No Affiliation", and every Affiliation in use');

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

  console.log('\nAll verify50 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
