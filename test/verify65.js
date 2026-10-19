// verify65.js — the "Stone" Card Background: Classical's structure (same
// fixed two-band Stats treatment, same solid-fill level badge) with a
// contemporary palette in place of the aged-parchment one. Picked from a
// side-by-side preview of three candidate re-colorings. Like Classical, it
// pins the Accent Color for every character Card Type instead of letting
// each Type keep its own Gamegenic-sleeve-matched default — charcoal here,
// matching its own badge — with the Asset Card Types' green the one
// exception, same as under every other pinned theme.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8865;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }
function norm(hex) { return String(hex).toLowerCase(); }
function near(actual, expectedHex, tol = 2) {
  const h = expectedHex.replace('#', '');
  const want = [0, 2, 4].map(i => parseInt(h.substring(i, i + 2), 16));
  return actual.every((v, i) => Math.abs(v - want[i]) <= tol);
}

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Stone is offered in the Card Background dropdown. ----
  const themeOptions = await page.$$eval('#f-theme option', els => els.map(e => e.value));
  assert(themeOptions.includes('stone'), 'expected a "stone" Card Background option');
  ok('Card Background dropdown offers Stone');

  // ---- 2. Stone pins every character Card Type's Accent Color to
  // charcoal, the same way Classical pins them to black. ----
  await page.selectOption('#f-cardType', 'Leader'); // otherwise Orange
  await page.selectOption('#f-theme', 'stone');
  await page.waitForTimeout(120);
  let accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(norm(accent), '#1d1c1a', `expected Stone to pin a Leader's Accent Color to #1d1c1a, got ${accent}`);

  await page.selectOption('#f-cardType', 'Villain'); // otherwise Red
  await page.waitForTimeout(120);
  accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(norm(accent), '#1d1c1a', `expected Stone to keep pinning the accent to #1d1c1a after a Card Type switch, got ${accent}`);
  ok('Stone pins every character Card Type\'s Accent Color to charcoal (#1d1c1a)');

  // ---- 3. Asset Card Types keep their own green, same exception they get
  // under Classical and the SciFi themes. ----
  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(120);
  accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(norm(accent), '#4b6b3c', `expected Gear to keep its own green Accent Color under Stone, got ${accent}`);
  ok('Asset Card Types keep their own green Accent Color under Stone');

  // ---- 4. Leaving Stone restores the Card Type's normal default, so the
  // pinning is a default-fill and not a lock. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(120);
  accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(norm(accent), '#f6930a', `expected leaving Stone to restore Leader's own Orange default, got ${accent}`);
  ok('Switching away from Stone restores the Card Type\'s normal default accent');

  // ---- 5. Stone actually renders its own palette, not Classical's. Both
  // keep the same two-band Stats structure (Combat rows tinted one color,
  // Attributes rows another), so sample one pixel in each band — 6px in
  // from the card's right edge, clear of the row glyphs, the same spot
  // verify31 uses to check the Stats tint reaches the edge. ----
  async function bands() {
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
      return {
        combat: px(744, 150),        // Brawl row (first of the 3 Combat rows)
        attributes: px(744, 363),    // Might row (first of the 3 Attribute rows)
        background: px(744, 30),     // name-bar-level background, no glyphs
      };
    });
  }

  await page.selectOption('#f-theme', 'stone');
  await page.waitForTimeout(150);
  const stone = await bands();
  assert(near(stone.combat, '#e3c3b2'), `expected Stone's Combat band to render its muted clay #e3c3b2, got rgb(${stone.combat})`);
  assert(near(stone.attributes, '#ece8e2'), `expected Stone's Attributes band to render its warm grey #ece8e2, got rgb(${stone.attributes})`);
  ok('Stone renders its own Combat (clay) and Attributes (warm grey) bands');

  await page.selectOption('#f-theme', 'classicalNoSkull');
  await page.waitForTimeout(150);
  const classical = await bands();
  assert(near(classical.combat, '#d9895a'), `expected Classical's Combat band to still render its terracotta #d9895a, got rgb(${classical.combat})`);
  ok('Classical\'s own bands are untouched by Stone sharing the same structure');

  // Stone's whole card ground is near-white where Classical's is solid
  // tan — the single biggest reason it reads modern, and the reason it
  // prints with far less ink coverage.
  const lum = px => 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
  assert(lum(stone.background) > lum(classical.background) + 25,
    `expected Stone's card ground to be markedly lighter than Classical's tan, got Stone rgb(${stone.background}) vs Classical rgb(${classical.background})`);
  ok('Stone\'s card ground is markedly lighter than Classical\'s parchment tan');

  console.log('\nAll verify65 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
