// verify55.js — new Resource "Asset" Card Types: Contacts, Gear (Gadgets
// folded in), Backup, Minions, Cult, and Gifts (Resources & Assets
// chapter, Core Rules p. 93-100). These are one-scenario consumables, not
// characters — no Level/Stats/Health/Abilities, just a Cost + Description
// on a simplified card layout, picked from a per-type Asset Library. Tips
// isn't a Card Type here (no per-item table in the rulebook), and none of
// the six are added to a League Roster.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8879;
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

  // ---- 0. All 6 Resource Card Types are selectable, Tips is not. ----
  const typeOptions = await page.$$eval('#f-cardType option', els => els.map(e => e.textContent));
  for (const t of ['Contacts', 'Gear', 'Backup', 'Minions', 'Cult', 'Gifts']) {
    assert(typeOptions.includes(t), `expected Card Type dropdown to include "${t}", got ${JSON.stringify(typeOptions)}`);
  }
  assert(!typeOptions.includes('Tips'), 'expected "Tips" NOT to be a selectable Card Type (no per-item table in the rulebook)');
  ok('Contacts/Gear/Backup/Minions/Cult/Gifts are all selectable Card Types; Tips is not');

  // ---- 1. Selecting an Asset Card Type hides Stats/Health/Abilities/
  // Flavor/Level and shows the Asset Details fieldset instead. ----
  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(150);
  assert.strictEqual(await page.locator('#asset-fieldset').isVisible(), true, 'expected Asset Details fieldset to show for Gear');
  assert.strictEqual(await page.locator('#stats-fieldset').isVisible(), false, 'expected Stats to be hidden for Gear');
  assert.strictEqual(await page.locator('#health-fieldset').isVisible(), false, 'expected Health to be hidden for Gear');
  assert.strictEqual(await page.locator('#abilities-fieldset').isVisible(), false, 'expected Abilities to be hidden for Gear');
  assert.strictEqual(await page.locator('#flavor-fieldset').isVisible(), false, 'expected Flavor/Quote to be hidden for Gear');
  assert.strictEqual(await page.locator('#level-field-wrap').isVisible(), false, 'expected the Level field to be hidden for Gear');
  ok('Selecting an Asset Card Type (Gear) hides Stats/Health/Abilities/Flavor/Level and shows Asset Details');

  // Switching back to a character type restores everything.
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  assert.strictEqual(await page.locator('#asset-fieldset').isVisible(), false, 'expected Asset Details to hide again for Leader');
  assert.strictEqual(await page.locator('#stats-fieldset').isVisible(), true, 'expected Stats to show again for Leader');
  assert.strictEqual(await page.locator('#abilities-fieldset').isVisible(), true, 'expected Abilities to show again for Leader');
  ok('Switching back to a character Card Type (Leader) restores Stats/Health/Abilities/Flavor/Level');

  // ---- 2. Asset Library: each type's library lists only that type's own
  // items, and picking one fills Name/Cost/Description. ----
  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(150);
  await page.click('#open-asset-library');
  await page.waitForTimeout(150);
  const gearNames = await page.locator('#asset-library-list .library-item-name').allTextContents();
  assert.strictEqual(gearNames.length, 34, `expected Gear's library to list 34 items (21 original + 4 from Additional Perks & Abilities.pdf + 9 from New Gadgets.pdf), got ${gearNames.length}`);
  assert(gearNames.includes('Boom-Bot'), 'expected the Gadgets sub-table (Boom-Bot, etc.) to be folded into the Gear library');
  assert(gearNames.includes('Pif Gadget'), 'expected the newly-added Pif Gadget to be in the Gear library');
  assert(gearNames.includes('Turbo Encabulator'), 'expected the newly-added Turbo Encabulator to be in the Gear library');
  assert(!gearNames.includes('Rocket Pack'), 'expected "Rocket Pack" to be excluded as a duplicate of the existing "Flight Pack"');
  ok('Gear\'s Asset Library lists 34 items — the original 21 plus the 13 newly-added Gear/Gadget items');

  // ---- 2b. Spot-check the newly-added items render correctly: Pif Gadget
  // (Gadget-family, but deliberately WITHOUT the Mishap note, since its own
  // rules text says it doesn't check for its own failure). ----
  await page.locator('#asset-library-list .library-item', { hasText: 'Pif Gadget' }).locator('.library-add-btn').click();
  await page.waitForTimeout(150);
  const pifDesc = await page.inputValue('#f-assetDescription');
  assert(pifDesc.startsWith('Gadget.'), 'expected Pif Gadget\'s description to be flagged as a Gadget');
  assert(!/Mishap/.test(pifDesc), 'expected Pif Gadget to NOT include the standard Mishap note (it does not check for its own failure)');
  ok('Pif Gadget is Gadget-flagged but deliberately omits the Mishap note');

  await page.click('#open-asset-library');
  await page.waitForTimeout(150);
  await page.locator('#asset-library-list .library-item', { hasText: 'Turbo Encabulator' }).locator('.library-add-btn').click();
  await page.waitForTimeout(150);
  const turboDesc = await page.inputValue('#f-assetDescription');
  const turboCost = await page.inputValue('#f-assetCost');
  assert.strictEqual(turboCost, '3', 'expected Turbo Encabulator\'s Cost to be 3');
  assert(!turboDesc.startsWith('Gadget.'), 'expected Turbo Encabulator to be plain Gear, not Gadget-flagged');
  ok('Turbo Encabulator is plain Gear (not Gadget-flagged) with Cost 3');

  await page.click('#open-asset-library');
  await page.waitForTimeout(150);

  await page.locator('#asset-library-list .library-item', { hasText: 'Boom-Bot' }).locator('.library-add-btn').click();
  await page.waitForTimeout(150);
  const pickedName = await page.inputValue('#f-name');
  const pickedCost = await page.inputValue('#f-assetCost');
  const pickedDesc = await page.inputValue('#f-assetDescription');
  assert.strictEqual(pickedName, 'Boom-Bot', 'expected picking Boom-Bot to fill Character Name');
  assert.strictEqual(pickedCost, '1', 'expected picking Boom-Bot to fill Cost with 1');
  assert(pickedDesc.startsWith('Gadget.'), `expected Boom-Bot's description to be flagged as a Gadget, got "${pickedDesc.slice(0, 40)}..."`);
  assert(/Mishap/.test(pickedDesc), 'expected a Gadget\'s description to include the Mishap rule explanation');
  assert(await page.locator('#asset-library-modal').isHidden(), 'expected picking an asset to close the library modal');
  ok('Picking "Boom-Bot" from the Gear library fills Name/Cost/Description (Gadget-flagged, with the Mishap rule) and closes the modal');

  // Different Card Type -> different library contents (Contacts has 11).
  await page.selectOption('#f-cardType', 'Contacts');
  await page.waitForTimeout(150);
  await page.click('#open-asset-library');
  await page.waitForTimeout(150);
  const contactsNames = await page.locator('#asset-library-list .library-item-name').allTextContents();
  assert.strictEqual(contactsNames.length, 11, `expected Contacts' library to list 11 items, got ${contactsNames.length}`);
  assert(!contactsNames.includes('Boom-Bot'), 'expected Contacts\' library to NOT include Gear-only items like Boom-Bot');
  await page.click('#close-asset-library');
  ok('Switching Card Type to Contacts shows Contacts\' own 11-item library, not Gear\'s');

  // ---- 3. Cost/Description round-trip through Save -> My Cards -> reload,
  // and the rendered card actually shows the picked Cost/Name/Description
  // (via the Type tag pill, matching the existing convention of always
  // showing the Card Type in a top-right pill). ----
  await page.selectOption('#f-cardType', 'Backup');
  await page.waitForTimeout(150);
  await page.fill('#f-name', 'Level 1: Brawler');
  await page.fill('#f-assetCost', '1');
  await page.fill('#f-assetDescription', 'Health: d6*. Skills: Brawl 2d6.');
  await page.waitForTimeout(150);
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Level 1: Brawler") [data-act="edit"]');
  await page.waitForTimeout(200);
  const reloadedCardType = await page.inputValue('#f-cardType');
  const reloadedCost = await page.inputValue('#f-assetCost');
  const reloadedDesc = await page.inputValue('#f-assetDescription');
  assert.strictEqual(reloadedCardType, 'Backup', 'expected the saved Card Type (Backup) to round-trip');
  assert.strictEqual(reloadedCost, '1', 'expected the saved Cost to round-trip');
  assert.strictEqual(reloadedDesc, 'Health: d6*. Skills: Brawl 2d6.', 'expected the saved Description to round-trip');
  assert.strictEqual(await page.locator('#asset-fieldset').isVisible(), true, 'expected reloading a Backup card to show Asset Details again, not Stats/Health');
  ok('Cost/Description round-trip correctly through Save -> My Cards -> reload, and field visibility is restored on reload too');

  // ---- 4. Asset cards are never offered as Colleague picks on a League
  // Roster (they're one-scenario resources, not persistent crew). ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(150);
  const colleagueNames = await page.locator('#colleague-picker-list .library-item-name').allTextContents();
  assert(!colleagueNames.includes('Level 1: Brawler'), 'expected the saved Backup asset card to NOT appear in the Colleague picker');
  await page.click('#close-colleague-picker');
  ok('Asset cards (Contacts/Gear/Backup/Minions/Cult/Gifts) are excluded from the League Roster\'s Colleague picker');

  console.log('\nAll verify55 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
