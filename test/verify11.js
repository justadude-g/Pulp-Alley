// verify11.js — Ability rules warnings, skill-dice hint, library level-cap
// dimming, and ability renaming (baseName tracking + reset link).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8829;
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

  // ---- 1. Skill-dice hint populates per Card Type ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(100);
  let hint = await page.textContent('#skill-dice-hint');
  assert(hint.includes('Leader (p.9)'), `expected Leader hint, got: ${hint}`);
  ok('Leader skill-dice-hint populated');

  await page.selectOption('#f-cardType', 'Follower');
  await page.waitForTimeout(100);
  hint = await page.textContent('#skill-dice-hint');
  assert(hint.includes('Follower (p.9)'), `expected Follower hint, got: ${hint}`);
  ok('Follower skill-dice-hint populated');

  await page.selectOption('#f-cardType', 'Villain');
  await page.waitForTimeout(100);
  hint = await page.textContent('#skill-dice-hint');
  assert.strictEqual(hint.trim(), '', `expected empty hint for Villain, got: ${hint}`);
  ok('Villain skill-dice-hint stays empty (not in fixed table)');

  // ---- 2. Ability count warning ----
  await page.selectOption('#f-cardType', 'Follower'); // maxAbilities: 1
  await page.waitForTimeout(100);
  // Follower starts with one empty ability row already; fill it, then add 2 more.
  async function setAbilityRow(idx, name, text) {
    const rows = await page.$$('.ability-item');
    await rows[idx].$eval('input[data-field="name"]', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, name);
    await rows[idx].$eval('textarea[data-field="text"]', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  }
  await setAbilityRow(0, 'Agile', 'Add +1 die to Dodge.');
  await page.click('#add-ability');
  await setAbilityRow(1, 'Clever', 'Add +1 die to Cunning.');
  await page.waitForTimeout(150);
  let warnings = await page.textContent('#ability-warnings');
  assert(warnings.includes('at most 1 abilit'), `expected count warning, got: ${warnings}`);
  ok('Ability count warning fires when a Follower has 2 abilities');

  // ---- 3. Level Restriction warning ----
  // Reset to a single ability row with a Level-2 ability on a Follower (cap 1).
  await page.click('.ability-remove'); // remove first row, leaving just 'Clever' (level 1)
  await page.waitForTimeout(100);
  let rows = await page.$$('.ability-item');
  assert.strictEqual(rows.length, 1, 'expected exactly 1 ability row after removal');
  await setAbilityRow(0, 'Big', 'Raise Health and Might one dice-type. Reduce Dodge and Finesse one dice-type. Note, if a d6 skill is reduced then it drops to no-dice.');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#ability-warnings');
  assert(warnings.includes('Level Restriction'), `expected level-restriction warning, got: ${warnings}`);
  ok('Level Restriction warning fires for a Level 2 ability on a Follower (cap 1)');

  // ---- 4. Duplicate warning ----
  await page.selectOption('#f-cardType', 'Leader'); // maxAbilities 3, plenty of room
  await page.waitForTimeout(100);
  await setAbilityRow(0, 'Agile', 'Add +1 die to Dodge.');
  await page.click('#add-ability');
  rows = await page.$$('.ability-item');
  await setAbilityRow(1, 'Agile', 'Add +1 die to Dodge.');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#ability-warnings');
  assert(warnings.includes('No Duplicates'), `expected duplicate warning, got: ${warnings}`);
  ok('Duplicate warning fires for the same ability twice');

  // ---- 5. No-Dice conflict warning ----
  await setAbilityRow(0, 'Brainy', 'Add +1 die to Dodge and Cunning. Reduce Brawl to no-dice.');
  await setAbilityRow(1, 'Sly', 'Add +1 die to Dodge and Finesse. Reduce Brawl to no-dice.');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#ability-warnings');
  assert(warnings.includes('No-Dice'), `expected no-dice warning, got: ${warnings}`);
  ok('No-Dice conflict warning fires when 2 abilities both zero out Brawl');

  // ---- 6. No-Action conflict warning ----
  await setAbilityRow(0, 'Beast', 'You cannot perform actions. Select two of the following abilities at no cost: Animal, Aquatic, Big, Fierce, Mindless, Reanimated, Speedy, Swarm, Winged.');
  await setAbilityRow(1, 'Goon', 'You cannot perform actions. Select two of the following abilities at no cost: Aquatic, Brute, Fierce, Marksman, Sharp, Slam, Trick, Winged.');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#ability-warnings');
  assert(warnings.includes('No-Action'), `expected no-action warning, got: ${warnings}`);
  ok('No-Action conflict warning fires when 2 abilities both prevent actions');

  // ---- 7. Library level-cap dimming ----
  await page.selectOption('#f-cardType', 'Follower'); // maxAbilityLevel: 1
  await page.waitForTimeout(100);
  await page.click('#open-ability-library');
  await page.waitForTimeout(150);
  await page.fill('#library-search', 'Big'); // Level 2 ability
  await page.waitForTimeout(150);
  const overcapCount = await page.$$eval('.library-item-overcap', els => els.length);
  assert(overcapCount >= 1, 'expected at least one dimmed over-cap library item for "Big" on a Follower');
  ok('Ability Library dims Level 2 "Big" for a Follower (cap Level 1)');
  await page.click('#close-ability-library');

  // ---- 8. Rename feature: baseName tracking + reset link ----
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(100);
  await page.click('#open-ability-library');
  await page.fill('#library-search', 'Animal');
  await page.waitForTimeout(150);
  await page.click('.library-add-btn');
  await page.waitForTimeout(150);
  await page.click('#close-ability-library');
  await page.waitForTimeout(100);

  let nameInput = await page.$('.ability-item input[data-field="name"]');
  let val = await nameInput.inputValue();
  assert.strictEqual(val, 'Animal', `expected 'Animal' picked from library, got: ${val}`);

  // Rename it, then blur to trigger the re-render.
  await nameInput.fill('Unarmed');
  await page.click('#f-name'); // blur the ability name field
  await page.waitForTimeout(250);

  let renameNote = await page.textContent('.ability-rename-note');
  assert(renameNote.includes('Originally:') && renameNote.includes('Animal'), `expected rename note, got: ${renameNote}`);
  ok('Renaming "Animal" to "Unarmed" shows the "Originally: Animal" note');

  // Duplicate check should still catch it under its official name even
  // though it's been renamed on the card.
  await page.click('#open-ability-library');
  await page.fill('#library-search', 'Animal');
  await page.waitForTimeout(150);
  await page.click('.library-add-btn');
  await page.waitForTimeout(400);
  const addBtnTitle = await page.getAttribute('.library-add-btn', 'title');
  assert.strictEqual(addBtnTitle, 'Already on this card', `expected duplicate-block via baseName, got title: ${addBtnTitle}`);
  ok('Adding "Animal" again from the library is blocked by baseName even though it was renamed to "Unarmed"');
  await page.click('#close-ability-library');
  await page.waitForTimeout(100);

  // Reset link restores the official name.
  await page.click('.ability-reset-name');
  await page.waitForTimeout(150);
  nameInput = await page.$('.ability-item input[data-field="name"]');
  val = await nameInput.inputValue();
  assert.strictEqual(val, 'Animal', `expected reset to restore 'Animal', got: ${val}`);
  const noteCount = await page.$$eval('.ability-rename-note', els => els.length);
  assert.strictEqual(noteCount, 0, 'expected rename note to disappear after reset');
  ok('Reset link restores the official ability name and hides the rename note');

  console.log('\nAll verify11 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
