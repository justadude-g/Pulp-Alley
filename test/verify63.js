// verify63.js — Stats-editing grid column order matches the printed card's
// grouping. The printed card (cardRenderer.js) lists stats in a single
// column, split into two colour-banded groups: Brawl/Shoot/Dodge, then
// Might/Finesse/Cunning. The Stats-editing grid (#stats-fieldset, a 2-column
// CSS grid) used to pair them by DOM order (Brawl/Shoot/Dodge/Might/Finesse/
// Cunning) which — with the grid's default row-major auto-flow — put Brawl
// and Shoot in column 1 but Dodge in column 2, splitting the printed card's
// first group across both editing columns. Reordered the DOM to Brawl,
// Might, Shoot, Finesse, Dodge, Cunning so column 1 reads Brawl/Shoot/Dodge
// top-to-bottom and column 2 reads Might/Finesse/Cunning top-to-bottom,
// congruent with the card.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8886;
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

  const boxes = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.stat-row'));
    return rows.map(r => {
      const b = r.getBoundingClientRect();
      return { stat: r.dataset.stat, x: Math.round(b.x), y: Math.round(b.y) };
    });
  });
  assert.strictEqual(boxes.length, 6, `expected 6 .stat-row elements, got ${boxes.length}`);

  const xs = [...new Set(boxes.map(b => b.x))].sort((a, b) => a - b);
  assert.strictEqual(xs.length, 2, `expected exactly 2 distinct x-positions (2 columns), got ${xs.length}`);

  const leftCol = boxes.filter(b => b.x === xs[0]).sort((a, b) => a.y - b.y).map(b => b.stat);
  const rightCol = boxes.filter(b => b.x === xs[1]).sort((a, b) => a.y - b.y).map(b => b.stat);

  assert.deepStrictEqual(leftCol, ['brawl', 'shoot', 'dodge'],
    `expected the left column to read Brawl/Shoot/Dodge top-to-bottom (matching the printed card's first group), got ${leftCol.join(', ')}`);
  assert.deepStrictEqual(rightCol, ['might', 'finesse', 'cunning'],
    `expected the right column to read Might/Finesse/Cunning top-to-bottom (matching the printed card's second group), got ${rightCol.join(', ')}`);
  ok('Stats-editing grid columns match the printed card\'s Brawl/Shoot/Dodge and Might/Finesse/Cunning grouping');

  // Sanity check: collectStats()/loadCard() are keyed by data-stat, not DOM
  // position, so the reorder shouldn't affect actual stat values. Confirm a
  // stat can still be edited and read back correctly by its key.
  await page.selectOption('.stat-row[data-stat="dodge"] select.stat-n', '5');
  await page.selectOption('.stat-row[data-stat="dodge"] select.stat-d', '12');
  const dodgeValue = await page.evaluate(() => {
    const row = document.querySelector('.stat-row[data-stat="dodge"]');
    return { n: row.querySelector('select.stat-n').value, d: row.querySelector('select.stat-d').value };
  });
  assert.strictEqual(dodgeValue.n, '5');
  assert.strictEqual(dodgeValue.d, '12');
  ok('Editing a stat by its data-stat key still works correctly after the DOM reorder');

  console.log('\nAll verify63 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
