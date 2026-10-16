// verify64.js — "SciFi Blue" / "SciFi Red" Card Background options.
// Visually identical to Light (pure white, lightest ink) but each forces
// every character Card Type's Accent Color to a fixed blue/red — the same
// "theme overrides Accent Color" mechanism Classical already uses to force
// black — instead of each Card Type keeping its own default accent. Asset
// Card Types (Contacts/Gear/Backup/Minions/Cult/Gifts) are the one
// exception, same as under Classical: they keep their own green identity.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8864;
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

  // ---- 1. Both options exist in the Card Background dropdown. ----
  const themeOptions = await page.$$eval('#f-theme option', els => els.map(e => e.value));
  assert(themeOptions.includes('sciFiBlue'), 'expected a "sciFiBlue" theme option');
  assert(themeOptions.includes('sciFiRed'), 'expected a "sciFiRed" theme option');
  ok('Card Background dropdown offers both SciFi Blue and SciFi Red');

  // ---- 2. Picking either SciFi theme forces a character Card Type's
  // Accent Color, overriding that Type's own default (Leader defaults to
  // orange #f6930a). ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(100);

  await page.selectOption('#f-theme', 'sciFiBlue');
  await page.waitForTimeout(100);
  let accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(accent.toLowerCase(), '#1f5fa6', `expected SciFi Blue to force Accent Color to #1f5fa6 on a Leader, got ${accent}`);
  ok('SciFi Blue forces a Leader\'s Accent Color to #1f5fa6');

  await page.selectOption('#f-theme', 'sciFiRed');
  await page.waitForTimeout(100);
  accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(accent.toLowerCase(), '#b3262b', `expected SciFi Red to force Accent Color to #b3262b on a Leader, got ${accent}`);
  ok('SciFi Red forces a Leader\'s Accent Color to #b3262b');

  // ---- 3. Switching Card Type while a SciFi theme is active re-forces the
  // new Type's accent too (same listener path as Classical). ----
  await page.selectOption('#f-cardType', 'Villain');
  await page.waitForTimeout(100);
  accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(accent.toLowerCase(), '#b3262b', `expected SciFi Red to still force Accent Color to #b3262b after switching to Villain, got ${accent}`);
  ok('SciFi Red keeps forcing the fixed accent after switching Card Type');

  // ---- 4. Asset Card Types (e.g. Gear) keep their own green identity
  // under both SciFi themes, same exception Classical gets. ----
  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(100);
  accent = await page.inputValue('#f-accentColor');
  assert.strictEqual(accent.toLowerCase(), '#4b6b3c', `expected Gear to keep its own green Accent Color under SciFi Red, got ${accent}`);
  ok('Asset Card Types keep their own green Accent Color under SciFi Red');

  // ---- 5. Both SciFi themes render the exact same background as Light
  // (LIGHT_BASE is shared, see cardRenderer.js) — sample a background pixel
  // clear of any accent-tinted element and compare directly against Light's
  // own pixel at that same spot, rather than asserting an absolute "near
  // white" threshold (that spot sits inside Light's own faint nameBarBg/
  // borderSubtle wash, not pure #ffffff, so it's a few points under 245). ----
  async function sampleBg() {
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(2, 1045, 1, 1).data.slice(0, 3)];
    });
  }
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(100);
  await page.selectOption('#f-theme', 'light');
  await page.waitForTimeout(100);
  const lightBg = await sampleBg();
  for (const theme of ['sciFiBlue', 'sciFiRed']) {
    await page.selectOption('#f-theme', theme);
    await page.waitForTimeout(100);
    const bg = await sampleBg();
    assert.deepStrictEqual(bg, lightBg, `expected ${theme}'s background to render identically to Light's, got rgb(${bg}) vs Light's rgb(${lightBg})`);
  }
  ok('SciFi Blue and SciFi Red render the exact same background as Light');

  console.log('\nAll verify64 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
