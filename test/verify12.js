// verify12.js — League Roster Associates wiring (Core Rules p. 27-28).
// Associates used to be typed directly into the roster (a name field + 2
// ability dropdowns). They're now their own Card Type, built and saved in
// the Card Designer like any other character, and added to a roster via an
// "Add from My Cards" picker — mirroring how Colleagues already work. This
// covers: the picker only offering saved Associate cards, slot cost, the
// p. 27 2-Associate cap warning, the cross-Associate duplicate-ability
// warning, removal, save/reload persistence, and migrating a roster saved
// under the old inline-mechanic shape.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8831;
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

  // ---- Helper: build + save an Associate card with up to 2 abilities ----
  async function saveAssociateCard(name, abilities) {
    await page.click('#btn-new-card');
    await page.selectOption('#f-cardType', 'Associate');
    await page.fill('#f-name', name);
    // Fresh card already has one empty ability row.
    for (let i = 0; i < abilities.length; i++) {
      if (i > 0) await page.click('#add-ability');
    }
    const nameInputs = await page.$$('.ability-item input[data-field="name"]');
    const textInputs = await page.$$('.ability-item textarea[data-field="text"]');
    for (let i = 0; i < abilities.length; i++) {
      await nameInputs[i].fill(abilities[i].name);
      await textInputs[i].fill(abilities[i].text);
    }
    await page.waitForTimeout(150);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }

  const GYB = { name: 'Got Your Back', text: 'You gain +1 Backup point.' };
  const ITK = { name: 'In the Know', text: 'You gain +1 Tips point.' };
  const TINKER = { name: 'Tinker', text: 'You gain +2 Resource points to spend on a mount, vehicle, or Gadgets for this scenario.' };
  const TWIST = { name: 'Twist of Fate', text: 'At the start of any turn, instead of drawing as normal, you may discard and redraw.' };
  const SUPPLIES = { name: 'Supplies', text: 'Before the start of this scenario, you may select a level 1 ability for your Leader.' };

  await saveAssociateCard('The Butler', [GYB, ITK]);
  await saveAssociateCard('The Cabbie', [TINKER, TWIST]);
  await saveAssociateCard('The Doctor', [GYB, SUPPLIES]); // shares "Got Your Back" with The Butler, for the cross-Associate duplicate check
  ok('Saved 3 Associate cards in the Card Designer (The Butler, The Cabbie, The Doctor)');

  // ---- 1. Designer renders Associate cards as landscape, hides Stats/Health/Quote ----
  const canvasSize = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    return { w: c.width, h: c.height };
  });
  assert.strictEqual(canvasSize.w, 1050, `expected an Associate card's canvas to be 1050px wide (landscape), got ${canvasSize.w}`);
  assert.strictEqual(canvasSize.h, 750, `expected an Associate card's canvas to be 750px tall (landscape), got ${canvasSize.h}`);
  ok('Associate cards render on a 1050x750 landscape canvas');

  const statsHidden = await page.isHidden('#stats-fieldset');
  const healthHidden = await page.isHidden('#health-fieldset');
  const flavorHidden = await page.isHidden('#flavor-fieldset');
  const levelHidden = await page.isHidden('#level-field-wrap');
  assert(statsHidden && healthHidden && flavorHidden && levelHidden, 'expected Stats/Health/Flavor/Level to be hidden for an Associate card');
  ok('Stats, Health, Flavor (Quote), and Level are hidden in the Designer for Associate cards');

  // ---- 2. Gallery: Associate is filterable and appears alongside other types ----
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  await page.selectOption('#gallery-type-filter', 'Associate');
  await page.waitForTimeout(200);
  let galleryNames = await page.$$eval('.gallery-card .gc-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(galleryNames.sort(), ['The Butler', 'The Cabbie', 'The Doctor'], `expected My Cards filtered to Associate to show exactly the 3 saved Associate cards, got ${JSON.stringify(galleryNames)}`);
  ok('My Cards filters to Associate cards correctly');
  await page.selectOption('#gallery-type-filter', '');

  // ---- 3. League Roster: empty state, then the Colleague picker excludes Associate cards ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  let emptyVisible = await page.isVisible('#roster-associates-empty');
  assert.strictEqual(emptyVisible, true, 'expected empty-state hint before any Associate is added');
  ok('Associates column shows empty state initially');

  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);
  const colleagueNames = await page.$$eval('#colleague-picker-list .library-item-name', els => els.map(e => e.textContent));
  assert(!colleagueNames.includes('The Butler'), `expected the Colleague picker to exclude Associate cards, got ${JSON.stringify(colleagueNames)}`);
  ok('The Colleague ("+ Add from My Cards") picker excludes Associate cards');
  await page.click('#close-colleague-picker');

  // ---- 4. Associate picker: add The Butler, check slot cost + ability text ----
  await page.click('#open-associate-picker');
  await page.waitForTimeout(200);
  let pickerNames = await page.$$eval('#associate-picker-list .library-item-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(pickerNames.sort(), ['The Butler', 'The Cabbie', 'The Doctor'], `expected the Associate picker to list exactly the 3 saved Associate cards, got ${JSON.stringify(pickerNames)}`);
  await page.click('#associate-picker-list .library-item:has-text("The Butler") .library-add-btn');
  await page.waitForTimeout(150);
  await page.click('#close-associate-picker');
  await page.waitForTimeout(150);

  let slotLabel = await page.textContent('#slot-meter-label');
  assert(slotLabel.includes('1 / 10'), `expected 1 slot used for 1 Associate, got: ${slotLabel}`);
  ok('Adding 1 Associate (from My Cards) costs 1 roster slot');

  let abilityTexts = await page.$$eval('.associate-ability-text', els => els.map(e => e.textContent));
  assert(abilityTexts.some(t => t.includes('Backup point')), `expected Got Your Back's text to show, got: ${JSON.stringify(abilityTexts)}`);
  assert(abilityTexts.some(t => t.includes('Tips point')), `expected In the Know's text to show, got: ${JSON.stringify(abilityTexts)}`);
  ok('The added Associate shows its abilities (snapshotted from its saved card) with rules text underneath');

  // ---- 5. Add The Cabbie (distinct abilities) -> still no warnings ----
  await page.click('#open-associate-picker');
  await page.waitForTimeout(150);
  await page.click('#associate-picker-list .library-item:has-text("The Cabbie") .library-add-btn');
  await page.waitForTimeout(150);
  await page.click('#close-associate-picker');
  await page.waitForTimeout(150);
  let warnings = await page.textContent('#associate-warnings');
  assert.strictEqual(warnings.trim(), '', `expected no warnings with 2 Associates and no overlapping abilities, got: ${warnings}`);
  slotLabel = await page.textContent('#slot-meter-label');
  assert(slotLabel.includes('2 / 10'), `expected 2 slots used for 2 Associates, got: ${slotLabel}`);
  ok('2 Associates with distinct abilities cost 2 slots and trigger no warnings');

  // ---- 6. Add The Doctor -> cap warning (3 Associates) + cross-Associate duplicate ("Got Your Back") ----
  await page.click('#open-associate-picker');
  await page.waitForTimeout(150);
  await page.click('#associate-picker-list .library-item:has-text("The Doctor") .library-add-btn');
  await page.waitForTimeout(150);
  await page.click('#close-associate-picker');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#associate-warnings');
  assert(warnings.includes('at most 2 Associates'), `expected cap warning at 3 associates, got: ${warnings}`);
  assert(warnings.includes("can't take the same Associate Ability more than once"), `expected cross-associate duplicate warning for "Got Your Back", got: ${warnings}`);
  ok('A 3rd Associate triggers the "at most 2" cap warning, and reusing "Got Your Back" triggers the duplicate-ability warning');

  // ---- 7. Remove The Doctor -> back to a clean 2-associate roster ----
  const removeButtons = await page.$$('.associate-remove');
  await removeButtons[2].click();
  await page.waitForTimeout(150);
  let items = await page.$$('.associate-item');
  assert.strictEqual(items.length, 2, 'expected back to 2 associate items after removing the 3rd');
  warnings = await page.textContent('#associate-warnings');
  assert.strictEqual(warnings.trim(), '', `expected no warnings on a clean 2-associate roster, got: ${warnings}`);
  ok('Removing an Associate works, clears the cap/duplicate warnings, and updates the count');

  // ---- 8. Non-repeatable: The Butler no longer offered once added ----
  await page.click('#open-associate-picker');
  await page.waitForTimeout(150);
  pickerNames = await page.$$eval('#associate-picker-list .library-item-name', els => els.map(e => e.textContent));
  assert(!pickerNames.includes('The Butler'), `expected The Butler to drop out of the picker once added (not Non-Unique), got ${JSON.stringify(pickerNames)}`);
  assert(!pickerNames.includes('The Cabbie'), `expected The Cabbie to drop out of the picker once added, got ${JSON.stringify(pickerNames)}`);
  assert(pickerNames.includes('The Doctor'), `expected The Doctor (removed in step 7) to be offered again, got ${JSON.stringify(pickerNames)}`);
  await page.click('#close-associate-picker');
  ok('Once-added Associate cards drop out of the picker; a removed one becomes available again');

  // ---- 9. Save + reload persistence ----
  await page.fill('#roster-name', 'The Fixers Guild');
  await page.click('#roster-save');
  await page.waitForTimeout(300);

  await page.reload();
  await page.waitForTimeout(400);
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.selectOption('#roster-picker', { label: 'The Fixers Guild' });
  await page.waitForTimeout(300);

  items = await page.$$('.associate-item');
  assert.strictEqual(items.length, 2, `expected 2 associates to persist after reload, got ${items.length}`);
  const persistedNames = await page.$$eval('.associate-item .roster-row-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(persistedNames.sort(), ['The Butler', 'The Cabbie'], `expected persisted associate names, got: ${JSON.stringify(persistedNames)}`);
  slotLabel = await page.textContent('#slot-meter-label');
  assert(slotLabel.includes('2 / 10'), `expected 2 slots used after reload, got: ${slotLabel}`);
  ok('Associates persist correctly through save + reload');

  // ---- 10. Legacy migration: a roster saved under the old inline-mechanic
  // shape ({name, abilities: [name1, name2]}, string ability names looked
  // up live) still loads and displays correctly. ----
  await page.evaluate(async () => {
    await saveRoster({
      id: 'legacy-roster-test',
      name: 'Old Format League',
      members: [],
      perks: [],
      associates: [
        { name: 'Legacy Butler', abilities: ['Got Your Back', 'In the Know'] },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  await page.reload();
  await page.waitForTimeout(400);
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.selectOption('#roster-picker', { label: 'Old Format League' });
  await page.waitForTimeout(300);

  items = await page.$$('.associate-item');
  assert.strictEqual(items.length, 1, `expected the legacy Associate entry to load, got ${items.length} items`);
  const legacyName = await page.textContent('.associate-item .roster-row-name');
  assert.strictEqual(legacyName.trim(), 'Legacy Butler', `expected the legacy Associate's name to display, got "${legacyName}"`);
  const legacyAbilityTexts = await page.$$eval('.associate-ability-text', els => els.map(e => e.textContent));
  assert(legacyAbilityTexts.some(t => t.includes('Backup point')), `expected the legacy entry's "Got Your Back" text to be looked up and shown, got: ${JSON.stringify(legacyAbilityTexts)}`);
  slotLabel = await page.textContent('#slot-meter-label');
  assert(slotLabel.includes('1 / 10'), `expected the migrated legacy roster to still cost 1 slot, got: ${slotLabel}`);
  ok('A roster saved under the old inline-mechanic shape migrates cleanly on load (name + looked-up ability text, correct slot cost)');

  // Re-saving should persist the migrated (new) shape without erroring —
  // the pageerror listener at the top of this test fails the run if it does.
  await page.click('#roster-save');
  await page.waitForTimeout(200);
  ok('Re-saving a migrated legacy roster does not error');

  console.log('\nAll verify12 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
