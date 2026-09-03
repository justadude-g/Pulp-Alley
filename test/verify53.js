// verify53.js — Abilities/Stats auto-shrink fine pass: line-wrapping only
// reflows text at specific pixel-width thresholds, so shrinking the shared
// font size one whole pixel at a time can overshoot the true fitting size
// — dropping a single pixel can drop an entire wrapped line, landing well
// below the box's actual capacity and leaving a visibly empty gap above
// the health bar even though a slightly bigger (fractional-pixel) size
// would still have fit. Reported against a real card (a Leader with three
// mid-length abilities) that landed hard at font size 25 — using only
// 308 of 374px available (82%) — when a fractional size around 25.4-25.9px
// still fits comfortably and uses 345px (92%), one whole extra wrapped
// line. cardRenderer.js now binary-searches that 1px gap after the
// coarse whole-pixel pass.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8903;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // Measures how much of the Abilities box (between the portrait/stats row
  // and the health bar) actually has ink in it — scanning the real
  // rendered canvas, not reimplementing the wrap/shrink math — by finding
  // the lowest row with any non-background pixel, and counting contiguous
  // ink bands (one per wrapped line) along the way.
  async function abilitiesInkExtent() {
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      const abilTop = PORTRAIT.y + PORTRAIT.h + 22;
      const abilLeft = 28;
      const abilRight = CARD_W - 28;
      const healthBarH = 78;
      const abilBottom = CARD_H - healthBarH - 14; // no quote on this card
      const w = abilRight - abilLeft, h = abilBottom - abilTop;
      const data = ctx.getImageData(abilLeft, abilTop, w, h).data;
      const bg = [data[0], data[1], data[2]]; // top-left of the region: plain background, no text yet
      const rowHasInk = [];
      for (let y = 0; y < h; y++) {
        let ink = false;
        for (let x = 0; x < w; x += 2) {
          const idx = (y * w + x) * 4;
          const diff = Math.abs(data[idx] - bg[0]) + Math.abs(data[idx + 1] - bg[1]) + Math.abs(data[idx + 2] - bg[2]);
          if (diff > 40) { ink = true; break; }
        }
        rowHasInk.push(ink);
      }
      let lastInkRow = -1;
      for (let y = h - 1; y >= 0; y--) { if (rowHasInk[y]) { lastInkRow = y; break; } }
      let bands = 0, prev = false;
      for (let y = 0; y < h; y++) { if (rowHasInk[y] && !prev) bands++; prev = rowHasInk[y]; }
      return { available: h, lastInkRow, bands };
    });
  }

  // ---- 1. The reported card: a Leader with three mid-length abilities at
  // the default (Medium, 33px) Ability Text Size — long enough that Medium
  // doesn't fit outright (auto-shrink engages), but short enough that the
  // old whole-pixel-only search left real headroom on the table. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'ivory');
  await page.fill('#f-name', 'Director Orson Krennic');
  const abilities = [
    { name: 'Advanced Weapons Research', text: 'During set-up, you receive 1 resource point (Tips, Backup, Gear, or Contacts). This point may be spent on this scenario or saved.' },
    { name: 'Tactician', text: 'When you deploy on the table, select one of the following Gang abilities: Armed, Dangerous, Disciplined, or Loyal. Your Gangs (except Mobs) count as having this additional ability while they are within 12” of you.' },
    { name: 'Get on Your Knees', text: 'You are not limited to shooting the nearest enemy.' },
  ];
  for (let i = 0; i < abilities.length; i++) {
    if (i > 0) await page.click('#add-ability');
  }
  let nameInputs = await page.$$('.ability-item input[data-field="name"]');
  let textInputs = await page.$$('.ability-item textarea[data-field="text"]');
  for (let i = 0; i < abilities.length; i++) {
    await nameInputs[i].fill(abilities[i].name);
    await textInputs[i].fill(abilities[i].text);
  }
  await page.waitForTimeout(300);

  const extent = await abilitiesInkExtent();
  // The old whole-pixel-only search landed at font size 25 (9 wrapped
  // lines, 308 of 374px used — 82%). The fine pass finds a fractional size
  // around 25.4-25.9px that still fits, wrapping to 10 lines and using
  // 345px (92%) — a whole extra line recovered. Assert comfortably inside
  // that recovered range (well past the old 308px ceiling, still under the
  // 374px available) so this fails if the fine pass regresses to the old
  // whole-pixel-only behavior, without being pinned to the exact pixel.
  assert(extent.lastInkRow > 320, `expected the fine-grained auto-fit to use noticeably more of the Abilities box than the old whole-pixel-only search (which stopped at row 308 of 374), got last ink at row ${extent.lastInkRow} of ${extent.available}`);
  assert(extent.lastInkRow < extent.available, `expected the Abilities text to stay inside its box (not overflow into the health bar), got last ink at row ${extent.lastInkRow} of ${extent.available}`);
  assert.strictEqual(extent.bands, 10, `expected the fine pass to land on a font size that wraps to 10 lines (up from the 9 lines a whole-pixel-only search finds), got ${extent.bands} ink bands`);
  ok(`The fine pass recovers a whole extra wrapped line on the reported card (ink reaches row ${extent.lastInkRow} of ${extent.available}, ${extent.bands} lines, vs the old 308/374 and 9 lines)`);

  // ---- 1b. Stats stays at the picked Ability Text Size (Medium, 33px) on
  // this exact card, even though the Abilities text itself shrank down to
  // roughly 25.4-25.9px to fit — Stats has its own generous fixed row
  // height and never needs to shrink, so it must not track the Abilities
  // auto-fit downward. Compared against a fresh card with no abilities at
  // all (so Stats renders at the plain, un-auto-fitted 33px), which should
  // measure the same "Brawl" ink width if Stats is correctly staying put. ----
  async function statLabelInkWidth() {
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      const rowY = 132, rowH = 430 / 6;
      const midY = Math.round(rowY + rowH / 2 + 1);
      const textColor = [24, 28, 36]; // Ivory's textPrimary
      let left = null, right = null;
      for (let x = 440 + 15; x <= 440 + 200; x++) {
        const d = ctx.getImageData(x, midY, 1, 1).data;
        if (Math.abs(d[0] - textColor[0]) + Math.abs(d[1] - textColor[1]) + Math.abs(d[2] - textColor[2]) < 30) {
          if (left === null) left = x;
          right = x;
        }
      }
      return (left === null) ? 0 : (right - left);
    });
  }
  const widthOnShrunkCard = await statLabelInkWidth();
  await page.click('#btn-new-card');
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(150);
  const widthWithNoAbilities = await statLabelInkWidth();
  assert(Math.abs(widthOnShrunkCard - widthWithNoAbilities) <= 2, `expected the Stats "Brawl" label to render at the same width whether or not the Abilities text needed to auto-shrink (Stats stays fixed at the picked size), got with-shrunk-abilities=${widthOnShrunkCard} vs no-abilities=${widthWithNoAbilities}`);
  ok(`Stats stays fixed at the picked Ability Text Size on the reported card, unaffected by the Abilities auto-fit (${widthOnShrunkCard} vs ${widthWithNoAbilities} with no abilities at all)`);

  // ---- 2. The fine pass never grows a card past the Ability Text Size the
  // user actually picked — it only recovers wasted space inside an
  // auto-shrink. A short single ability at "Small" should render
  // meaningfully smaller than the same ability at "Extra Large", same
  // contract as before this change (see verify31.js test 1a). ----
  await page.click('#btn-new-card');
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'ivory');
  await page.click('#add-ability');
  nameInputs = await page.$$('.ability-item input[data-field="name"]');
  textInputs = await page.$$('.ability-item textarea[data-field="text"]');
  await nameInputs[0].fill('Marksman');
  await textInputs[0].fill('Re-roll one failed Shoot die per activation.');
  await page.waitForTimeout(200);

  // Reuses the statLabelInkWidth() helper defined above (test 1b).
  await page.selectOption('#f-abilityFontSize', '29'); // Small
  await page.waitForTimeout(150);
  const widthSmall = await statLabelInkWidth();
  await page.selectOption('#f-abilityFontSize', '42'); // Extra Large
  await page.waitForTimeout(150);
  const widthXL = await statLabelInkWidth();
  assert(widthXL > widthSmall * 1.2, `expected "Small" to still render noticeably smaller than "Extra Large" for short text with room to spare — the fine pass must not grow a card past its picked size, got Small=${widthSmall} XL=${widthXL}`);
  ok(`Short Abilities text with room to spare still respects the picked Ability Text Size (Small=${widthSmall}, Extra Large=${widthXL}) — the fine pass only recovers space inside a shrink, it never grows past the user's pick`);

  assert.deepStrictEqual(errors, [], `expected no page errors, got ${JSON.stringify(errors)}`);
  console.log('\nAll verify53 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
