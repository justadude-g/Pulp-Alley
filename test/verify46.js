// verify46.js — Deleting a card or roster used to be a plain confirm()
// and then permanent. Both now move to a "Recently Deleted" trash (top
// bar button, with a "(N)" badge) instead of hard-deleting: Restore puts
// it back, "Delete Forever" removes it for good, and anything left
// untouched for 30 days is auto-purged (checked directly against the db
// layer here, not by waiting 30 real days).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8896;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  page.on('dialog', async (d) => { await d.accept(); }); // accept every delete/restore confirm
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Save and delete a card. It disappears from My Cards but isn't
  // gone — it shows up in Recently Deleted, and the top-bar badge reflects it. ----
  await page.fill('#f-name', 'Test Hero');
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Test Hero") [data-act="delete"]');
  await page.waitForTimeout(250);

  let galleryNames = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.ok(!galleryNames.includes('Test Hero'), 'expected the deleted card to disappear from My Cards');
  ok('Deleting a card removes it from My Cards');

  const badgeAfterDelete = await page.$eval('#trash-count-badge', el => el.textContent);
  assert.strictEqual(badgeAfterDelete, '(1)', `expected the Recently Deleted badge to read "(1)", got "${badgeAfterDelete}"`);
  ok('The Recently Deleted badge shows a count right after deleting');

  await page.click('#btn-recently-deleted');
  await page.waitForTimeout(200);
  const trashNamesAfterCardDelete = await page.$$eval('#trash-list .library-item-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(trashNamesAfterCardDelete, ['Test Hero'], `expected "Test Hero" to appear in Recently Deleted, got ${JSON.stringify(trashNamesAfterCardDelete)}`);
  const trashKind = await page.$eval('#trash-list .library-item-level', el => el.textContent);
  assert.strictEqual(trashKind, 'Card', `expected the trashed item to be tagged "Card", got "${trashKind}"`);
  ok('The deleted card appears in Recently Deleted, correctly tagged as a Card');

  // ---- 2. Restore it. It reappears in My Cards, and Recently Deleted empties out. ----
  await page.click('[data-trash-act="restore"]');
  await page.waitForTimeout(250);
  const trashEmptyMsg = await page.locator('#trash-list .library-empty').textContent();
  assert.ok(/nothing in recently deleted/i.test(trashEmptyMsg), `expected Recently Deleted to be empty after restoring, got "${trashEmptyMsg}"`);
  await page.click('#close-trash-modal');
  await page.waitForTimeout(150);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  galleryNames = await page.$$eval('.gc-name', els => els.map(e => e.textContent));
  assert.ok(galleryNames.includes('Test Hero'), 'expected "Test Hero" to reappear in My Cards after Restore');
  ok('Restoring a trashed card puts it back in My Cards, and empties Recently Deleted');

  // ---- 3. Delete it again, then permanently delete it from the trash.
  // This time it's gone for good — not in My Cards, not in the trash. ----
  await page.click('.gallery-card:has-text("Test Hero") [data-act="delete"]');
  await page.waitForTimeout(250);
  await page.click('#btn-recently-deleted');
  await page.waitForTimeout(200);
  await page.click('[data-trash-act="delete-forever"]');
  await page.waitForTimeout(250);
  const trashEmptyMsg2 = await page.locator('#trash-list .library-empty').textContent();
  assert.ok(/nothing in recently deleted/i.test(trashEmptyMsg2), 'expected Recently Deleted to be empty after Delete Forever');
  await page.click('#close-trash-modal');
  const allCardsAfterForever = await page.evaluate(() => getAllCards());
  assert.ok(!allCardsAfterForever.some(c => c.formData?.name === 'Test Hero'), 'expected "Test Hero" to be permanently gone after Delete Forever');
  ok('"Delete Forever" removes a trashed card for good — not restorable, not in My Cards');

  // ---- 4. Same undo-able delete for rosters. ----
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.fill('#roster-name', 'Test League');
  await page.click('#roster-save');
  await page.waitForTimeout(250);
  await page.click('#roster-delete');
  await page.waitForTimeout(250);

  const rosterOptionsAfterDelete = await page.$$eval('#roster-picker option', els => els.map(e => e.textContent));
  assert.ok(!rosterOptionsAfterDelete.includes('Test League'), 'expected the deleted roster to disappear from the roster picker');

  await page.click('#btn-recently-deleted');
  await page.waitForTimeout(200);
  const trashNamesAfterRosterDelete = await page.$$eval('#trash-list .library-item-name', els => els.map(e => e.textContent));
  assert.deepStrictEqual(trashNamesAfterRosterDelete, ['Test League'], `expected "Test League" in Recently Deleted, got ${JSON.stringify(trashNamesAfterRosterDelete)}`);
  const rosterTrashKind = await page.$eval('#trash-list .library-item-level', el => el.textContent);
  assert.strictEqual(rosterTrashKind, 'Roster', `expected the trashed item to be tagged "Roster", got "${rosterTrashKind}"`);
  ok('Deleting a roster also moves it to Recently Deleted, correctly tagged as a Roster');

  await page.click('[data-trash-act="restore"]');
  await page.waitForTimeout(250);
  await page.click('#close-trash-modal');
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  const rosterOptionsAfterRestore = await page.$$eval('#roster-picker option', els => els.map(e => e.textContent));
  assert.ok(rosterOptionsAfterRestore.includes('Test League'), 'expected "Test League" to reappear in the roster picker after Restore');
  ok('Restoring a trashed roster puts it back in the roster picker');

  // ---- 5. Auto-purge: anything older than 30 days is dropped for good.
  // Seeded directly at the db layer rather than waiting 30 real days. ----
  const purgeResult = await page.evaluate(async () => {
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    await moveToTrash('card', {
      id: 'stale-trash-card',
      formData: { name: 'Ancient Card' },
      pngDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    });
    // moveToTrash always stamps deletedAt = now, so back-date it directly.
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('trash', 'readwrite');
      const store = tx.objectStore('trash');
      const req = store.get('card:stale-trash-card');
      req.onsuccess = () => {
        const entry = req.result;
        entry.deletedAt = Date.now() - THIRTY_ONE_DAYS_MS;
        store.put(entry);
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    const purged = await purgeOldTrash();
    const remaining = await getAllTrash();
    return { purged, remainingCount: remaining.length };
  });
  assert.strictEqual(purgeResult.purged, 1, `expected purgeOldTrash() to purge exactly the 1 stale (31-day-old) entry, got ${purgeResult.purged}`);
  assert.strictEqual(purgeResult.remainingCount, 0, `expected nothing left in the trash after purging the only (stale) entry, got ${purgeResult.remainingCount}`);
  ok('purgeOldTrash() permanently drops trash entries older than the 30-day retention window');

  console.log('\nAll verify46 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
