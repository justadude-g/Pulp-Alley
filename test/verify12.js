// verify12.js — Associates (Core Rules p. 27-28): add/remove, ability
// picking, slot cost, cap warning, duplicate-ability warnings (within one
// Associate and across the roster), and save/reload persistence.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8830;
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

  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);

  // ---- 1. Empty state ----
  let emptyVisible = await page.isVisible('#roster-associates-empty');
  assert.strictEqual(emptyVisible, true, 'expected empty-state hint before any Associate is added');
  ok('Associates column shows empty state initially');

  // ---- 2. Add an Associate, set name + 2 abilities, check slot cost ----
  await page.click('#add-associate');
  await page.waitForTimeout(150);
  let items = await page.$$('.associate-item');
  assert.strictEqual(items.length, 1, 'expected 1 associate item after clicking Add Associate');

  await page.fill('.associate-name-input', 'The Butler');
  await page.selectOption('.associate-ability-select[data-slot="0"]', 'Got Your Back');
  await page.selectOption('.associate-ability-select[data-slot="1"]', 'In the Know');
  await page.waitForTimeout(150);

  let slotLabel = await page.textContent('#slot-meter-label');
  assert(slotLabel.includes('1 / 10'), `expected 1 slot used for 1 Associate, got: ${slotLabel}`);
  ok('Adding 1 Associate costs 1 roster slot');

  let abilityTexts = await page.$$eval('.associate-ability-text', els => els.map(e => e.textContent));
  assert(abilityTexts.some(t => t.includes('Backup point')), `expected Got Your Back's text to show, got: ${JSON.stringify(abilityTexts)}`);
  assert(abilityTexts.some(t => t.includes('Tips point')), `expected In the Know's text to show, got: ${JSON.stringify(abilityTexts)}`);
  ok('Picking an ability shows its rules text underneath');

  // ---- 3. Same ability twice on one Associate -> warning ----
  await page.selectOption('.associate-ability-select[data-slot="1"]', 'Got Your Back');
  await page.waitForTimeout(150);
  let warnings = await page.textContent('#associate-warnings');
  assert(warnings.includes('picked twice'), `expected same-ability-twice warning, got: ${warnings}`);
  ok('Picking the same ability twice on one Associate triggers a warning');

  // fix it back to 2 different abilities
  await page.selectOption('.associate-ability-select[data-slot="1"]', 'In the Know');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#associate-warnings');
  assert(!warnings.includes('picked twice'), `expected warning to clear, got: ${warnings}`);
  ok('Warning clears once the two abilities differ again');

  // ---- 4. Same ability used by two different Associates -> warning ----
  // Note: selects are targeted fresh by their data-idx/data-slot attributes
  // (not cached element handles) — each selectOption() triggers a full
  // renderRosterWorkspace() re-render, which would detach a stale handle.
  await page.click('#add-associate');
  await page.waitForTimeout(150);
  items = await page.$$('.associate-item');
  assert.strictEqual(items.length, 2, 'expected 2 associate items');
  await page.selectOption('.associate-ability-select[data-idx="1"][data-slot="0"]', 'Got Your Back'); // duplicate of Associate 1's pick
  await page.waitForTimeout(150);
  await page.selectOption('.associate-ability-select[data-idx="1"][data-slot="1"]', 'Tinker');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#associate-warnings');
  assert(warnings.includes("can't take the same Associate Ability more than once"), `expected cross-associate duplicate warning, got: ${warnings}`);
  ok('Using the same Associate Ability on 2 different Associates triggers a warning');

  slotLabel = await page.textContent('#slot-meter-label');
  assert(slotLabel.includes('2 / 10'), `expected 2 slots used for 2 Associates, got: ${slotLabel}`);
  ok('2 Associates cost 2 roster slots total');

  // ---- 5. Cap warning at 3 Associates ----
  await page.click('#add-associate');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#associate-warnings');
  assert(warnings.includes('at most 2 Associates'), `expected cap warning at 3 associates, got: ${warnings}`);
  ok('Adding a 3rd Associate triggers the "at most 2" cap warning');

  // remove the 3rd one to get back to a clean 2-associate roster
  const removeButtons = await page.$$('.associate-remove');
  await removeButtons[2].click();
  await page.waitForTimeout(150);
  items = await page.$$('.associate-item');
  assert.strictEqual(items.length, 2, 'expected back to 2 associate items after removing the 3rd');
  ok('Removing an Associate works and updates the count');

  // fix the cross-duplicate so we save a clean roster
  await page.selectOption('.associate-ability-select[data-idx="1"][data-slot="0"]', 'Fortune’s Favor');
  await page.waitForTimeout(150);
  warnings = await page.textContent('#associate-warnings');
  assert.strictEqual(warnings.trim(), '', `expected no warnings on a clean 2-associate roster, got: ${warnings}`);
  ok('No warnings once both Associates have 2 distinct, non-overlapping abilities');

  // ---- 6. Save + reload persistence ----
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
  const names = await page.$$eval('.associate-name-input', els => els.map(e => e.value));
  assert.deepStrictEqual(names, ['The Butler', ''], `expected persisted associate names, got: ${JSON.stringify(names)}`);
  slotLabel = await page.textContent('#slot-meter-label');
  assert(slotLabel.includes('2 / 10'), `expected 2 slots used after reload, got: ${slotLabel}`);
  ok('Associates persist correctly through save + reload');

  console.log('\nAll verify12 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
