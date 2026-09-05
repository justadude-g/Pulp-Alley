// verify21.js — Stats now auto-fill immediately when Card Type changes
// (Leader/Sidekick/Ally/Follower), matching how Level/Health/Accent Color
// already auto-fill, instead of requiring a separate "Reset to Card Type"
// click. Gang keeps its own model-based auto-fill; Villain/Creature/Custom
// still have no default (nothing to apply). The Reset Stats button still
// works too, for snapping back after a hand-edit without reselecting type.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8853;
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

  async function readStats() {
    return page.evaluate(() => {
      const out = {};
      document.querySelectorAll('.stat-row').forEach(row => {
        const key = row.dataset.stat;
        out[key] = { n: +row.querySelector('select.stat-n').value, d: +row.querySelector('select.stat-d').value };
      });
      return out;
    });
  }

  // ---- 1. Picking Leader auto-fills its p.9 allocation with no extra click ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  let stats = await readStats();
  for (const key of ['brawl', 'shoot', 'might', 'finesse']) {
    assert.deepStrictEqual(stats[key], { n: 3, d: 10 }, `expected Leader's ${key} to auto-fill to 3d10, got ${JSON.stringify(stats[key])}`);
  }
  for (const key of ['dodge', 'cunning']) {
    assert.deepStrictEqual(stats[key], { n: 2, d: 8 }, `expected Leader's ${key} to auto-fill to 2d8, got ${JSON.stringify(stats[key])}`);
  }
  ok('Selecting Leader auto-fills 4x3d10 + 2x2d8 immediately, no button click needed');

  // ---- 2. Switching straight to Sidekick re-fills without a click too ----
  await page.selectOption('#f-cardType', 'Sidekick');
  await page.waitForTimeout(150);
  stats = await readStats();
  for (const key of ['brawl', 'shoot', 'might']) {
    assert.deepStrictEqual(stats[key], { n: 3, d: 8 }, `expected Sidekick's ${key} to auto-fill to 3d8, got ${JSON.stringify(stats[key])}`);
  }
  for (const key of ['dodge', 'cunning', 'finesse']) {
    assert.deepStrictEqual(stats[key], { n: 2, d: 6 }, `expected Sidekick's ${key} to auto-fill to 2d6, got ${JSON.stringify(stats[key])}`);
  }
  ok('Switching Card Type again re-fills Stats to the new type\'s allocation automatically');

  // ---- 3. Villain/Creature/Custom have no default: switching to Villain
  // after hand-editing a stat leaves the hand-edit alone (nothing to apply). ----
  await page.selectOption('.stat-row[data-stat="brawl"] select.stat-n', '5');
  await page.selectOption('#f-cardType', 'Villain');
  await page.waitForTimeout(150);
  stats = await readStats();
  assert.strictEqual(stats.brawl.n, 5, 'expected a hand-edited stat to survive switching to a type with no rulebook default (Villain)');
  ok('Switching to Villain/Creature/Custom does not touch Stats (no rulebook default to apply)');

  // ---- 4. Gang still uses its own model-based auto-fill, not defaultStats ----
  await page.selectOption('#f-cardType', 'Gang');
  await page.waitForTimeout(150);
  stats = await readStats();
  // 5 models (the default) -> Brawl/Shoot/Might = 1d6 per 2 models (rounded
  // up) = 3d6; Dodge/Cunning/Finesse fixed at 1d6 (p. 21).
  for (const key of ['brawl', 'shoot', 'might']) {
    assert.deepStrictEqual(stats[key], { n: 3, d: 6 }, `expected Gang's ${key} to auto-fill from model count, got ${JSON.stringify(stats[key])}`);
  }
  for (const key of ['dodge', 'cunning', 'finesse']) {
    assert.deepStrictEqual(stats[key], { n: 1, d: 6 }, `expected Gang's ${key} fixed at 1d6, got ${JSON.stringify(stats[key])}`);
  }
  ok('Gang keeps its own model-count-based auto-fill on Card Type change');

  // ---- 5. Reset Stats button still works for snapping back after a
  // hand-edit, without needing to reselect Card Type. ----
  await page.selectOption('#f-cardType', 'Follower');
  await page.waitForTimeout(150);
  await page.selectOption('.stat-row[data-stat="shoot"] select.stat-n', '5');
  await page.click('#reset-stats');
  await page.waitForTimeout(150);
  stats = await readStats();
  assert.deepStrictEqual(stats.shoot, { n: 1, d: 6 }, 'expected Reset Stats to still snap a hand-edited stat back to the Follower default');
  ok('Reset Stats button still works for reverting a hand-edit without reselecting Card Type');

  // ---- 6. "New Card" also starts from Leader's real default allocation,
  // not the form's old static placeholder numbers. ----
  await page.fill('#f-name', 'Temp');
  await page.click('#btn-new-card');
  await page.waitForTimeout(150);
  const cardTypeAfterNew = await page.$eval('#f-cardType', el => el.value);
  assert.strictEqual(cardTypeAfterNew, 'Leader', 'expected New Card to reset Card Type to Leader');
  stats = await readStats();
  for (const key of ['brawl', 'shoot', 'might', 'finesse']) {
    assert.deepStrictEqual(stats[key], { n: 3, d: 10 }, `expected New Card's ${key} to be Leader's real default 3d10, got ${JSON.stringify(stats[key])}`);
  }
  ok('New Card starts Stats from Leader\'s real p.9 default, not stale placeholder numbers');

  console.log('\nAll verify21 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
