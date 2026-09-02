// verify40.js — League Roster's "Add from My Cards" picker previously
// removed a card from the list the instant it was added, so every Card
// Type was effectively limited to one copy per roster. That's correct for
// unique named characters (Leader, Sidekick, Ally, Follower, Villain,
// Creature) but wrong for Gangs (p. 21): a Gang represents a generic group
// of similar mooks, not a unique character, so a league should be able to
// field more than one copy of the same saved Gang card. Gangs now stay in
// the picker after being added (with a running count), while every other
// Card Type still drops out after one add — unchanged from before.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8890;
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

  // ---- 1. Save a Gang card and a Leader card. ----
  async function saveCard(cardType, name) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.selectOption('#f-cardType', cardType);
    await page.fill('#f-name', name);
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }
  await saveCard('Gang', 'Rebel Commandos');
  await saveCard('Leader', 'Solo');

  // ---- 2. Open the roster tab and the colleague picker. ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);

  const namesInitial = await page.$$eval('#colleague-picker-list .library-item-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(namesInitial.sort(), ['Rebel Commandos', 'Solo'], `expected both cards in the picker initially, got ${JSON.stringify(namesInitial)}`);
  ok('Both the Gang and the Leader appear in the "Add from My Cards" picker initially');

  // ---- 3. Add the Gang once — it should stay in the picker afterward,
  // now showing a running count, unlike a normal card. ----
  async function clickAddByName(name) {
    const item = page.locator('.library-item', { hasText: name });
    await item.locator('.library-add-btn').click();
    await page.waitForTimeout(150);
  }
  await clickAddByName('Rebel Commandos');

  const namesAfterFirstGangAdd = await page.$$eval('#colleague-picker-list .library-item-name', els => els.map(e => e.textContent));
  assert.ok(namesAfterFirstGangAdd.includes('Rebel Commandos'), 'expected the Gang to remain in the picker after being added once, so a second copy can be added');
  ok('After adding the Gang once, it stays available in the picker (unlike a normal card)');

  const countTextAfterOne = await page.locator('.library-item', { hasText: 'Rebel Commandos' }).locator('.library-item-text').textContent();
  assert.ok(countTextAfterOne.includes('1 already on this roster'), `expected a "1 already on this roster" note on the Gang's picker entry, got "${countTextAfterOne}"`);
  ok('The picker shows how many copies of the Gang are already on the roster');

  // ---- 4. Add the Gang a second time. ----
  await clickAddByName('Rebel Commandos');
  const countTextAfterTwo = await page.locator('.library-item', { hasText: 'Rebel Commandos' }).locator('.library-item-text').textContent();
  assert.ok(countTextAfterTwo.includes('2 already on this roster'), `expected the count to update to 2, got "${countTextAfterTwo}"`);
  ok('Adding the Gang a second time updates the count to 2 — the picker never excluded it');

  // ---- 5. Add the Leader once — it should disappear from the picker,
  // exactly like before this change (unique named characters stay
  // one-copy-only). ----
  await clickAddByName('Solo');
  const namesAfterLeaderAdd = await page.$$eval('#colleague-picker-list .library-item-name', els => els.map(e => e.textContent));
  assert.ok(!namesAfterLeaderAdd.includes('Solo'), 'expected the Leader to disappear from the picker after being added once, same as before this change');
  assert.ok(namesAfterLeaderAdd.includes('Rebel Commandos'), 'expected the Gang to still be offered after adding the Leader');
  ok('The Leader still drops out of the picker after one add — only Gangs are exempt from the one-copy rule');

  // ---- 6. Close the picker and confirm the roster workspace lists all 3
  // members (2 Gang copies + 1 Leader) as separate rows with correct slot
  // costs, and the slot meter counts them all. ----
  await page.click('#close-colleague-picker');
  await page.waitForTimeout(150);
  const rows = await page.$$eval('.roster-row', els => els.map(el => ({
    name: el.querySelector('.roster-row-name').textContent,
    type: el.querySelector('.roster-row-meta').textContent,
    slots: el.querySelector('.roster-row-slots').textContent,
  })));
  assert.strictEqual(rows.length, 3, `expected 3 separate roster rows (2 Gang + 1 Leader), got ${rows.length}`);
  const gangRows = rows.filter(r => r.name === 'Rebel Commandos' && r.type === 'Gang');
  assert.strictEqual(gangRows.length, 2, `expected 2 separate "Rebel Commandos" rows on the roster, got ${gangRows.length}`);
  assert.ok(gangRows.every(r => r.slots === '2 slots'), 'expected each Gang copy to cost its own 2 roster slots');
  ok('The roster workspace lists both Gang copies as separate rows, each costing its own slots');

  const slotLabel = await page.$eval('#slot-meter-label', el => el.textContent);
  // 2 Gang copies x 2 slots + 1 Leader x 0 slots = 4 slots used.
  assert.ok(slotLabel.startsWith('4 / 10'), `expected the slot meter to read "4 / 10 ..." (2 Gangs x 2 slots + Leader x 0), got "${slotLabel}"`);
  ok('The slot meter correctly totals both Gang copies\' slot costs');

  // ---- 7. Removing one Gang row leaves the other Gang row and the
  // Leader untouched — duplicates are independently removable. ----
  const gangRemoveBtn = page.locator('.roster-row', { hasText: 'Rebel Commandos' }).first().locator('.roster-row-remove');
  await gangRemoveBtn.click();
  await page.waitForTimeout(150);
  const rowsAfterRemove = await page.$$eval('.roster-row', els => els.map(el => el.querySelector('.roster-row-name').textContent));
  assert.deepStrictEqual(rowsAfterRemove.sort(), ['Rebel Commandos', 'Solo'], `expected one Gang copy and the Leader left after removing one Gang row, got ${JSON.stringify(rowsAfterRemove)}`);
  ok('Removing one Gang copy leaves the other Gang copy and the Leader in place — duplicates are independently removable');

  // ---- 8. Saving and reloading the roster preserves both original Gang
  // copies correctly (round-trip through IndexedDB doesn't collapse
  // duplicate cardIds). Re-add the second Gang copy first to restore the
  // pre-removal state, then save/reload. ----
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(150);
  await clickAddByName('Rebel Commandos');
  await page.click('#close-colleague-picker');
  await page.waitForTimeout(150);
  await page.fill('#roster-name', 'Test League');
  await page.click('#roster-save');
  await page.waitForTimeout(200);
  await page.selectOption('#roster-picker', { label: 'Test League' });
  await page.waitForTimeout(200);
  const rowsAfterReload = await page.$$eval('.roster-row', els => els.map(el => el.querySelector('.roster-row-name').textContent));
  assert.strictEqual(rowsAfterReload.filter(n => n === 'Rebel Commandos').length, 2, `expected both Gang copies to survive a save/reload round-trip, got ${JSON.stringify(rowsAfterReload)}`);
  ok('Both Gang copies survive a roster save/reload round-trip through IndexedDB');

  console.log('\nAll verify40 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
