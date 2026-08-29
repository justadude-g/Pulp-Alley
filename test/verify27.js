// verify27.js — default Accent Colors now correspond to Gamegenic Prime
// Sleeves colors per Card Type (Leader=Orange, Sidekick=Green, Ally=Blue,
// Follower=Black, Gang=Dark Gray, Villain=Red, Creature=Purple,
// Custom=Lime), and selecting either Classical (parchment) Card
// Background overrides all of that to plain black instead, for every
// Card Type, until the user picks their own color.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8868;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

// hex -> lowercase, matching how <input type="color">.value normalizes
function norm(hex) { return hex.toLowerCase(); }

const EXPECTED = {
  Leader: '#f97316',    // Orange
  Sidekick: '#16a34a',  // Green
  Ally: '#2563eb',      // Blue
  Follower: '#000000',  // Black
  Gang: '#3f3f46',       // Dark Gray
  Villain: '#dc2626',    // Red
  Creature: '#9333ea',   // Purple
  Custom: '#84cc16',     // Lime
};

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Every Card Type defaults to its Gamegenic-corresponding color
  // under a non-Classical theme (Ivory, the app default). ----
  await page.selectOption('#f-theme', 'ivory');
  for (const [cardType, expected] of Object.entries(EXPECTED)) {
    await page.selectOption('#f-cardType', cardType);
    await page.waitForTimeout(80);
    const value = await page.$eval('#f-accentColor', el => el.value);
    assert.strictEqual(norm(value), norm(expected), `expected ${cardType}'s default accent to be ${expected} (Gamegenic color), got ${value}`);
  }
  ok('Every Card Type defaults to its corresponding Gamegenic Prime Sleeves color under a normal theme');

  // ---- 2. Selecting a Classical theme overrides the current Card Type's
  // accent to black, for every Card Type — not just whichever one was
  // selected first. ----
  await page.selectOption('#f-cardType', 'Villain'); // otherwise Red
  await page.selectOption('#f-theme', 'classical');
  await page.waitForTimeout(100);
  let value = await page.$eval('#f-accentColor', el => el.value);
  assert.strictEqual(norm(value), '#000000', `expected Classical to override Villain's Red to black, got ${value}`);
  ok('Selecting Classical overrides the current Card Type\'s accent to black');

  // Confirm this actually renders black, not just that the color-picker's
  // value says so — Classical fixes several elements to its own parchment
  // palette regardless of accent (the level badge, the tinted fills), but
  // the name-bar underline strip is drawn directly in the accent color
  // with no theme override, so it's a reliable place to check the real
  // pixel output.
  const underlineColor = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return [...ctx.getImageData(378, 116, 1, 1).data.slice(0, 3)];
  });
  assert(underlineColor.every(v => v <= 6), `expected the name-bar underline to render pure black under Classical, got rgb(${underlineColor})`);
  ok('The black accent default actually renders on the card (name-bar underline), not just in the color picker');

  for (const cardType of Object.keys(EXPECTED)) {
    await page.selectOption('#f-cardType', cardType);
    await page.waitForTimeout(60);
    value = await page.$eval('#f-accentColor', el => el.value);
    assert.strictEqual(norm(value), '#000000', `expected ${cardType} to default to black while Classical is active, got ${value}`);
  }
  ok('Every Card Type defaults to black while a Classical theme is active, not its normal Gamegenic color');

  // classicalNoSkull behaves the same way as classical.
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'classicalNoSkull');
  await page.waitForTimeout(100);
  value = await page.$eval('#f-accentColor', el => el.value);
  assert.strictEqual(norm(value), '#000000', `expected classicalNoSkull to also default Leader to black, got ${value}`);
  ok('classicalNoSkull behaves the same as classical for the black accent default');

  // ---- 3. Leaving Classical restores the current Card Type's normal
  // Gamegenic-color default (Leader = Orange here). ----
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(100);
  value = await page.$eval('#f-accentColor', el => el.value);
  assert.strictEqual(norm(value), norm(EXPECTED.Leader), `expected leaving Classical to restore Leader's Orange default, got ${value}`);
  ok('Switching away from Classical restores the current Card Type\'s normal default color');

  // ---- 4. A manual color pick survives anything that ISN'T a Card Type
  // or Card Background change — e.g. typing the character's name. ----
  await page.evaluate(() => {
    const el = document.getElementById('f-accentColor');
    el.value = '#ff00ff';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.fill('#f-name', 'Manually Colored Hero');
  await page.waitForTimeout(100);
  value = await page.$eval('#f-accentColor', el => el.value);
  assert.strictEqual(norm(value), '#ff00ff', 'expected a manually-picked accent color to survive editing an unrelated field (Name)');
  ok('A manually-picked accent color is untouched by editing unrelated fields');

  // It still stays a normal, editable field — the next Card Type or Card
  // Background change re-applies the relevant default, same as every
  // other auto-filled field in the app (Level/Health/Stats).
  await page.selectOption('#f-cardType', 'Sidekick');
  await page.waitForTimeout(100);
  value = await page.$eval('#f-accentColor', el => el.value);
  assert.strictEqual(norm(value), norm(EXPECTED.Sidekick), 'expected the next Card Type change to re-apply that type\'s default, same as Level/Health/Stats do');
  ok('The next Card Type change re-applies the default color, consistent with how every other auto-filled field behaves');

  console.log('\nAll verify27 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
