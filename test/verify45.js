// verify45.js — Saving a card with a blank Name used to silently save as
// "Unnamed Character" with no warning, letting half-finished/junk cards
// pile up unnoticed. Save now confirms first ("This card has no Name —
// save it anyway?"); cancelling leaves nothing saved, accepting saves it
// as "Unnamed Character" same as before. A card WITH a name saves with no
// dialog at all — this is a confirm, not a new required-field block.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8895;
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

  // ---- 1. A normal, named save triggers no dialog at all. ----
  let dialogSeen = false;
  const dialogHandler = async (d) => { dialogSeen = true; await d.accept(); };
  page.on('dialog', dialogHandler);
  await page.fill('#f-name', 'Han Solo');
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  assert.strictEqual(dialogSeen, false, 'expected saving a card WITH a name to trigger no confirm dialog');
  page.off('dialog', dialogHandler);
  let cards = await page.evaluate(() => getAllCards());
  assert.strictEqual(cards.length, 1, 'expected the named card to be saved');
  ok('Saving a card with a Name triggers no confirmation dialog at all');

  // ---- 2. A blank-name save prompts for confirmation. Cancelling leaves
  // nothing saved. ----
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  const nameField = await page.inputValue('#f-name');
  assert.strictEqual(nameField, '', 'expected a fresh New Card to start with a blank Name');

  let confirmMessage = '';
  page.once('dialog', async (d) => { confirmMessage = d.message(); await d.dismiss(); });
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  assert.ok(/no name/i.test(confirmMessage), `expected the confirm to mention the blank Name, got "${confirmMessage}"`);
  cards = await page.evaluate(() => getAllCards());
  assert.strictEqual(cards.length, 1, 'expected cancelling the confirm to leave the blank card unsaved (still just the 1 named card)');
  ok('Saving with a blank Name prompts for confirmation, and cancelling saves nothing');

  // ---- 3. Accepting the confirm saves it as "Unnamed Character", same as
  // the old (unwarned) behavior. ----
  page.once('dialog', async (d) => { await d.accept(); });
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  cards = await page.evaluate(() => getAllCards());
  assert.strictEqual(cards.length, 2, 'expected accepting the confirm to save the blank card');
  const unnamed = cards.find(c => !c.formData?.name);
  assert.ok(unnamed, 'expected to find the blank-name card among saved cards');
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  const names = await page.$$eval('.gc-name', els => els.map(e => e.textContent).sort());
  assert.deepStrictEqual(names, ['Han Solo', 'Unnamed'], `expected the blank card to display as "Unnamed" in the gallery (gc-name falls back to "Unnamed"), got ${JSON.stringify(names)}`);
  ok('Accepting the confirm saves the blank-name card, same as the prior unwarned behavior');

  console.log('\nAll verify45 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
