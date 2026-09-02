// verify51.js — "Non-Unique": a Card Designer checkbox that flags a saved
// card as a repeatable type (e.g. a generic Rebel Commando or Scout
// Trooper) rather than a single named individual, so the League Roster's
// "Add from My Cards" picker allows more than one copy — the same
// exception Gang cards already get automatically, generalized to any
// Card Type via an explicit opt-in. Like Theme/Affiliation, it's purely a
// roster-building convenience: it has zero effect on the rendered/printed
// card, and the checkbox itself is hidden for Gang (already repeatable
// without it).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8901;
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

  async function saveCard(name, cardType, nonUnique) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.selectOption('#f-cardType', cardType);
    await page.waitForTimeout(100);
    await page.fill('#f-name', name);
    if (nonUnique) await page.check('#f-non-unique');
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }

  // ---- 1. The checkbox is visible for a normal Card Type, hidden for
  // Gang (already repeatable without it), and reappears when switching
  // back off Gang. ----
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  let rowVisible = await page.isVisible('#non-unique-row');
  assert.strictEqual(rowVisible, true, 'expected the Non-Unique row to be visible for the default Card Type (Leader)');
  await page.selectOption('#f-cardType', 'Gang');
  await page.waitForTimeout(100);
  rowVisible = await page.isVisible('#non-unique-row');
  assert.strictEqual(rowVisible, false, 'expected the Non-Unique row to be hidden for Card Type "Gang" (already repeatable without the flag)');
  await page.selectOption('#f-cardType', 'Ally');
  await page.waitForTimeout(100);
  rowVisible = await page.isVisible('#non-unique-row');
  assert.strictEqual(rowVisible, true, 'expected the Non-Unique row to reappear when switching Card Type away from Gang');
  ok('The Non-Unique checkbox is hidden only for Card Type "Gang", visible for every other type');

  // ---- 2. Non-Unique never touches the rendered card: two cards,
  // identical in every field except Non-Unique, render byte-identical
  // PNGs. ----
  await saveCard('Scout Trooper', 'Follower', false);
  const pngUnchecked = await page.evaluate(async () => (await getAllCards()).find(c => c.formData?.name === 'Scout Trooper').pngDataURL);
  await saveCard('Scout Trooper', 'Follower', true);
  const cardsAfter = await page.evaluate(() => getAllCards());
  const scoutCards = cardsAfter.filter(c => c.formData?.name === 'Scout Trooper');
  assert.strictEqual(scoutCards.length, 2, 'expected two saved "Scout Trooper" cards');
  const nonUniqueCard = scoutCards.find(c => c.formData?.nonUnique);
  const uniqueCard = scoutCards.find(c => !c.formData?.nonUnique);
  assert.ok(nonUniqueCard && uniqueCard, 'expected one Scout Trooper card flagged Non-Unique and one not');
  assert.strictEqual(pngUnchecked, nonUniqueCard.pngDataURL, 'expected the Non-Unique flag to have zero effect on the rendered/printed card — identical fields but for the flag render identical PNGs');
  ok('Non-Unique has zero effect on the rendered/printed card');

  // ---- 3. Editing a saved card reloads the checkbox's state correctly,
  // both directions. ----
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  await page.evaluate(async (id) => { loadCardIntoForm(await getCard(id)); }, nonUniqueCard.id);
  await page.waitForTimeout(100);
  let checkedState = await page.isChecked('#f-non-unique');
  assert.strictEqual(checkedState, true, 'expected editing the Non-Unique-flagged card to reload the checkbox as checked');

  await page.evaluate(async (id) => { loadCardIntoForm(await getCard(id)); }, uniqueCard.id);
  await page.waitForTimeout(100);
  checkedState = await page.isChecked('#f-non-unique');
  assert.strictEqual(checkedState, false, 'expected editing the plain (unique) card to reload the checkbox as unchecked');
  ok('Editing a saved card reloads the Non-Unique checkbox to match what was saved, in both directions');

  // ---- 4. A brand new card (New Card) always starts unchecked, even
  // right after editing a Non-Unique-flagged card. ----
  await page.click('.tab-btn[data-tab="designer"]');
  await page.waitForTimeout(100);
  await page.evaluate(async (id) => { loadCardIntoForm(await getCard(id)); }, nonUniqueCard.id);
  await page.waitForTimeout(100);
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  checkedState = await page.isChecked('#f-non-unique');
  assert.strictEqual(checkedState, false, 'expected "New Card" to reset the Non-Unique checkbox back to unchecked');
  ok('"New Card" always starts with Non-Unique unchecked');

  // ---- 5. Save a second, ordinary (unique) Ally so the roster picker has
  // both a repeatable and a one-copy-only card to distinguish. ----
  await saveCard('Han Solo', 'Ally', false);

  // ---- 6. The League Roster "Add from My Cards" picker lets the
  // Non-Unique card be added more than once (like a Gang), while the
  // ordinary Ally drops off the list after one add. ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);

  async function addByName(name) {
    const items = await page.$$('.library-item');
    for (const item of items) {
      const itemName = await item.$eval('.library-item-name', el => el.textContent);
      if (itemName === name) {
        await item.$eval('.library-add-btn', el => el.click());
        return true;
      }
    }
    return false;
  }

  // Add the ordinary Ally once — it should then disappear from the list.
  let added = await addByName('Han Solo');
  assert.strictEqual(added, true, 'expected to find and add "Han Solo" the first time');
  await page.waitForTimeout(150);
  let namesNow = await page.$$eval('.library-item-name', els => els.map(e => e.textContent));
  assert.ok(!namesNow.includes('Han Solo'), `expected the ordinary Ally "Han Solo" to drop off the picker after being added once, got ${JSON.stringify(namesNow)}`);
  ok('An ordinary (non-flagged) Ally is one-copy-only in the roster picker, same as before this feature');

  // Add the Non-Unique Scout Trooper twice — it should stay in the list
  // both times, with a running "already on this roster" count shown.
  added = await addByName('Scout Trooper');
  assert.strictEqual(added, true, 'expected to find and add the Non-Unique "Scout Trooper" the first time');
  await page.waitForTimeout(150);
  namesNow = await page.$$eval('.library-item-name', els => els.map(e => e.textContent));
  assert.ok(namesNow.includes('Scout Trooper'), 'expected the Non-Unique "Scout Trooper" to remain in the picker after being added once');
  const textAfterFirstAdd = await page.$$eval('.library-item', els => els.map(e => e.textContent).join(' | '));
  assert.ok(/1 already on this roster/.test(textAfterFirstAdd), `expected a "1 already on this roster" count after the first add, got "${textAfterFirstAdd}"`);

  added = await addByName('Scout Trooper');
  assert.strictEqual(added, true, 'expected to add a second copy of the Non-Unique "Scout Trooper"');
  await page.waitForTimeout(150);
  const textAfterSecondAdd = await page.$$eval('.library-item', els => els.map(e => e.textContent).join(' | '));
  assert.ok(/2 already on this roster/.test(textAfterSecondAdd), `expected a "2 already on this roster" count after the second add, got "${textAfterSecondAdd}"`);
  ok('A Non-Unique-flagged card can be added to the roster more than once, staying in the picker with a running count, like a Gang');

  // ---- 7. The roster workspace itself now lists three members (Han Solo
  // once, Scout Trooper twice), each costing its own slots. ----
  const rosterMemberNames = await page.evaluate(() => rosterState.members.map(m => m.name));
  assert.deepStrictEqual(rosterMemberNames.sort(), ['Han Solo', 'Scout Trooper', 'Scout Trooper'].sort(), `expected the roster to hold Han Solo once and Scout Trooper twice, got ${JSON.stringify(rosterMemberNames)}`);
  ok('The roster workspace holds two separate Scout Trooper entries, each a real member costing its own slots');

  console.log('\nAll verify51 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
