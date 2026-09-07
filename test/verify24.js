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

  // The portrait box now runs flush to the card's own left edge and
  // immediately under the name bar (PORTRAIT — read live from the page's
  // own global rather than hardcoded, so this doesn't go stale again next
  // time the layout shifts), so unlike before there's no open background
  // margin left beside OR above it any more — Portrait+Stats together now
  // span the full card width with zero gap under the name bar. Sample
  // points below are chosen to avoid needing such a margin at all.
  async function borderPixel() {
    // Exactly on the portrait's flat top edge (PORTRAIT.y itself),
    // horizontally centered. Empirically this row gets full stroke
    // coverage when Image Frame is on (pure accent) and shows the
    // portrait's own placeholder fill/hatch — not the name bar's
    // same-colored accent stripe, which ends one row above this — when
    // it's off; the row immediately below only gets partial (anti-aliased,
    // blended) coverage and isn't a reliable sample point.
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(Math.round(PORTRAIT.x + PORTRAIT.w / 2), PORTRAIT.y, 1, 1).data.slice(0, 3)];
    });
  }
  // Leader's fixed accent color (TYPE_PRESETS.Leader.accent in
  // cardRenderer.js — a punchy Gamegenic Prime "Orange") — used as the
  // expected border color rather than sampling another spot on the card,
  // so this doesn't depend on guessing which other pixels happen to be
  // pure accent color.
  const LEADER_ACCENT_RGB = [0xf6, 0x93, 0x0a];

  // ---- 2. No image yet, Image Frame off: no border stroke — the sample
  // point (inside the portrait's own placeholder fill/hatch, off but not
  // remotely accent-orange) is clearly NOT the accent color. ----
  const noBorderPixel = await borderPixel();
  const diffOffFromAccent = noBorderPixel.reduce((s, v, i) => s + Math.abs(v - LEADER_ACCENT_RGB[i]), 0);
  assert(diffOffFromAccent > 40, `expected no border stroke with Image Frame off (edge pixel should NOT be accent-colored), got edge=${noBorderPixel} vs accent=${LEADER_ACCENT_RGB}`);
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
    // Near the portrait box's top-left corner — (6,8) in from its own
    // origin (read live from PORTRAIT, not hardcoded), which the circular
    // fixture leaves transparent and which sits well clear of the card's
    // own rounded-corner clip (that only affects the literal card corners,
    // and the portrait now starts well below the top one).
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(PORTRAIT.x + 6, PORTRAIT.y + 8, 1, 1).data.slice(0, 3)];
    });
  }
  async function plainBackgroundNearTop() {
    // Portrait (x:0-440) and Stats (x:440-750) now together span the full
    // card width with no gap at any y within their own row, so there's no
    // "open background beside them" left to sample any more. Sample well
    // below both boxes instead, in the open Abilities area (no ability
    // text filled in this test, and x:10 is left of the text's own
    // margin) — a different y than the corner sample, but the 'light'
    // theme's gradient (bgTop #ffffff -> bgBottom #fbfbfa) is close enough
    // to flat that the few units of y-drift are well within the
    // comparison's own tolerance.
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(10, PORTRAIT.y + PORTRAIT.h + 40, 1, 1).data.slice(0, 3)];
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
