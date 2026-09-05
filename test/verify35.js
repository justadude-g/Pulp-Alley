// verify35.js — "no specific skill" stats: the dice-type dropdown for each
// of the 6 stats now offers 0 alongside 6/8/10/12, and setting a skill to
// 0 dice of 0 faces ("0 d 0" in the form) prints as "–d–" on the card
// instead of the literal "0d0", which would read as a data-entry mistake
// rather than a deliberate "this character has no rating here" mark.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8876;
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

  // ---- 1. Every stat's dice-type dropdown now offers "0" as an option,
  // alongside the original 6/8/10/12, without disturbing which of those
  // was already the default-selected one. ----
  const stats = ['brawl', 'might', 'shoot', 'finesse', 'dodge', 'cunning'];
  for (const key of stats) {
    const options = await page.$$eval(`.stat-row[data-stat="${key}"] select.stat-d option`, els => els.map(e => e.value));
    assert.deepStrictEqual(options, ['0', '6', '8', '10', '12'], `expected ${key}'s dice-type options to be [0,6,8,10,12], got ${JSON.stringify(options)}`);
  }
  ok('Every stat\'s dice-type dropdown now offers 0, alongside 6/8/10/12');
  const brawlDefault = await page.$eval('.stat-row[data-stat="brawl"] select.stat-d', el => el.value);
  const shootDefault = await page.$eval('.stat-row[data-stat="shoot"] select.stat-d', el => el.value);
  assert.strictEqual(brawlDefault, '8', `expected Brawl's default die-type to stay 8, got ${brawlDefault}`);
  assert.strictEqual(shootDefault, '10', `expected Shoot's default die-type to stay 10, got ${shootDefault}`);
  ok('Adding the 0 option didn\'t change any stat\'s existing default die-type selection');

  // ---- 2. Setting Brawl to 0 dice of 0 faces ("0 d 0") is reflected in
  // collectFormData(), and round-trips through save/reload. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.fill('#f-name', 'No-Brawl Character');
  await page.selectOption('.stat-row[data-stat="brawl"] select.stat-n', '0');
  await page.selectOption('.stat-row[data-stat="brawl"] select.stat-d', '0');
  await page.waitForTimeout(150);
  const brawlStat = await page.evaluate(() => collectFormData().stats.brawl);
  assert.deepStrictEqual(brawlStat, { n: 0, d: 0 }, `expected Brawl to collect as {n:0, d:0}, got ${JSON.stringify(brawlStat)}`);
  ok('Setting Brawl\'s number to 0 and its die-type to 0 collects as {n:0, d:0}');

  await page.click('#btn-save-card');
  await page.waitForTimeout(200);
  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("No-Brawl Character") [data-act="edit"]');
  await page.waitForTimeout(200);
  const reloadedN = await page.locator('.stat-row[data-stat="brawl"] select.stat-n').inputValue();
  const reloadedD = await page.locator('.stat-row[data-stat="brawl"] select.stat-d').inputValue();
  assert.strictEqual(reloadedN, '0', `expected the saved 0d0 Brawl to reload with number 0, got ${reloadedN}`);
  assert.strictEqual(reloadedD, '0', `expected the saved 0d0 Brawl to reload with die-type 0, got ${reloadedD}`);
  ok('A saved 0d0 stat persists and reloads correctly');

  // ---- 3. The card itself actually prints "–d–" for a 0d0 stat, not the
  // literal "0d0" — proven by rendering both candidate strings on an
  // offscreen canvas with the exact same font/position/color the app just
  // used, and comparing pixel-for-pixel against the live card (a baseline
  // comparison, not a guessed pixel width — single-scanline ink-width
  // fingerprinting has proven unreliable for this project before). ----
  await page.selectOption('#f-theme', 'ivory');
  await page.fill('#f-accentColor', '#ff0000');
  await page.waitForTimeout(150);

  const { diffFromDashD, diffFromZeroD } = await page.evaluate(() => {
    const liveCanvas = document.getElementById('card-canvas');
    const liveCtx = liveCanvas.getContext('2d');

    // Same STATS geometry as cardRenderer.js: {x:440, y:132, w:750-440, h:430}.
    const STATS_x = 440, STATS_y = 132, STATS_w = 750 - 440, STATS_h = 430;
    const rowH = STATS_h / 6;
    const ry = STATS_y; // Brawl is row 0
    const rectX = STATS_x + Math.floor(STATS_w / 2);
    const rectY = Math.floor(ry);
    const rectW = (STATS_x + STATS_w) - rectX;
    const rectH = Math.ceil(rowH);
    const liveData = liveCtx.getImageData(rectX, rectY, rectW, rectH);

    function buildReference(text) {
      const c = document.createElement('canvas');
      c.width = rectW; c.height = rectH;
      const ctx = c.getContext('2d');
      // Background: sample the live row's own tint near the rectangle's
      // left edge, clear of ink for any short right-aligned candidate string.
      const bg = liveCtx.getImageData(rectX + 2, rectY + 2, 1, 1).data;
      ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      ctx.fillRect(0, 0, rectW, rectH);
      ctx.font = '700 33px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff0000';
      const anchorX = (STATS_x + STATS_w - 20) - rectX;
      const anchorY = (ry + rowH / 2 + 1) - rectY;
      ctx.fillText(text, anchorX, anchorY);
      return ctx.getImageData(0, 0, rectW, rectH);
    }
    function diffScore(a, b) {
      let diff = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        diff += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      }
      return diff / (a.data.length / 4);
    }
    return {
      diffFromDashD: diffScore(liveData, buildReference('–d–')),
      diffFromZeroD: diffScore(liveData, buildReference('0d0')),
    };
  });
  // Two separate <canvas> elements rasterizing identical draw calls can
  // still differ by a few units per channel on anti-aliased glyph edges
  // (subpixel/hinting noise), so the match threshold allows a little of
  // that slack — while staying an order of magnitude below the "clearly
  // different string" case just below, which is the actual proof the
  // comparison discriminates rather than just always passing.
  assert(diffFromDashD < 10, `expected the live 0d0 Brawl row to pixel-match an offscreen "–d–" reference closely, got avg diff ${diffFromDashD.toFixed(2)}`);
  assert(diffFromZeroD > 15, `expected the live 0d0 Brawl row to clearly NOT match a literal "0d0" reference, got avg diff ${diffFromZeroD.toFixed(2)} (too close — the comparison isn't discriminating)`);
  ok(`A 0d0 stat prints as "–d–" on the card (matches reference, diff=${diffFromDashD.toFixed(2)}), not the literal "0d0" (diff=${diffFromZeroD.toFixed(2)})`);

  // ---- 4. A normal, non-zero stat still prints its ordinary "NdD" form
  // (sanity check that the 0d0 special-case didn't break everything else). ----
  await page.selectOption('.stat-row[data-stat="brawl"] select.stat-n', '3');
  await page.selectOption('.stat-row[data-stat="brawl"] select.stat-d', '10');
  await page.waitForTimeout(150);
  const normalDiff = await page.evaluate(() => {
    const liveCanvas = document.getElementById('card-canvas');
    const liveCtx = liveCanvas.getContext('2d');
    const STATS_x = 440, STATS_y = 132, STATS_w = 750 - 440, STATS_h = 430;
    const rowH = STATS_h / 6;
    const ry = STATS_y;
    const rectX = STATS_x + Math.floor(STATS_w / 2);
    const rectY = Math.floor(ry);
    const rectW = (STATS_x + STATS_w) - rectX;
    const rectH = Math.ceil(rowH);
    const liveData = liveCtx.getImageData(rectX, rectY, rectW, rectH);
    const c = document.createElement('canvas');
    c.width = rectW; c.height = rectH;
    const ctx = c.getContext('2d');
    const bg = liveCtx.getImageData(rectX + 2, rectY + 2, 1, 1).data;
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    ctx.fillRect(0, 0, rectW, rectH);
    ctx.font = '700 33px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff0000';
    ctx.fillText('3d10', (STATS_x + STATS_w - 20) - rectX, (ry + rowH / 2 + 1) - rectY);
    const refData = ctx.getImageData(0, 0, rectW, rectH);
    let diff = 0;
    for (let i = 0; i < liveData.data.length; i += 4) {
      diff += Math.abs(liveData.data[i] - refData.data[i]) + Math.abs(liveData.data[i + 1] - refData.data[i + 1]) + Math.abs(liveData.data[i + 2] - refData.data[i + 2]);
    }
    return diff / (liveData.data.length / 4);
  });
  assert(normalDiff < 10, `expected a normal 3d10 Brawl to still print "3d10" as before, got avg diff ${normalDiff.toFixed(2)}`);
  ok('A normal, non-zero stat (3d10) still prints its ordinary form, unaffected by the 0d0 special case');

  console.log('\nAll verify35 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
