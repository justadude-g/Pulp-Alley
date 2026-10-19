// verify66.js — three Card Designer changes made together:
//   1. An opt-in "(include)" checkbox beside Card Type that prints the type
//      as a top-right tag again (off by default; persisted per card).
//   2. A new "Bystanders" Card Type (Core Rules p. 91): not a character, so
//      no Level/Health/Stats/Cost, the p. 91 rules pre-filled as text.
//   3. "Custom" is labelled "Custom (NPC)" in the Designer (value unchanged).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8866;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }
function norm(hex) { return String(hex).toLowerCase(); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // Raw pixels of the card's top-right corner, where the tag sits.
  const tagRegion = () => page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return Array.from(ctx.getImageData(520, 30, 210, 62).data).join(',');
  });
  const pixel = (x, y) => page.evaluate(([x, y]) => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
  }, [x, y]);

  // ---- 1. Custom (NPC) label. ----
  const custom = await page.$eval('#f-cardType option[value="Custom"]', e => e.textContent.trim());
  assert.strictEqual(custom, 'Custom (NPC)');
  ok('Designer shows "Custom (NPC)" (value stays "Custom")');

  // ---- 2. Checkbox: present, off by default, visible for characters. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  assert.strictEqual(await page.isChecked('#f-showCardType'), false, 'include must default to unticked');
  assert.strictEqual(await page.isVisible('#type-tag-toggle'), true);
  const caption = await page.$eval('.card-type-caption', e => e.textContent.replace(/\s+/g, ' ').trim());
  assert(/Card Type\s*\(include\)/.test(caption), `expected "Card Type (include)" caption, got "${caption}"`);
  ok('"(include)" sits beside Card Type, unticked by default');

  // ---- 3. Ticking draws the tag; unticking removes it. ----
  const off = await tagRegion();
  await page.check('#f-showCardType');
  await page.waitForTimeout(150);
  const on = await tagRegion();
  assert.notStrictEqual(on, off, 'ticking include should change the top-right of the card');
  await page.uncheck('#f-showCardType');
  await page.waitForTimeout(150);
  assert.strictEqual(await tagRegion(), off, 'unticking should restore the tag-free card exactly');
  ok('Ticking prints the tag top-right; unticking removes it');

  // ---- 4. Tag works for every optional type and shows on Custom. ----
  for (const t of ['Sidekick', 'Villain', 'Custom', 'Gang']) {
    await page.selectOption('#f-cardType', t);
    await page.uncheck('#f-showCardType');
    await page.waitForTimeout(120);
    const a = await tagRegion();
    await page.check('#f-showCardType');
    await page.waitForTimeout(120);
    assert.notStrictEqual(await tagRegion(), a, `tag should draw for ${t}`);
  }
  ok('Tag draws for Sidekick, Villain, Custom and Gang');

  // ---- 5. Hidden where the card already carries its own label. ----
  for (const t of ['Associate', 'Gear', 'Contacts']) {
    await page.selectOption('#f-cardType', t);
    await page.waitForTimeout(100);
    assert.strictEqual(await page.isVisible('#type-tag-toggle'), false, `checkbox should be hidden for ${t}`);
  }
  ok('Checkbox is hidden for Associate and the six resource types');

  // Resource cards keep their always-on pill regardless of the flag.
  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(100);
  const gearA = await tagRegion();
  await page.evaluate(() => { document.getElementById('f-showCardType').checked = false; document.getElementById('f-name').dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(100);
  assert.strictEqual(gearA, await tagRegion(), 'Gear pill must not depend on the flag');
  ok('Resource cards keep their pill independent of the flag');

  // ---- 6. Persistence through Save -> My Cards -> Edit; New Card resets. ----
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.isChecked('#f-showCardType'), false, 'New Card resets include to unticked');
  await page.selectOption('#f-cardType', 'Ally');
  await page.fill('#f-name', 'Tagged Ally');
  await page.check('#f-showCardType');
  await page.waitForTimeout(100);
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  await page.click('#btn-new-card');
  await page.fill('#f-name', 'Plain Ally');
  await page.selectOption('#f-cardType', 'Ally');
  await page.waitForTimeout(100);
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Tagged Ally") [data-act="edit"]');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isChecked('#f-showCardType'), true, 'saved include=true should reload ticked');
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  await page.click('.gallery-card:has-text("Plain Ally") [data-act="edit"]');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isChecked('#f-showCardType'), false, 'a card saved without it reloads unticked');
  ok('include persists per card through Save -> My Cards -> Edit; New Card resets it');

  // ---- 7. Bystanders (p. 91 + 97): a Level 2 Backup-style asset. ----
  await page.click('.tab-btn[data-tab="designer"]');
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  const types = await page.$$eval('#f-cardType option', els => els.map(e => e.value || e.textContent));
  assert(types.includes('Bystanders'), 'Bystanders in Card Type dropdown');
  await page.selectOption('#f-theme', 'ivory');
  await page.selectOption('#f-cardType', 'Bystanders');
  await page.waitForTimeout(150);
  assert.strictEqual(norm(await page.inputValue('#f-accentColor')), '#4b6b3c', 'shares the Backup/asset green');
  assert.strictEqual(await page.inputValue('#f-assetCost'), '2', 'Cost starts at 2 (Level 2 Backup)');
  for (const sel of ['#level-field-wrap', '#stats-fieldset', '#health-fieldset', '#abilities-fieldset']) {
    assert.strictEqual(await page.isVisible(sel), false, `${sel} hidden: not a regular character Level`);
  }
  assert.strictEqual(await page.isVisible('#asset-fieldset'), true);
  assert.strictEqual(await page.isVisible('#type-tag-toggle'), false, 'asset pill is always on, so no checkbox');
  assert(/Level 2 Backup/.test(await page.textContent('#asset-type-hint')), 'p. 91 note shown');
  const costOpts = await page.$$eval('#f-assetCost option', els => els.map(e => e.value));
  assert.deepStrictEqual(costOpts, ['1', '2', '3', '4'], 'Cost is a 1-4 dropdown');
  assert.strictEqual(await page.$eval('#f-assetCost', e => e.tagName), 'SELECT');
  ok('Cost is a 1-4 dropdown');
  ok('Bystanders: asset layout, own Cost 2, Backup green, p. 91 note, no regular Level/Stats');

  // Library: exactly the four Level 2 Backup rows from p. 97.
  await page.click('#open-asset-library');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.textContent('#asset-library-title'), 'Bystanders Library');
  const names = await page.$$eval('#asset-library-list .library-item-name', els => els.map(e => e.textContent.trim()));
  assert.deepStrictEqual(names, ['Brawler', 'Shooter', 'Scout', 'Animal']);
  ok('Library offers the four Level 2 Backup options');

  await page.click('#asset-library-list .library-item:has-text("Animal") .library-add-btn');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.inputValue('#f-name'), 'Animal', 'no "Level 2:" prefix on the card name');
  assert.strictEqual(await page.inputValue('#f-assetCost'), '2');
  assert.strictEqual(await page.inputValue('#f-assetDescription'), 'Health: d6. Skills: Brawl 3d6, Shoot no-dice, Dodge 3d6.');
  ok('Picking an option fills a plain name (no "Level 2:"), Cost 2 and the p. 97 skills');

  // The card carries the BYSTANDERS pill (always on) in the header.
  const pill = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return Array.from(ctx.getImageData(520, 30, 210, 62).data).some((v, i) => i % 4 === 0 && v < 120);
  });
  assert(pill, 'Bystanders pill is drawn top-right');
  ok('Bystanders card prints its type pill');

  // Save + reload; not offered for League Rosters.
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.selectOption('#gallery-type-filter', 'Bystanders');
  await page.waitForTimeout(200);
  await page.click('.gallery-card:has-text("Animal") [data-act="edit"]');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.inputValue('#f-cardType'), 'Bystanders');
  assert.strictEqual(await page.inputValue('#f-assetCost'), '2');
  ok('Bystanders card saves, filters and reloads');

  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(250);
  assert(!/Animal/.test(await page.textContent('#colleague-picker-list')), 'not in the roster picker');
  ok('Bystanders are not offered in the League Roster picker');

  console.log('\nAll verify66 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
