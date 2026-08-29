// verify15.js — three design fixes:
// 1. Light theme no longer draws the top-right corner accent lines.
// 2. Classical has a "no skull" theme variant alongside the original.
// 3. A transparent-background PNG portrait blends with the card's accent
//    tint instead of flattening to solid black.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8836;
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

  // ---- 1. Light theme: no corner accent lines ----
  // Sample along the diagonal the old code drew (from (CARD_W-10,0) to
  // (CARD_W,10), etc.) — with cornerAccentAlpha:0 these pixels should just
  // be the plain white/near-white card background, not an accent-tinted line.
  await page.selectOption('#f-theme', 'light');
  await page.waitForTimeout(150);
  // Scan the sliver of card above the top-right "LEADER" type-tag pill
  // (pill starts at y=18) and left of the rounded-corner arc (arc center
  // is at x=716, so x<=716 is the flat, unclipped top edge) — exactly
  // where the 3 removed diagonal accent lines used to be visible peeking
  // out from behind the pill, per the reported screenshot. Without the
  // lines this patch is just the flat background: every sampled pixel in
  // a row should match regardless of x (a real diagonal line would instead
  // show a darker/accent-tinted streak moving across x as y grows).
  const rows = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const xs = [695, 700, 705, 710, 715];
    const ys = [5, 8, 11, 14];
    return ys.map(y => xs.map(x => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)]));
  });
  let maxSpread = 0;
  for (const row of rows) {
    for (let c = 0; c < 3; c++) {
      const vals = row.map(px => px[c]);
      maxSpread = Math.max(maxSpread, Math.max(...vals) - Math.min(...vals));
    }
  }
  assert(maxSpread <= 8, `expected a flat background with no diagonal line (row-wise color spread should be tiny), got max spread ${maxSpread} across rows: ${JSON.stringify(rows)}`);
  ok('Light theme top-right corner has no accent lines (flat background, no diagonal streak)');

  // ---- 2. Classical "no skull" variant exists and actually differs ----
  const themeOptions = await page.$$eval('#f-theme option', els => els.map(e => e.value));
  assert(themeOptions.includes('classical'), 'expected a "classical" theme option');
  assert(themeOptions.includes('classicalNoSkull'), 'expected a "classicalNoSkull" theme option');
  ok('Card Background dropdown offers both Classical variants');

  await page.selectOption('#f-theme', 'classical');
  await page.waitForTimeout(150);
  const withSkullUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));

  await page.selectOption('#f-theme', 'classicalNoSkull');
  await page.waitForTimeout(150);
  const noSkullUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));

  assert.notStrictEqual(withSkullUrl, noSkullUrl, 'expected classical and classicalNoSkull to render differently (skull watermark toggle)');
  ok('classical and classicalNoSkull render visibly different cards (skull watermark on/off)');

  // Everything else about the two variants should match: same accent-tint
  // math etc. Spot-check a stat-row pixel (unaffected by the skull, which
  // only appears in the ability panel) is identical between the two.
  const statPixelSame = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    return ctx.getImageData(60, 250, 1, 1).data;
  });
  await page.selectOption('#f-theme', 'classical');
  await page.waitForTimeout(150);
  const statPixelWithSkull = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    return [...ctx.getImageData(60, 250, 1, 1).data];
  });
  assert.deepStrictEqual([...statPixelSame], statPixelWithSkull, 'expected the two Classical variants to share the same palette outside the skull watermark');
  ok('Both Classical variants share the identical parchment palette elsewhere on the card');

  // ---- 3. Transparent PNG portrait blends with the accent tint ----
  // This tinted-fill-behind-transparency look is now specifically the
  // Image Frame ON behavior (added later — see verify24.js), since Image
  // Frame defaults OFF and off blends into the card's own background
  // instead. Turn it on here to keep exercising the original behavior.
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'light');
  await page.check('#f-portrait-frame');
  await page.waitForTimeout(150);
  const fixture = path.join(__dirname, 'fixture-transparent.png');
  await page.setInputFiles('#f-portrait', fixture);
  await page.waitForTimeout(500);

  const portraitCornerPixel = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    // PORTRAIT box is {x:24, y:132, w:300, h:430} — sample near its top-left
    // corner, which the circular fixture image leaves transparent.
    const d = ctx.getImageData(30, 140, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  assert(!(portraitCornerPixel[0] < 20 && portraitCornerPixel[1] < 20 && portraitCornerPixel[2] < 20),
    `expected the transparent portrait corner to NOT be solid black, got rgb(${portraitCornerPixel})`);
  ok('Transparent portrait corner is not flattened to solid black');

  // It should specifically match the card's accent tint, not the neutral
  // gray placeholder color used for the empty "UPLOAD IMAGE" box.
  const accentColorHex = await page.inputValue('#f-accentColor');
  const expectedTint = await page.evaluate((hex) => {
    // Replicates hexToRgba(accent, T.tintAlpha) for the light theme (tintAlpha 0.11)
    // composited over white, since that's what the canvas actually shows.
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    const a = 0.11;
    return [Math.round(r * a + 255 * (1 - a)), Math.round(g * a + 255 * (1 - a)), Math.round(b * a + 255 * (1 - a))];
  }, accentColorHex);
  const closeEnough = portraitCornerPixel.every((v, i) => Math.abs(v - expectedTint[i]) <= 3);
  assert(closeEnough, `expected portrait corner rgb(${portraitCornerPixel}) to match accent tint rgb(${expectedTint})`);
  ok('Transparent portrait corner blends with the card\'s accent tint color');

  // Sanity: the opaque red circle in the middle of the fixture still renders normally.
  const centerPixel = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(24 + 150, 132 + 215, 1, 1).data; // approx portrait box center
    return [d[0], d[1], d[2]];
  });
  assert(centerPixel[0] > 150 && centerPixel[1] < 150, `expected reddish center pixel, got rgb(${centerPixel})`);
  ok('The opaque part of the uploaded portrait still renders correctly');

  console.log('\nAll verify15 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
