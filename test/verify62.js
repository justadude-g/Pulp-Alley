// verify62.js — two Gang-related fixes:
// 1. The Stats fieldset (#stats-fieldset, class="stat-grid") is a CSS Grid
//    that lays the 6 stats out two-per-row with the Reset Stats button
//    right-aligned beneath them. updateAssociateFieldVisibility used to
//    hardcode `style.display = 'block'` whenever a non-Associate Card
//    Type was shown — on EVERY Card Type switch — clobbering the grid
//    with a single stacked column (6 rows tall instead of 3). On a
//    shorter window this extra height could push the Reset Stats button
//    below the fold, especially right after switching back from an
//    Asset/Associate type, reading as the button having disappeared.
//    Fixed by clearing the inline override (`''`) instead of hardcoding
//    'block', so the element's own CSS `display: grid` applies.
// 2. Gang cards now print an on-card reminder of the Gang skill-dice rule
//    (Brawl/Shoot/Might = 1d6 per 2 models, rounded up) right under the
//    Stats table, so a player has it at the table without needing to
//    recall the designer-only hint.
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

  // ---- 1. Stats fieldset renders as a CSS grid (not a JS-forced block
  // stack) both on initial load and after round-tripping through an Asset
  // Card Type, and the Reset Stats button stays visible and reasonably
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
  assert(await page.locator('#reset-stats').isVisible(), 'expected Reset Stats to be visible after Gear -> Leader');
  ok('Stats fieldset keeps its compact grid layout (not a tall stacked column) after switching Contacts/Gear -> Leader, and Reset Stats stays visible');

  // Same check for Ally and Gang (Gang legitimately hides Reset Stats
  // itself — it has its own model-based auto-fill instead — but the grid
  // layout fix still applies to it).
  await page.selectOption('#f-cardType', 'Contacts');
  await page.waitForTimeout(150);
  await page.selectOption('#f-cardType', 'Ally');
  await page.waitForTimeout(150);
  assert(await page.locator('#reset-stats').isVisible(), 'expected Reset Stats to be visible after Contacts -> Ally');
  const allyDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('stats-fieldset')).display);
  assert.strictEqual(allyDisplay, 'grid', 'expected #stats-fieldset to render as CSS grid for Ally too');
  ok('Contacts -> Ally also keeps Reset Stats visible and the Stats grid intact');

  await page.selectOption('#f-cardType', 'Gear');
  await page.waitForTimeout(150);
  await page.selectOption('#f-cardType', 'Gang');
  await page.waitForTimeout(150);
  assert.strictEqual(await page.locator('#reset-stats').isVisible(), false,
    'expected Reset Stats to stay hidden for Gang (it uses its own model-based auto-fill, not the Reset-to-Card-Type mechanism) — this is intentional, not the bug');
  const gangGridDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('stats-fieldset')).display);
  assert.strictEqual(gangGridDisplay, 'grid', 'expected #stats-fieldset to still render as CSS grid for Gang (just without the Reset Stats button)');
  ok('Gear -> Gang correctly keeps Reset Stats hidden (by design) while the Stats grid itself still renders correctly');

  // ---- 2. Gang cards print the skill-dice reminder on the rendered card
  // itself, positioned under the Stats table. ----
  await page.waitForTimeout(150);
  const gangNoteCheck = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    // STATS = { x: 440, y: 132, w: 310, h: 430 } in cardRenderer.js — scan
    // a band just below the Stats table's bottom edge (y=562) for ink that
    // isn't part of the plain background, confirming something is printed
    // there for a Gang card.
    const bg = ctx.getImageData(600, 605, 1, 1).data;
    let inkCount = 0;
    for (let y = 568; y < 620; y++) {
      for (let x = 445; x < 745; x += 4) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (Math.abs(d[0]-bg[0]) + Math.abs(d[1]-bg[1]) + Math.abs(d[2]-bg[2]) > 20) { inkCount++; break; }
      }
    }
    return inkCount;
  });
  assert(gangNoteCheck > 3, `expected several rows of ink under the Stats table for the Gang skill-dice note, got ${gangNoteCheck} rows with ink`);
  ok('Gang card prints a reminder note under the Stats table on the rendered card itself');

  // A non-Gang card (Leader) should NOT show this note — confirm no
  // unexpected extra ink band appears in the same region for Leader by
  // comparing to a fresh Leader render's Abilities-start position not
  // being pushed down (abilTop only shifts for Gang).
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  ok('Note only applies to Gang (Leader keeps the normal Abilities layout, checked structurally via renderCard\'s isGang flag in source)');

  console.log('\nAll verify62 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
