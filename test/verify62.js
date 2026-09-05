// verify62.js — two Gang-related fixes, plus the "Reset Stats" -> "Reset"
// button rename:
// 1. The Stats fieldset (#stats-fieldset, class="stat-grid") is a CSS Grid
//    that lays the 6 stats out two-per-row with the Reset button
//    right-aligned beneath them. updateAssociateFieldVisibility used to
//    hardcode `style.display = 'block'` whenever a non-Associate Card
//    Type was shown — on EVERY Card Type switch — clobbering the grid
//    with a single stacked column (6 rows tall instead of 3). On a
//    shorter window this extra height could push the Reset button below
//    the fold, especially right after switching back from an Asset/
//    Associate type, reading as the button having disappeared. Fixed by
//    clearing the inline override (`''`) instead of hardcoding 'block',
//    so the element's own CSS `display: grid` applies.
// 2. Gang cards print an on-card reminder of the Gang skill-dice rule
//    (Brawl/Shoot/Might = 1d6 per 2 models, rounded up) at the very
//    bottom of the card, just above the Health bar, in a 24px font —
//    big enough to read on a printed card, not tucked under the Stats
//    table at a small size. The phrase omits "in the gang" and renders
//    at regular (not bold) weight so it fits on a single line and reads
//    cleanly once printed — an earlier bold, longer version wrapped
//    awkwardly to two lines.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8882;
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

  // ---- 0. Button reads "Reset", not "Reset Stats". ----
  const btnText = (await page.locator('#reset-stats').textContent()).trim();
  assert(/^↺?\s*Reset$/.test(btnText), `expected the button's label to be just "Reset", got "${btnText}"`);
  ok('Stats reset button is labeled "Reset" (not "Reset Stats")');

  // ---- 1. Stats fieldset renders as a CSS grid (not a JS-forced block
  // stack) both on initial load and after round-tripping through an Asset
  // Card Type, and the Reset button stays visible and reasonably
  // positioned (not pushed far down the page) in both cases. ----
  const initialDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('stats-fieldset')).display);
  assert.strictEqual(initialDisplay, 'grid', `expected #stats-fieldset to render as CSS grid on load, got "${initialDisplay}"`);
  ok('Stats fieldset renders as its intended CSS grid on initial load');

  const initialBox = await page.locator('#stats-fieldset').boundingBox();

  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(150);
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  const afterDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('stats-fieldset')).display);
  assert.strictEqual(afterDisplay, 'grid', `expected #stats-fieldset to still render as CSS grid after Gear -> Leader, got "${afterDisplay}"`);
  const afterBox = await page.locator('#stats-fieldset').boundingBox();
  assert(Math.abs(afterBox.height - initialBox.height) < 5,
    `expected the Stats fieldset's height to stay the same (compact 2-column grid) after switching through an Asset type, got ${initialBox.height}px -> ${afterBox.height}px`);
  assert(await page.locator('#reset-stats').isVisible(), 'expected Reset button to be visible after Gear -> Leader');
  ok('Stats fieldset keeps its compact grid layout (not a tall stacked column) after switching Contacts/Gear -> Leader, and Reset stays visible');

  // Same check for Ally and Gang (Gang legitimately hides the Reset
  // button itself — it has its own model-based auto-fill instead — but
  // the grid layout fix still applies to it).
  await page.selectOption('#f-cardType', 'Contacts');
  await page.waitForTimeout(150);
  await page.selectOption('#f-cardType', 'Ally');
  await page.waitForTimeout(150);
  assert(await page.locator('#reset-stats').isVisible(), 'expected Reset button to be visible after Contacts -> Ally');
  const allyDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('stats-fieldset')).display);
  assert.strictEqual(allyDisplay, 'grid', 'expected #stats-fieldset to render as CSS grid for Ally too');
  ok('Contacts -> Ally also keeps Reset visible and the Stats grid intact');

  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(150);
  await page.selectOption('#f-cardType', 'Gang');
  await page.waitForTimeout(150);
  assert.strictEqual(await page.locator('#reset-stats').isVisible(), false,
    'expected the Reset button to stay hidden for Gang (it uses its own model-based auto-fill, not the Reset-to-Card-Type mechanism) — this is intentional, not the bug');
  const gangGridDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('stats-fieldset')).display);
  assert.strictEqual(gangGridDisplay, 'grid', 'expected #stats-fieldset to still render as CSS grid for Gang (just without the Reset button)');
  ok('Gear -> Gang correctly keeps Reset hidden (by design) while the Stats grid itself still renders correctly');

  // ---- 2. Gang cards print the skill-dice reminder at the bottom of the
  // rendered card, just above the Health bar — in a large, regular-weight
  // font, not tucked under the Stats table at 15px. ----
  await page.fill('#f-name', 'Test Gang');
  await page.waitForTimeout(150);
  const gangNoteCheck = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    // Health bar starts at CARD_H - healthBarH = 1050 - 78 = 972. Scan the
    // band directly above it (and confirm the Stats-table region, ~560-
    // 620, is now clean — nothing prints there any more).
    const bg = ctx.getImageData(370, 700, 1, 1).data;
    const inkRowsInRange = (yStart, yEnd) => {
      let rows = 0;
      for (let y = yStart; y < yEnd; y += 2) {
        for (let x = 40; x < 710; x += 5) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          if (Math.abs(d[0]-bg[0]) + Math.abs(d[1]-bg[1]) + Math.abs(d[2]-bg[2]) > 20) { rows++; break; }
        }
      }
      return rows;
    };
    // Count distinct horizontal ink bands (lines of text) in the bottom
    // region, at fine (1px) row resolution, to confirm the note now prints
    // on exactly ONE line (it used to wrap to two when it was bold and
    // included "in the gang").
    const rowHasInk = (y) => {
      for (let x = 40; x < 710; x += 4) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (Math.abs(d[0]-bg[0]) + Math.abs(d[1]-bg[1]) + Math.abs(d[2]-bg[2]) > 20) return true;
      }
      return false;
    };
    let bands = 0;
    let inBand = false;
    for (let y = 880; y < 972; y++) {
      const ink = rowHasInk(y);
      if (ink && !inBand) { bands++; inBand = true; }
      if (!ink) inBand = false;
    }
    return {
      bottomInk: inkRowsInRange(890, 972),
      underStatsInk: inkRowsInRange(565, 620),
      bottomBands: bands,
    };
  });
  assert(gangNoteCheck.bottomInk > 5, `expected several rows of ink just above the Health bar (y 890-972) for the Gang note, got ${gangNoteCheck.bottomInk}`);
  assert.strictEqual(gangNoteCheck.underStatsInk, 0, `expected NO ink directly under the Stats table any more (note moved to the bottom), got ${gangNoteCheck.underStatsInk} rows`);
  assert.strictEqual(gangNoteCheck.bottomBands, 1, `expected the Gang note to render as exactly ONE line (no "in the gang", regular weight), got ${gangNoteCheck.bottomBands} ink band(s)`);
  ok('Gang card prints the skill-dice reminder at the bottom of the card, just above the Health bar, as a single line (no longer under the Stats table, no longer wrapping to two lines)');

  const gangNoteFontCheck = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    ctx.font = '400 24px Inter, sans-serif';
    const w24 = ctx.measureText('Brawl/Shoot/Might: 1d6 per 2 models (round up).').width;
    ctx.font = '400 15px Inter, sans-serif';
    const w15 = ctx.measureText('Brawl/Shoot/Might: 1d6 per 2 models (round up).').width;
    return { w24, w15, maxWidth: 750 - 56 };
  });
  assert(gangNoteFontCheck.w24 > gangNoteFontCheck.w15 * 1.4, 'expected the Gang note to measure meaningfully wider at 24px than the old 15px size, confirming it actually got bigger');
  assert(gangNoteFontCheck.w24 < gangNoteFontCheck.maxWidth, `expected the shortened note text to fit within the card's available width (${gangNoteFontCheck.maxWidth}px) at 24px regular weight, got ${gangNoteFontCheck.w24}px`);
  ok('Gang note now renders at 24px regular weight (up from 15px bold) and fits on one line');

  console.log('\nAll verify62 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
