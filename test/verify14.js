// verify14.js — "Reset to Card Type" stats button, and the Follower
// Health track no longer showing a "Down" state (d6* skips straight to
// Out on a failed Health check, per the rulebook's asterisk note).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8834;
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
    const stats = {};
    for (const row of await page.$$('.stat-row')) {
      const key = await row.getAttribute('data-stat');
      const n = await row.$eval('select.stat-n', el => el.value);
      const d = await row.$eval('select.stat-d', el => el.value);
      stats[key] = { n: +n, d: +d };
    }
    return stats;
  }

  // ---- 1. Reset button visible for Leader, hides for Villain ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(100);
  let btnVisible = await page.isVisible('#reset-stats');
  assert.strictEqual(btnVisible, true, 'expected Reset to Card Type button visible for Leader');
  ok('Reset button shows for Leader');

  await page.selectOption('#f-cardType', 'Villain');
  await page.waitForTimeout(100);
  btnVisible = await page.isVisible('#reset-stats');
  assert.strictEqual(btnVisible, false, 'expected Reset button hidden for Villain (no rulebook default)');
  ok('Reset button hides for Villain (no defaultStats)');

  await page.selectOption('#f-cardType', 'Gang');
  await page.waitForTimeout(100);
  btnVisible = await page.isVisible('#reset-stats');
  assert.strictEqual(btnVisible, false, 'expected Reset button hidden for Gang (has its own model-based auto-fill)');
  ok('Reset button hides for Gang');

  // ---- 2. Clicking Reset applies the Leader default and is a valid budget ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(100);
  // hand-edit a stat first so we can prove reset actually overwrites it
  await page.selectOption('.stat-row[data-stat="brawl"] select.stat-n', '5');
  await page.click('#reset-stats');
  await page.waitForTimeout(150);
  let stats = await readStats();
  // Leader (p.9): 4 skills @ 3d10, 2 skills @ 2d8
  const highCount = Object.values(stats).filter(s => s.n === 3 && s.d === 10).length;
  const lowCount = Object.values(stats).filter(s => s.n === 2 && s.d === 8).length;
  assert.strictEqual(highCount, 4, `expected 4 skills at 3d10 for Leader, got ${highCount}: ${JSON.stringify(stats)}`);
  assert.strictEqual(lowCount, 2, `expected 2 skills at 2d8 for Leader, got ${lowCount}: ${JSON.stringify(stats)}`);
  ok('Reset to Card Type applies a valid Leader allocation (4x3d10 + 2x2d8)');

  // ---- 3. Sidekick / Ally / Follower budgets ----
  await page.selectOption('#f-cardType', 'Sidekick');
  await page.click('#reset-stats');
  await page.waitForTimeout(150);
  stats = await readStats();
  assert.strictEqual(Object.values(stats).filter(s => s.n === 3 && s.d === 8).length, 3, `Sidekick high tier wrong: ${JSON.stringify(stats)}`);
  assert.strictEqual(Object.values(stats).filter(s => s.n === 2 && s.d === 6).length, 3, `Sidekick low tier wrong: ${JSON.stringify(stats)}`);
  ok('Reset applies a valid Sidekick allocation (3x3d8 + 3x2d6)');

  await page.selectOption('#f-cardType', 'Ally');
  await page.click('#reset-stats');
  await page.waitForTimeout(150);
  stats = await readStats();
  assert.strictEqual(Object.values(stats).filter(s => s.n === 2 && s.d === 6).length, 2, `Ally high tier wrong: ${JSON.stringify(stats)}`);
  assert.strictEqual(Object.values(stats).filter(s => s.n === 1 && s.d === 6).length, 4, `Ally low tier wrong: ${JSON.stringify(stats)}`);
  ok('Reset applies a valid Ally allocation (2x2d6 + 4x1d6)');

  await page.selectOption('#f-cardType', 'Follower');
  await page.click('#reset-stats');
  await page.waitForTimeout(150);
  stats = await readStats();
  assert.strictEqual(Object.values(stats).filter(s => s.n === 1 && s.d === 6).length, 6, `Follower stats wrong: ${JSON.stringify(stats)}`);
  ok('Reset applies a valid Follower allocation (all 6 at 1d6)');

  // ---- 4. Follower Health track: no "Down" state, just d6* -> Out ----
  let healthPreview = await page.textContent('#health-preview');
  assert(healthPreview.includes('d6*'), `expected d6* in Follower health preview, got: ${healthPreview}`);
  assert(!healthPreview.includes('→ Down →'), `expected no Down step in the Follower health track, got: ${healthPreview}`);
  assert(healthPreview.includes('Out'), `expected Out in Follower health preview, got: ${healthPreview}`);
  ok('Follower Health preview text shows d6* -> Out with no Down state');

  const pillLabels = await page.evaluate(() => {
    // Re-derive the same pill list the renderer builds, by calling the
    // exported helpers directly against the current form state.
    const seq = healthSequenceFrom(document.getElementById('f-healthStart').value);
    const asterisk = document.getElementById('f-healthAsterisk').checked;
    return asterisk ? [...seq, 'Out'] : [...seq, 'Down', 'Out'];
  });
  assert.deepStrictEqual(pillLabels, ['d6', 'Out'], `expected Follower health pills to be [d6, Out] with no Down, got: ${JSON.stringify(pillLabels)}`);
  ok('Follower health bar pill sequence has no Down state (matches asterisk rule)');

  // Sanity: a non-asterisk type still keeps the Down state.
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(100);
  healthPreview = await page.textContent('#health-preview');
  assert(healthPreview.includes('→ Down →'), `expected Leader health preview to still include a Down step, got: ${healthPreview}`);
  ok('Non-asterisk Card Types (e.g. Leader) still show a Down state');

  console.log('\nAll verify14 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
