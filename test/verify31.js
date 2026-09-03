// verify31.js — Stats/Abilities/Portrait rebalance:
// 1. Stats (label + dice value) render at the picked Ability Text Size and
//    track the dropdown live. They do NOT shrink along with the Abilities
//    text's own auto-fit, though — Stats has its own generous fixed row
//    height and stays a plain, predictable size no matter how long the
//    Abilities text runs; only the Abilities block auto-fits its own
//    separate space (see verify53.js for that fine-grained auto-fit).
// 2. The Stats row backgrounds (tint/tint2) now reach the card's right
//    edge, instead of stopping short of it with a plain-background margin.
// 3. Stats starts further right than before (x:440, was x:340) — tighter
//    label-to-dice-value spacing needs less width — handing the freed
//    width to the portrait.
// 4. The portrait's left edge now lines up with the Abilities text's left
//    margin (x:28) instead of the card's literal edge (x:0), so the two
//    columns of content visually align; its right edge still runs flush
//    to Stats (now at x:440, so the portrait is 412px wide).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8872;
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

  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'ivory');
  await page.click('#add-ability');
  const nameInputs = await page.$$('.ability-item input[data-field="name"]');
  await nameInputs[0].fill('Marksman');
  const textInputs = await page.$$('.ability-item textarea[data-field="text"]');
  await textInputs[0].fill('Re-roll one failed Shoot die per activation.');
  await page.waitForTimeout(200);

  // Measures the ink width of the "BRAWL" label in the top Stats row by
  // scanning for text-colored pixels (T.textPrimary, near-black on Ivory)
  // across the row, taking the leftmost/rightmost match rather than
  // assuming one contiguous run (kerning gaps between letters read as
  // background, same lesson learned in verify30).
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

  // ---- 1a. Changing Ability Text Size changes the Stats label size too. ----
  await page.selectOption('#f-abilityFontSize', '29'); // Small
  await page.waitForTimeout(150);
  const widthSmall = await statLabelInkWidth();
  await page.selectOption('#f-abilityFontSize', '42'); // Extra Large
  await page.waitForTimeout(150);
  const widthXL = await statLabelInkWidth();
  assert(widthXL > widthSmall * 1.2, `expected the Stats "Brawl" label to render noticeably wider at Extra Large (42px) than Small (29px) ability text size, got Small=${widthSmall} XL=${widthXL}`);
  ok(`Stats label size tracks the Ability Text Size dropdown live (Small width=${widthSmall}, Extra Large width=${widthXL})`);

  // ---- 1b. Long abilities force the Abilities text to auto-shrink, but
  // Stats stays put at the picked size (Extra Large) — Stats' row height
  // is generous enough that it never needs to shrink, and per design it no
  // longer tracks the Abilities auto-fit the way it used to. ----
  await page.selectOption('#f-abilityFontSize', '42');
  await page.waitForTimeout(100);
  const widthBeforeLongText = await statLabelInkWidth();
  const longText = 'This ability has a very long description that should wrap across multiple lines and force the auto-fit sizer to shrink the font so everything still fits neatly above the health bar without overlapping any other element on the card. Stats itself must stay exactly the same size regardless, since it has its own generous fixed row height and no longer shrinks along with the Abilities text.';
  await textInputs[0].fill(longText);
  await page.click('#add-ability');
  const nameInputs2 = await page.$$('.ability-item input[data-field="name"]');
  const textInputs2 = await page.$$('.ability-item textarea[data-field="text"]');
  await nameInputs2[1].fill('Cursed Presence');
  await textInputs2[1].fill(longText);
  await page.click('#add-ability');
  const nameInputs3 = await page.$$('.ability-item input[data-field="name"]');
  const textInputs3 = await page.$$('.ability-item textarea[data-field="text"]');
  await nameInputs3[2].fill('Iron Will');
  await textInputs3[2].fill(longText);
  await page.waitForTimeout(250);
  const widthAfterLongText = await statLabelInkWidth();
  assert(Math.abs(widthAfterLongText - widthBeforeLongText) <= 2, `expected the Stats label to stay the same width (Extra Large, fixed) even once the Abilities text is long enough to need its own auto-shrink, got before=${widthBeforeLongText} after=${widthAfterLongText}`);
  ok(`Stats label stays fixed at the picked size regardless of the Abilities auto-fit (before=${widthBeforeLongText}, after=${widthAfterLongText})`);

  // ---- 2. Stats row background reaches the card's right edge. ----
  await page.click('#btn-new-card');
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'ivory');
  await page.waitForTimeout(150);
  const nearRightEdgePixel = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    // 6px in from the card's right edge (750), well clear of the outer
    // border stroke, at the Brawl row's y.
    return [...ctx.getImageData(744, 150, 1, 1).data.slice(0, 3)];
  });
  const plainBg = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return [...ctx.getImageData(744, 30, 1, 1).data.slice(0, 3)]; // name-bar-free plain background, same x
  });
  const diffFromPlain = nearRightEdgePixel.reduce((s, v, i) => s + Math.abs(v - plainBg[i]), 0);
  assert(diffFromPlain > 15, `expected the Stats tint background to reach all the way to the card's right edge (should differ from plain background), got tint=${nearRightEdgePixel} vs plain=${plainBg}`);
  ok('Stats row background now extends all the way to the card\'s right edge');

  // ---- 3. Stats starts at x=440 (was x=340) — the freed width goes to
  // the portrait. Confirm via a transition scan at the Brawl row's y: just
  // left of 440 is portrait/background, at/after 440 is Stats tint. ----
  const justBeforeStats = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return [...ctx.getImageData(437, 150, 1, 1).data.slice(0, 3)];
  });
  const justAfterStats = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    return [...ctx.getImageData(443, 150, 1, 1).data.slice(0, 3)];
  });
  const transitionDiff = justAfterStats.reduce((s, v, i) => s + Math.abs(v - justBeforeStats[i]), 0);
  assert(transitionDiff > 15, `expected a clear color transition right around x=440 (Stats' new left edge), got before=${justBeforeStats} after=${justAfterStats}`);
  ok('Stats table now starts at x=440 (previously x=340), confirmed by the color transition at that boundary');

  // ---- 4. Portrait's left edge lines up with the Abilities text margin
  // (x=28), and its right edge stays flush to Stats (x=440). ----
  const box = await page.evaluate(() => getPortraitBox());
  assert.strictEqual(box.x, 28, `expected the portrait box to start at x=28 (matching the Abilities text's left margin), got x=${box.x}`);
  assert.strictEqual(box.x + box.w, 440, `expected the portrait box's right edge to stay flush to Stats (x=440), got ${box.x + box.w}`);
  ok('Portrait\'s left edge lines up with the Abilities text margin (x=28), right edge flush to Stats (x=440)');

  console.log('\nAll verify31 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
