// verify30.js — five card-design refinements:
// 1. Stats dice-pool value now renders in Inter (same family as Abilities
//    text), not the Rajdhani display face used for headline elements.
// 2. Leader's default Accent Color shifted from a red-leaning orange
//    (#f97316, reads coral/pink once tinted light) to a punchier,
//    yellow-leaning orange (#f6930a) that stays unambiguously orange.
// 3. Card Background dropdown: Classical (no skull) is now the default and
//    first option, Classical (with skull) second, then Ivory and Light;
//    Dark has been removed from the choices (still renders correctly on
//    any card saved with it before this change).
// 4. Level is now a 0-4 dropdown instead of a free-typed number (the
//    rulebook maximum is 4) — old saved cards above 4 are clamped on load.
// 5. The portrait box's right edge runs flush to the Stats table's left
//    edge, instead of floating with a gap before Stats. (Its left edge was
//    x=0, the card's literal edge, when this test was written; a later
//    change moved it to x=28 to align with the Abilities text margin
//    instead — see verify31.js.)
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8871;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }
function closeTo(rgb, hex, tol = 12) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return Math.abs(rgb[0] - r) <= tol && Math.abs(rgb[1] - g) <= tol && Math.abs(rgb[2] - b) <= tol;
}
function hue(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Stats dice-pool value renders in Inter, not Rajdhani, at the
  // exact same size variable that drives the Stats label and the
  // Abilities text (sharedFontSize) — a later change made Stats and
  // Abilities share one literal font-size variable, not just visually
  // similar sizes. Font-fingerprinting this from rendered pixels is
  // unreliable (a single scanline through mixed-height digit glyphs
  // doesn't give a clean, reproducible ink width), so this checks the
  // actual source declaration directly.
  const rendererSrc = fs.readFileSync(path.join(ROOT, 'js', 'cardRenderer.js'), 'utf8');
  const dieStrFontMatch = rendererSrc.match(/const dieStr[\s\S]{0,200}/);
  assert(dieStrFontMatch, 'expected to find the dice-pool ("dieStr") rendering code in cardRenderer.js');
  assert(/ctx\.font = `700 \$\{sharedFontSize\}px Inter, sans-serif`/.test(dieStrFontMatch[0]),
    'expected the Stats dice-pool value to use an Inter font declaration driven by sharedFontSize (same variable as Abilities text), not Rajdhani or a fixed size');
  assert(!/Rajdhani/.test(dieStrFontMatch[0]), 'expected the Stats dice-pool font declaration to no longer reference Rajdhani');
  ok('Stats dice-pool value shares the exact sharedFontSize variable with the Abilities text, in Inter not Rajdhani');

  // The stat label ("Brawl", "Finesse", etc.) uses the same sharedFontSize
  // variable too, not a separate fixed size.
  const statLabelFontDecl = rendererSrc.match(/ctx\.font = `600 \$\{sharedFontSize\}px Inter, sans-serif`/);
  assert(statLabelFontDecl, 'expected the Stats label to use an Inter font declaration driven by sharedFontSize, matching the dice value and Abilities text');
  ok('Stats label ("Brawl", "Finesse", etc.) shares the same sharedFontSize variable too');

  // Sanity-check it still actually renders something legible in that row
  // (not blank / not throwing) — a lightweight smoke check alongside the
  // source-level proof above.
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(150);
  const diceInkPresent = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    const rowY = 132, rowH = 430 / 6;
    const midY = Math.round(rowY + rowH / 2 + 1);
    const accent = ctx.getImageData(85, 59, 1, 1).data;
    // STATS = {x:440, y:132, w:316, h:430} as of the portrait/stats width
    // rebalance (see verify31.js) — scan its content span for accent ink.
    for (let x = 440 + 20; x <= 440 + 316 - 15; x++) {
      const d = ctx.getImageData(x, midY, 1, 1).data;
      if (Math.abs(d[0] - accent[0]) + Math.abs(d[1] - accent[1]) + Math.abs(d[2] - accent[2]) < 40) return true;
    }
    return false;
  });
  assert(diceInkPresent, 'expected the dice-pool value to actually render accent-colored ink in the Brawl row');
  ok('Dice-pool text still renders correctly in the Stats row');

  // ---- 2. Leader's accent is a punchier, less-pink orange. ----
  const badgeFill = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return [...ctx.getImageData(85, 59, 1, 1).data.slice(0, 3)]; // badge center = solid accent fill on Ivory
  });
  assert(closeTo(badgeFill, '#f6930a', 10), `expected Leader's accent to be the new punchier orange #f6930a, got rgb(${badgeFill})`);
  ok("Leader's solid accent color is the new punchier orange (#f6930a)");

  const tintPixel = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    // Brawl row tint background. STATS now starts at x=440 (not 340), so
    // this must sample inside the current Stats box, not the wider
    // portrait that now occupies the space up to x=440 — see verify31.js.
    return [...ctx.getImageData(460, 150, 1, 1).data.slice(0, 3)];
  });
  const tintHue = hue(...tintPixel);
  assert(tintHue >= 33, `expected the light Stats-row tint to read as a clear peach/orange (hue >= 33°), got hue ${tintHue.toFixed(1)}° from rgb(${tintPixel})`);
  ok(`The light accent tint on Brawl/Shoot/Dodge reads as orange/peach, not pink (hue ${tintHue.toFixed(1)}°)`);

  // ---- 3. Card Background dropdown: Classical no-skull first & default,
  // Classical second, Ivory/Light after, Dark removed. ----
  await page.reload();
  await page.waitForTimeout(400);
  const themeOptions = await page.$$eval('#f-theme option', els => els.map(e => e.value));
  assert.deepStrictEqual(themeOptions, ['classicalNoSkull', 'classical', 'ivory', 'light'],
    `expected Card Background options in order [classicalNoSkull, classical, ivory, light], got ${JSON.stringify(themeOptions)}`);
  ok('Card Background options are ordered Classical (no skull), Classical, Ivory, Light, with Dark removed');

  const selectedTheme = await page.$eval('#f-theme', el => el.value);
  assert.strictEqual(selectedTheme, 'classicalNoSkull', `expected Classical (no skull) to be the default on a fresh page, got ${selectedTheme}`);
  ok('Classical (no skull) is the default Card Background on a fresh page load');

  // A card saved before this change with theme: 'dark' should still render
  // without error (Dark is removed from the dropdown, not from THEMES).
  const darkStillRenders = await page.evaluate(() => {
    try {
      const canvas = document.getElementById('card-canvas');
      const data = collectFormData();
      data.theme = 'dark';
      data.portraitImg = null;
      renderCard(canvas, data);
      return true;
    } catch (e) {
      return false;
    }
  });
  assert(darkStillRenders, 'expected a legacy card with theme "dark" to still render without throwing, even though it is no longer offered in the dropdown');
  ok('A pre-existing card saved with the Dark theme still renders correctly (Dark removed from the UI, not from rendering support)');
  // Put the live preview back to a normal state for the checks that follow.
  await page.reload();
  await page.waitForTimeout(400);

  // ---- 4. Level is a 0-4 dropdown, default 4. ----
  const levelTag = await page.$eval('#f-level', el => el.tagName.toLowerCase());
  assert.strictEqual(levelTag, 'select', `expected #f-level to be a <select>, got <${levelTag}>`);
  const levelOptions = await page.$$eval('#f-level option', els => els.map(e => e.value));
  assert.deepStrictEqual(levelOptions, ['0', '1', '2', '3', '4'], `expected Level options [0,1,2,3,4], got ${JSON.stringify(levelOptions)}`);
  const defaultLevel = await page.$eval('#f-level', el => el.value);
  assert.strictEqual(defaultLevel, '4', `expected Level to default to 4, got ${defaultLevel}`);
  ok('Level is a 0-4 dropdown, defaulting to 4 (the rulebook maximum)');

  // A legacy card saved with an out-of-range level (from before the 0-4
  // limit existed) is clamped to a valid option when loaded for editing.
  // Builds the same record shape the real Save button writes (see
  // app.js's #btn-save-card handler) since the level: 9 value can no
  // longer be produced through the UI itself.
  await page.evaluate(() => {
    const data = collectFormData();
    data.name = 'Legacy High Level';
    data.level = 9;
    data.portraitImg = null;
    const canvas = document.getElementById('card-canvas');
    renderCard(canvas, data);
    const record = {
      id: crypto.randomUUID(),
      formData: { ...data, portraitImg: undefined },
      portraitDataURL: null,
      portraitView: data.portraitView,
      pngDataURL: canvas.toDataURL('image/png'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return saveCard(record);
  });
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('.gallery-card:has-text("Legacy High Level") [data-act="edit"]');
  await page.waitForTimeout(200);
  const clampedLevel = await page.$eval('#f-level', el => el.value);
  assert.strictEqual(clampedLevel, '4', `expected a legacy level of 9 to clamp to the max valid option (4) on load, got ${clampedLevel}`);
  ok('A legacy card with an out-of-range level (from before the dropdown) clamps to a valid option on load');

  // ---- 5. Portrait box's right edge stays flush to the Stats table (no
  // gap). (Its left edge originally ran flush to the card's literal left
  // edge (x=0) when this test was written; a later change moved it to
  // x=28 to line up with the Abilities text's left margin instead — see
  // verify31.js for that. Stats' own x also moved from 340 to 440 in that
  // same change, freeing width for the portrait.) ----
  await page.click('#btn-new-card');
  await page.waitForTimeout(150);
  const box = await page.evaluate(() => getPortraitBox());
  assert.strictEqual(box.x + box.w, 440, `expected the portrait box's right edge to touch the Stats table's left edge (440), got ${box.x + box.w}`);
  ok('Portrait box\'s right edge stays flush to the Stats table, with no gap');

  console.log('\nAll verify30 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
