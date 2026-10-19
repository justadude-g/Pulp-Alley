// verify66.js — Card Designer changes made together (Backup now uses the
// character layout; there is no separate Bystanders type):
//   1. An opt-in "(include)" checkbox beside Card Type that prints the type
//      as a top-right tag again (off by default; persisted per card).
//   2. Backup (Core Rules p. 97) as a regular character-layout card with a
//      Backup Type picker (Level 1-3 rows fill Level, Health, Stats).
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
  ok('Checkbox is hidden for Associate and the resource types');

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

  // ---- 7. Cost is a 1-4 dropdown on the resource (asset) types. ----
  await page.click('.tab-btn[data-tab="designer"]');
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  await page.selectOption('#f-theme', 'ivory');
  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.$eval('#f-assetCost', e => e.tagName), 'SELECT');
  assert.deepStrictEqual(await page.$$eval('#f-assetCost option', els => els.map(e => e.value)), ['1', '2', '3', '4']);
  ok('Cost is a 1-4 dropdown');

  // ---- 8. Backup / Bystanders: regular character layout + p. 97 options. ----
  const readStats = () => page.$$eval('.stat-row', rows => Object.fromEntries(rows.map(r => [
    r.dataset.stat, `${r.querySelector('.stat-n').value}d${r.querySelector('.stat-d').value}`])));
  const S = (b, s, d, m, f, c) => ({ brawl: b, shoot: s, dodge: d, might: m, finesse: f, cunning: c });
  const expected = {
    '1:Brawler': { lvl: '1', hp: 'd6', ast: true,  st: S('2d6', '1d6', '1d6', '1d6', '1d6', '1d6') },
    '1:Shooter': { lvl: '1', hp: 'd6', ast: true,  st: S('1d6', '2d6', '1d6', '1d6', '1d6', '1d6') },
    '1:Scout':   { lvl: '1', hp: 'd6', ast: true,  st: S('1d6', '1d6', '2d6', '1d6', '1d6', '1d6') },
    '1:Animal':  { lvl: '1', hp: 'd6', ast: true,  st: S('2d6', '0d0', '2d6', '1d6', '1d6', '1d6') },
    '2:Brawler': { lvl: '2', hp: 'd6', ast: false, st: S('3d6', '1d6', '2d6', '1d6', '1d6', '1d6') },
    '2:Shooter': { lvl: '2', hp: 'd6', ast: false, st: S('1d6', '3d6', '2d6', '1d6', '1d6', '1d6') },
    '2:Scout':   { lvl: '2', hp: 'd6', ast: false, st: S('1d6', '1d6', '3d6', '1d6', '2d6', '1d6') },
    '2:Animal':  { lvl: '2', hp: 'd6', ast: false, st: S('3d6', '0d0', '3d6', '1d6', '1d6', '1d6') },
    '3:Brawler': { lvl: '3', hp: 'd8', ast: false, st: S('4d8', '2d6', '3d8', '4d8', '2d6', '2d6') },
    '3:Shooter': { lvl: '3', hp: 'd8', ast: false, st: S('2d6', '4d8', '3d8', '2d6', '2d6', '4d8') },
    '3:Scout':   { lvl: '3', hp: 'd8', ast: false, st: S('2d6', '2d6', '4d8', '2d6', '4d8', '3d8') },
    '3:Animal':  { lvl: '3', hp: 'd8', ast: false, st: S('5d8', '0d0', '4d8', '3d8', '2d6', '2d6') },
  };

  await page.selectOption('#f-cardType', 'Backup');
  await page.waitForTimeout(150);
  for (const sel of ['#level-field-wrap', '#stats-fieldset', '#health-fieldset', '#abilities-fieldset', '#backup-option-row']) {
    assert.strictEqual(await page.isVisible(sel), true, `${sel} visible for Backup (regular character layout)`);
  }
  assert.strictEqual(await page.isVisible('#asset-fieldset'), false, 'no Cost/Description fieldset for Backup');
  assert.strictEqual(await page.isVisible('#type-tag-toggle'), true);
  const opts = await page.$$eval('#f-backupOption option', els => els.map(e => e.textContent));
  assert.strictEqual(opts.length, 13, 'twelve Level 1-3 rows plus Level 3: Custom');
  assert.strictEqual(opts[0], 'Level 1: Brawler');
  assert.strictEqual(opts[12], 'Level 3: Custom');
  ok('Backup uses the character layout with a 13-row Backup Type picker (p. 97)');

  for (const [key, e] of Object.entries(expected)) {
    await page.selectOption('#f-backupOption', key);
    await page.waitForTimeout(80);
    assert.strictEqual(await page.inputValue('#f-level'), e.lvl, `${key} level`);
    assert.strictEqual(await page.inputValue('#f-healthStart'), e.hp, `${key} health die`);
    assert.strictEqual(await page.isChecked('#f-healthAsterisk'), e.ast, `${key} health asterisk`);
    assert.deepStrictEqual(await readStats(), e.st, `${key} stats`);
    assert.strictEqual(await page.inputValue('#f-name'), key.split(':')[1], `${key} name has no "Level N:"`);
  }
  ok('All twelve p. 97 Backup rows fill Level, Health (with asterisk at Level 1) and Stats; name is just the role');

  await page.selectOption('#f-backupOption', '3:Custom');
  assert.strictEqual(await page.inputValue('#f-level'), '3');
  assert.strictEqual(await page.inputValue('#f-healthStart'), 'd8');
  ok('Level 3: Custom starts from a Sidekick (Level 3, d8)');

  // Reset Stats restores the picked row; a typed name survives a type change.
  await page.selectOption('#f-backupOption', '2:Scout');
  await page.selectOption('.stat-row[data-stat="might"] .stat-n', '4');
  await page.click('#reset-stats');
  assert.deepStrictEqual(await readStats(), expected['2:Scout'].st);
  await page.fill('#f-name', 'Old Pete');
  await page.selectOption('#f-backupOption', '2:Shooter');
  assert.strictEqual(await page.inputValue('#f-name'), 'Old Pete');
  ok('Reset Stats restores the picked Backup row; a hand-typed name is kept');

  // The badge shows the Level, and the tag is opt-in with the type name.
  await page.selectOption('#f-backupOption', '3:Brawler');
  await page.uncheck('#f-showCardType');
  await page.waitForTimeout(120);
  const bkOff = await tagRegion();
  await page.check('#f-showCardType');
  await page.waitForTimeout(120);
  assert.notStrictEqual(await tagRegion(), bkOff, 'BACKUP tag draws when included');
  ok('Backup tag is opt-in like other characters');

  // There is no separate Bystanders type: Bystander cards come from Backup's
  // Level 2 rows.
  const allTypes = await page.$$eval('#f-cardType option', els => els.map(e => e.value || e.textContent));
  assert(!allTypes.includes('Bystanders'), 'no Bystanders Card Type');
  assert(!(await page.$$eval('#gallery-type-filter option', els => els.map(e => e.value))).includes('Bystanders'));
  await page.selectOption('#f-cardType', 'Backup');
  await page.selectOption('#f-backupOption', '2:Animal');
  assert.strictEqual(await page.inputValue('#f-level'), '2');
  assert.deepStrictEqual(await readStats(), expected['2:Animal'].st);
  assert(/Bystander/.test(await page.textContent('#backup-hint')), 'hint points Bystander cards at Level 2 Backup');
  ok('No Bystanders type; Bystander cards are made from Backup Level 2 types');

  // Save -> My Cards -> reload keeps the type and option; roster excludes it.
  await page.click('#btn-new-card');
  await page.selectOption('#f-cardType', 'Backup');
  await page.selectOption('#f-backupOption', '3:Shooter');
  await page.fill('#f-name', 'Hired Gun');
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Hired Gun") [data-act="edit"]');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.inputValue('#f-cardType'), 'Backup');
  assert.strictEqual(await page.inputValue('#f-backupOption'), '3:Shooter');
  assert.strictEqual(await page.inputValue('#f-level'), '3');
  assert.deepStrictEqual(await readStats(), expected['3:Shooter'].st);
  ok('Backup card saves and reloads with its type, Level and Stats');

  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(250);
  const picker = await page.textContent('#colleague-picker-list');
  assert(!/Hired Gun/.test(picker), 'Backup is not a roster pick');
  ok('Backup is not offered in the League Roster picker');

  // ---- 9. Old Cost-badge Backup/Bystanders cards convert on load/print. ----
  const migrated = await page.evaluate(() => [
    migrateLegacyBackupData({ cardType: 'Backup', name: 'Level 2: Shooter', assetCost: 2, assetDescription: 'x' }),
    migrateLegacyBackupData({ cardType: 'Bystanders', name: 'Level 2: Animal', assetCost: 2, assetDescription: 'x' }),
    migrateLegacyBackupData({ cardType: 'Backup', name: 'Odd Name', assetCost: 3 }),
    migrateLegacyBackupData({ cardType: 'Backup', name: 'Hired Gun', backupOption: '3:Shooter', level: 3 }),
  ]);
  assert.strictEqual(migrated[0].backupOption, '2:Shooter');
  assert.strictEqual(migrated[0].level, 2);
  assert.strictEqual(migrated[0].name, 'Shooter');
  assert.strictEqual(migrated[0].stats.shoot.n, 3);
  assert.strictEqual(migrated[1].cardType, 'Backup', 'old Bystanders cards become Backup');
  assert.strictEqual(migrated[1].backupOption, '2:Animal');
  assert.deepStrictEqual(migrated[1].stats.shoot, { n: 0, d: 0 });
  assert.strictEqual(migrated[2].level, 3, 'unparseable name falls back to Cost as Level');
  assert.strictEqual(migrated[2].name, 'Odd Name', 'a custom name is kept');
  assert.strictEqual(migrated[3].level, 3, 'already-converted cards are left alone');
  ok('Legacy Backup and short-lived Bystanders asset cards convert to the character layout');

  console.log('\nAll verify66 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
