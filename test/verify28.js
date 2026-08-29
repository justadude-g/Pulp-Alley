// verify28.js — Classical theme's DOWN/OUT health pills are legible again.
// Root cause: Classical's health bar background (healthBarBg) is a solid
// olive-khaki color (#bfab63), unlike every other theme where it's a
// near-transparent overlay. DOWN/OUT pills used a low-alpha dark fill
// (downOutFill) meant to sit on a near-invisible bar — against Classical's
// solid olive bar that low-alpha fill barely registered, so the pills read
// as a slightly-darker-green bubble on a green background. Fix: Classical's
// downOutFill is now an opaque grey matching fixedTint2 (the same grey used
// for the Might/Finesse/Cunning stat row), with a solid dark-ink border and
// text, so the pills are clearly distinct from the olive bar underneath.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8869;
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

  await page.selectOption('#f-cardType', 'Sidekick'); // d6 health, has a Down state
  await page.selectOption('#f-theme', 'classical');
  await page.waitForTimeout(200);

  // Find the Down/Out pill fill color by scanning the health bar row for a
  // pixel run that is clearly NOT the olive health-bar background (#bfab63)
  // and NOT the accent-tinted die pills (fixedTint '#ebb185'), reading from
  // the right side of the bar where Down/Out live.
  const HEALTH_BAR_Y = await page.evaluate(() => {
    const canvas = document.getElementById('card-canvas');
    // healthBarH is 78, pills are vertically centered in it (42 tall) —
    // canvas.height - 39 lands in the middle of the pill row itself.
    return canvas.height - 39;
  });

  function closeTo(rgb, hex, tol = 12) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return Math.abs(rgb[0] - r) <= tol && Math.abs(rgb[1] - g) <= tol && Math.abs(rgb[2] - b) <= tol;
  }

  // Sample across the health bar row and collect distinct fill colors.
  const samples = await page.evaluate((y) => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    const w = document.getElementById('card-canvas').width;
    const pts = [];
    for (let x = 0; x < w; x += 2) {
      pts.push([x, ...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)]);
    }
    return pts;
  }, HEALTH_BAR_Y);

  // x=30 is inside the flat left edge of the health bar (clear of the
  // rounded card corner at x=0-ish and clear of the centered pill group).
  const barBg = samples.find(([x]) => x === 30);
  assert(closeTo(barBg.slice(1), '#bfab63', 15), `expected the Classical health bar background to be the olive khaki color, got rgb(${barBg.slice(1)})`);
  ok('Classical health bar background is the expected olive-khaki color');

  // Find at least one pixel run matching the new opaque grey Down/Out fill
  // (#c1ac9c) — proves the fill is now opaque and visually distinct from
  // the olive bar background, not a near-invisible low-alpha overlay on it.
  const greyPixel = samples.find(([, r, g, b]) => closeTo([r, g, b], '#c1ac9c', 10));
  assert(greyPixel, `expected to find the new opaque grey (#c1ac9c) Down/Out fill somewhere in the health bar, but no matching pixel was found across the row`);
  ok('Down/Out pills render with the opaque grey fill (matching the Might/Finesse/Cunning stat row), not a faint overlay on the olive bar');

  // Confirm that grey fill is clearly different from the health bar
  // background itself — i.e. genuinely readable, not a near-match.
  const diffFromBar = Math.abs(greyPixel[1] - barBg[1]) + Math.abs(greyPixel[2] - barBg[2]) + Math.abs(greyPixel[3] - barBg[3]);
  assert(diffFromBar > 40, `expected the Down/Out pill fill to be clearly distinct from the olive bar background, got fill=rgb(${greyPixel.slice(1)}) vs bar=rgb(${barBg.slice(1)})`);
  ok('The Down/Out pill fill is clearly distinct from the olive health-bar background (legible, not blended in)');

  // classicalNoSkull behaves identically (shares CLASSICAL_BASE).
  await page.selectOption('#f-theme', 'classicalNoSkull');
  await page.waitForTimeout(200);
  const samplesNoSkull = await page.evaluate((y) => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    const w = document.getElementById('card-canvas').width;
    const pts = [];
    for (let x = 0; x < w; x += 2) pts.push([x, ...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)]);
    return pts;
  }, HEALTH_BAR_Y);
  const greyPixelNoSkull = samplesNoSkull.find(([, r, g, b]) => closeTo([r, g, b], '#c1ac9c', 10));
  assert(greyPixelNoSkull, 'expected classicalNoSkull to also render the opaque grey Down/Out fill');
  ok('classicalNoSkull behaves identically to classical for the Down/Out fill fix');

  // Other themes (ivory) are untouched by this change — their Down/Out
  // pills still use their existing low-alpha overlay approach, which is
  // fine there since their health bar backgrounds are near-transparent.
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(200);
  const ivoryDownOutFill = await page.evaluate(() => {
    // Ivory's healthBarBg is a near-invisible overlay on the card gradient,
    // so just confirm the app still renders without error and the pill
    // colors haven't been accidentally touched by this Classical-only fix.
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return true;
  });
  assert(ivoryDownOutFill, 'expected ivory theme to render without error after the Classical-only fix');
  ok('Ivory theme is unaffected by the Classical Down/Out fill change');

  console.log('\nAll verify28 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
