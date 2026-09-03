// verify52.js — League Roster colleagues auto-sort by Level, highest
// first (Core Rules p. 8-9: Leader is always Level 4, down through
// Sidekick 3, Ally 2, Follower 1), regardless of the order they were
// added in. A pure display convenience — it doesn't touch slot cost or
// rule warnings, and members sharing a Level keep the order they were
// added in (a stable sort).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8902;
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

  async function saveCard(name, cardType, level) {
    await page.click('.tab-btn[data-tab="designer"]');
    await page.waitForTimeout(100);
    await page.click('#btn-new-card');
    await page.waitForTimeout(100);
    await page.selectOption('#f-cardType', cardType);
    await page.waitForTimeout(100);
    await page.fill('#f-name', name);
    if (level !== undefined) await page.selectOption('#f-level', String(level));
    await page.waitForTimeout(100);
    await page.click('#btn-save-card');
    await page.waitForTimeout(200);
  }

  // Assumes the colleague picker modal is already open (opened once by the
  // caller) — re-clicking #open-colleague-picker on every add isn't needed
  // and, since the modal stays open across adds, just fights Playwright's
  // actionability checks against the still-visible overlay.
  async function addByName(name) {
    const items = await page.$$('#colleague-picker-list .library-item');
    for (const item of items) {
      const itemName = await item.$eval('.library-item-name', el => el.textContent);
      if (itemName === name) {
        await item.$eval('.library-add-btn', el => el.click());
        await page.waitForTimeout(150);
        return true;
      }
    }
    return false;
  }

  async function rosterRows() {
    return page.$$eval('#roster-members .roster-row', els => els.map(el => ({
      name: el.querySelector('.roster-row-name').textContent,
      cardType: el.querySelector('.roster-row-meta').textContent,
    })));
  }

  // ---- 1. Seed cards at each rulebook Level: Ally (2), Leader (4),
  // Follower (1), Sidekick (3) — deliberately NOT in Level order. ----
  await saveCard('Wingman', 'Ally', 2);
  await saveCard('The Chief', 'Leader', 4);
  await saveCard('Grunt', 'Follower', 1);
  await saveCard('Second-in-Command', 'Sidekick', 3);

  // ---- 2. Add them to the roster out of Level order (Ally, then Leader,
  // then Follower, then Sidekick) — the example from the feature request. ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);
  await addByName('Wingman');
  await addByName('The Chief');
  await addByName('Grunt');
  await addByName('Second-in-Command');
  await page.click('#close-colleague-picker');
  await page.waitForTimeout(150);

  let rows = await rosterRows();
  assert.deepStrictEqual(
    rows.map(r => r.name),
    ['The Chief', 'Second-in-Command', 'Wingman', 'Grunt'],
    `expected colleagues auto-sorted highest Level first (Leader 4, Sidekick 3, Ally 2, Follower 1) regardless of add order, got ${JSON.stringify(rows)}`
  );
  ok('Colleagues added out of order (Ally, Leader, Follower, Sidekick) end up sorted top-to-bottom by Level: Leader, Sidekick, Ally, Follower');

  // ---- 3. Removing a member re-renders with the remaining members still
  // correctly sorted (guards against a stale index after the sort). ----
  const rowsBeforeRemove = await page.$$eval('#roster-members .roster-row', els => els.length);
  await page.click('#roster-members .roster-row .roster-row-remove'); // removes the top row, "The Chief"
  await page.waitForTimeout(150);
  rows = await rosterRows();
  assert.strictEqual(rows.length, rowsBeforeRemove - 1, 'expected exactly one member removed');
  assert.deepStrictEqual(rows.map(r => r.name), ['Second-in-Command', 'Wingman', 'Grunt'], `expected the remaining members still sorted by Level after removing the top one, got ${JSON.stringify(rows)}`);
  ok('Removing a member keeps the remaining list correctly sorted, with no index drift');

  // ---- 4. A saved-then-reloaded roster (a fresh page load / IndexedDB
  // round-trip) stays sorted, proving the order isn't just a one-time
  // render artifact. ----
  await page.fill('#roster-name', 'Sort Test League');
  await page.click('#roster-save');
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForTimeout(400);
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.selectOption('#roster-picker', { label: 'Sort Test League' });
  await page.waitForTimeout(200);
  rows = await rosterRows();
  assert.deepStrictEqual(rows.map(r => r.name), ['Second-in-Command', 'Wingman', 'Grunt'], `expected the reloaded roster to still be sorted by Level, got ${JSON.stringify(rows)}`);
  ok('A saved and reloaded roster keeps its Level-sorted order');

  // ---- 5. Two colleagues sharing the same Level keep the order they
  // were added in (a stable sort, not a re-shuffle). ----
  await saveCard('Wingman Two', 'Ally', 2);
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);
  await addByName('Wingman Two');
  await page.click('#close-colleague-picker');
  await page.waitForTimeout(150);
  rows = await rosterRows();
  const allyNames = rows.filter(r => r.cardType === 'Ally').map(r => r.name);
  assert.deepStrictEqual(allyNames, ['Wingman', 'Wingman Two'], `expected same-Level colleagues to keep their add order (stable sort), got ${JSON.stringify(allyNames)}`);
  ok('Colleagues sharing the same Level keep the order they were added in');

  console.log('\nAll verify52 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
