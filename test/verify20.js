// verify20.js — Ivory theme: warm off-white, its own Card Background
// option alongside pure-white Light. (Ivory was originally made the app's
// default when it was added; a later change made Classical no-skull the
// default instead — see verify30.js — so this file now selects Ivory
// explicitly rather than asserting it's what a fresh page starts with.)
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8851;
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

  // ---- 1. Ivory is still selectable, but Classical (no skull) is now the
  // default (a later change moved the default to Classical and dropped
  // Dark from the dropdown — see verify30.js for that). ----
  const themeOptions = await page.$$eval('#f-theme option', els => els.map(e => e.value));
  assert(themeOptions.includes('ivory'), 'expected an "ivory" option');
  assert(themeOptions.includes('light'), 'expected "light" (pure white) to still be a separate option');
  ok('Both Ivory and Light (pure white) are available as separate Card Background options');

  // ---- 2. Ivory actually renders warm off-white, not pure white ----
  // Sample a background pixel away from any UI element (name bar, portrait,
  // stats, health bar) — top-right sliver below the border, left of the
  // rounded corner, same spot used in verify15's corner-lines check.
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(150);
  const ivoryPixel = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    return [...ctx.getImageData(700, 8, 1, 1).data.slice(0, 3)];
  });
  assert(!(ivoryPixel[0] === 255 && ivoryPixel[1] === 255 && ivoryPixel[2] === 255),
    `expected Ivory's background to not be pure white, got rgb(${ivoryPixel})`);
  // Warm off-white: red channel should be highest, blue lowest (a warm tint).
  assert(ivoryPixel[0] >= ivoryPixel[1] && ivoryPixel[1] >= ivoryPixel[2],
    `expected a warm tint (R >= G >= B), got rgb(${ivoryPixel})`);
  ok('Ivory renders a warm off-white background, not pure white');

  // Switching to Light still gives pure white in that same spot.
  await page.selectOption('#f-theme', 'light');
  await page.waitForTimeout(150);
  const lightPixel = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    return [...ctx.getImageData(700, 8, 1, 1).data.slice(0, 3)];
  });
  // Light's background is a top-to-bottom gradient from #ffffff to #fbfbfa,
  // so near the top it's not exactly [255,255,255] — just very close to
  // neutral white, and clearly cooler/lighter than Ivory's warm tint.
  assert(lightPixel.every(v => v >= 249), `expected Light to still render near-pure white, got rgb(${lightPixel})`);
  assert(lightPixel[0] - lightPixel[2] <= 1, `expected Light to be neutral (no warm tint), got rgb(${lightPixel})`);
  ok('Light (pure white) is unchanged and still selectable');

  // ---- 3. Ivory keeps the same clean-corners fix as Light (no accent lines) ----
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(150);
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
  assert(maxSpread <= 8, `expected Ivory's top-right corner to have no diagonal accent line, got max spread ${maxSpread}`);
  ok('Ivory has clean corners too (no accent lines)');

  // ---- 4. Saving a card with Ivory explicitly chosen persists as Ivory,
  // and loading it back keeps Ivory (Ivory is no longer the app's default
  // background — Classical no-skull is — so this now sets it explicitly
  // rather than relying on a fresh page's default). ----
  await page.selectOption('#f-cardType', 'Leader');
  // Fresh reload to get a truly untouched default state.
  await page.reload();
  await page.waitForTimeout(400);
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(150);
  await page.fill('#f-name', 'Ivory Default Test');
  await page.click('#btn-save-card');
  await page.waitForTimeout(300);
  await page.click('#btn-new-card');
  await page.waitForTimeout(150);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Ivory Default Test") [data-act="edit"]');
  await page.waitForTimeout(300);
  const reloadedTheme = await page.$eval('#f-theme', el => el.value);
  assert.strictEqual(reloadedTheme, 'ivory', `expected the saved card to keep Ivory as its theme, got: ${reloadedTheme}`);
  ok('A card saved with Ivory chosen persists and reloads as Ivory');

  console.log('\nAll verify20 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
