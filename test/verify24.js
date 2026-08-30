// verify24.js — Image Frame: the border around the portrait becomes
// optional, off by default. Off gives the portrait the full box and lets
// a transparent-background PNG blend into the card's own background
// instead of sitting in a visibly tinted box; on reproduces the original
// look exactly (tinted fill behind transparency + accent border).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8862;
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

  // ---- 1. Off by default on a fresh page load ----
  const defaultChecked = await page.$eval('#f-portrait-frame', el => el.checked);
  assert.strictEqual(defaultChecked, false, 'expected Image Frame to be OFF by default');
  ok('Image Frame is off by default on a fresh page load');

  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'light');
  await page.waitForTimeout(150);

  // The portrait box currently runs {x:28, y:132, w:412, h:430} — its left
  // edge lines up with the Abilities text margin (not the card's literal
  // edge) and its right edge stays flush to the Stats table (x:440), so
  // there's no open background margin beside it, only above and below (the
  // card's vertical gradient means a comparison pixel must share the same
  // y as its subject, since color only varies with y).
  async function borderPixel() {
    // Just above the portrait box's flat top edge, horizontally centered
    // so it's away from the rounded corners. Never touched by the
    // portrait's own clipped fill/image — only a stroke drawn with Image
    // Frame on would paint here.
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(234, 131, 1, 1).data.slice(0, 3)];
    });
  }
  async function plainBackgroundPixel() {
    // Same y as the border sample (so it's the same point on the vertical
    // gradient), far to the right where nothing else is drawn.
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(700, 131, 1, 1).data.slice(0, 3)];
    });
  }
  // Leader's fixed accent color (TYPE_PRESETS.Leader.accent in
  // cardRenderer.js — a punchy Gamegenic Prime "Orange") — used as the
  // expected border color rather than sampling another spot on the card,
  // so this doesn't depend on guessing which other pixels happen to be
  // pure accent color.
  const LEADER_ACCENT_RGB = [0xf6, 0x93, 0x0a];

  // ---- 2. No image yet, Image Frame off: no border stroke — the sample
  // point just outside the box matches the plain card background. ----
  const noBorderPixel = await borderPixel();
  const bgPixel = await plainBackgroundPixel();
  const diff = noBorderPixel.reduce((s, v, i) => s + Math.abs(v - bgPixel[i]), 0);
  assert(diff <= 6, `expected no border stroke with Image Frame off (edge pixel should match plain background), got edge=${noBorderPixel} vs background=${bgPixel}`);
  ok('Image Frame off: no border stroke around the portrait box');

  // ---- 3. Turning Image Frame on draws the accent-colored border. ----
  await page.check('#f-portrait-frame');
  await page.waitForTimeout(150);
  const framedBorderPixel = await borderPixel();
  const diffFromAccent = framedBorderPixel.reduce((s, v, i) => s + Math.abs(v - LEADER_ACCENT_RGB[i]), 0);
  assert(diffFromAccent <= 20, `expected the border pixel to match Leader's accent color when Image Frame is on, got border=${framedBorderPixel} vs expected accent=${LEADER_ACCENT_RGB}`);
  ok('Image Frame on: the accent-colored border reappears around the portrait box');

  // ---- 4. Transparent PNG portrait: Image Frame off blends the
  // transparent corner into the card's own background; on shows the old
  // tinted-box look instead (clearly different from the plain background).
  const fixture = path.join(__dirname, 'fixture-transparent.png');
  await page.uncheck('#f-portrait-frame');
  await page.waitForTimeout(100);
  await page.setInputFiles('#f-portrait', fixture);
  await page.waitForTimeout(400);

  async function transparentCornerPixel() {
    // Near the portrait box's top-left corner (same offset from the box's
    // origin verify15 originally used — (6,8) — which stays safely inside
    // the rounded corner's fill and clear of its stroke band regardless of
    // where the box origin itself sits), which the circular fixture leaves
    // transparent.
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(28 + 6, 140, 1, 1).data.slice(0, 3)];
    });
  }
  async function plainBackgroundNearTop() {
    // Same y as the corner sample (vertical gradient). The portrait
    // (x:28-440) and Stats (x:440-756) boxes now span the row at y=140
    // all the way from x=28 to the card's right edge with no gap, so the
    // only open background left at that y is the sliver left of the
    // portrait's own left edge (x:0-28, since it's now inset to match the
    // Abilities text margin instead of starting at the card's edge).
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(10, 140, 1, 1).data.slice(0, 3)];
    });
  }

  const cornerOff = await transparentCornerPixel();
  const bgNearTop = await plainBackgroundNearTop();
  const diffOff = cornerOff.reduce((s, v, i) => s + Math.abs(v - bgNearTop[i]), 0);
  assert(diffOff <= 10, `expected the transparent corner to blend into the card background with Image Frame off, got corner=${cornerOff} vs background=${bgNearTop}`);
  ok('Image Frame off + transparent PNG: transparent area blends into the card\'s own background');

  await page.check('#f-portrait-frame');
  await page.waitForTimeout(150);
  const cornerOn = await transparentCornerPixel();
  const diffOn = cornerOn.reduce((s, v, i) => s + Math.abs(v - bgNearTop[i]), 0);
  assert(diffOn > 10, `expected the transparent corner to look different from the plain background with Image Frame on (accent tint instead), got corner=${cornerOn} vs background=${bgNearTop}`);
  ok('Image Frame on + transparent PNG: transparent area shows the accent-tinted box, not the blend');

  // ---- 5. Save, reload, and confirm the choice round-trips (persisted per
  // card, not a global setting). ----
  await page.fill('#f-name', 'Framed Character');
  await page.click('#btn-save-card'); // Image Frame currently checked (on)
  await page.waitForTimeout(200);

  await page.click('#btn-new-card');
  await page.waitForTimeout(100);
  const afterNewCard = await page.$eval('#f-portrait-frame', el => el.checked);
  assert.strictEqual(afterNewCard, false, 'expected New Card to reset Image Frame back to off (the default)');
  ok('New Card resets Image Frame back to off');

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  await page.click('.gallery-card:has-text("Framed Character") [data-act="edit"]');
  await page.waitForTimeout(200);
  const reloadedChecked = await page.$eval('#f-portrait-frame', el => el.checked);
  assert.strictEqual(reloadedChecked, true, 'expected the saved card to reload with Image Frame on, since that was checked when it was saved');
  ok('A saved card\'s Image Frame choice persists and reloads correctly');

  console.log('\nAll verify24 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
