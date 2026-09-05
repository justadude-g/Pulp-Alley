// verify54.js — Associate Card Type (Core Rules p. 27-28): the new
// landscape card renderer, its card-type-aware portrait box/crop, the drag
// coordinate fix that riding along required, and the Print Sheet's
// deliberate exclusion of Associate cards (explicitly deferred — see
// README) rather than stretching a landscape PNG into a portrait slot.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8904;
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

  await page.selectOption('#f-cardType', 'Associate');
  await page.fill('#f-name', 'The Concierge');
  await page.waitForTimeout(150);

  // ---- 1. Landscape canvas, and a card-type-aware portrait box distinct
  // from the standard character-card PORTRAIT. ----
  const canvasSize = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    return { w: c.width, h: c.height };
  });
  assert.strictEqual(canvasSize.w, 1050, `expected an Associate card's canvas to be 1050px wide, got ${canvasSize.w}`);
  assert.strictEqual(canvasSize.h, 750, `expected an Associate card's canvas to be 750px tall, got ${canvasSize.h}`);
  ok('Associate cards render on a 1050x750 landscape canvas (ASSOC_CARD_W x ASSOC_CARD_H)');

  const boxes = await page.evaluate(() => ({
    associate: getPortraitBox('Associate'),
    leader: getPortraitBox('Leader'),
    noArg: getPortraitBox(),
  }));
  assert.deepStrictEqual(boxes.associate, { x: 640, y: 114, w: 370, h: 420 }, `expected getPortraitBox('Associate') to return ASSOCIATE_PORTRAIT, got ${JSON.stringify(boxes.associate)}`);
  assert.deepStrictEqual(boxes.leader, { x: 28, y: 132, w: 412, h: 430 }, `expected getPortraitBox('Leader') to return the standard character-card PORTRAIT, got ${JSON.stringify(boxes.leader)}`);
  assert.deepStrictEqual(boxes.noArg, boxes.leader, `expected getPortraitBox() with no argument to default to the standard PORTRAIT (backward-compatible with existing callers/tests), got ${JSON.stringify(boxes.noArg)}`);
  // Top-aligned with the Abilities block (ASSOCIATE_HEADER_H + 24 = 114),
  // per explicit user feedback that centering it lower left a gap the
  // Abilities text's own top didn't have.
  assert.strictEqual(boxes.associate.y, 114, 'expected the Associate portrait box to be top-aligned with the Abilities block, not vertically centered on the card');
  assert.strictEqual(boxes.associate.x + boxes.associate.w, 1010, 'expected a 40px margin between the Associate portrait\'s right edge and the card\'s right edge (1050)');
  ok('getPortraitBox() is card-type-aware: Associate cards get a distinct, top-aligned, right-margined box; every other Card Type is unaffected');

  // ---- 2. The header ("ASSOCIATE:" + name) and Abilities text actually
  // render ink — a smoke check alongside the geometry proof above. ----
  await page.click('#add-ability');
  const nameInputs = await page.$$('.ability-item input[data-field="name"]');
  const textInputs = await page.$$('.ability-item textarea[data-field="text"]');
  await nameInputs[0].fill('Got Your Back');
  await textInputs[0].fill('You gain +1 Backup point.');
  await page.waitForTimeout(200);

  const inkChecks = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    function hasInkInRegion(x, y, w, h, bg) {
      const data = ctx.getImageData(x, y, w, h).data;
      for (let i = 0; i < data.length; i += 4) {
        const diff = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
        if (diff > 40) return true;
      }
      return false;
    }
    const bg = [...ctx.getImageData(1040, 5, 1, 1).data.slice(0, 3)]; // corner, always plain background
    return {
      header: hasInkInRegion(35, 20, 400, 100, bg),
      abilities: hasInkInRegion(35, 170, 500, 100, bg),
    };
  });
  assert(inkChecks.header, 'expected the header area ("ASSOCIATE:" label + name) to render visible ink');
  assert(inkChecks.abilities, 'expected the Abilities area to render visible ink for a filled-in ability');
  ok('Header ("ASSOCIATE:" + name) and Abilities both render visible content on an Associate card');

  // ---- 3. Portrait crop uses the Associate box, not the character-card
  // one — saving crops the stored portrait to 370x420 (ASSOCIATE_PORTRAIT),
  // not 412x430 (the standard PORTRAIT), which would be the wrong aspect
  // ratio for this card's portrait slot. ----
  const fixture = path.join(__dirname, 'fixture-opaque-square.png');
  await page.setInputFiles('#f-portrait', fixture);
  await page.waitForTimeout(300);
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);

  const cropSize = await page.evaluate(async () => {
    const cards = await getAllCards();
    const record = cards.find(c => c.formData?.name === 'The Concierge');
    if (!record || !record.portraitDataURL) return null;
    const img = await loadImage(record.portraitDataURL);
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
  assert.deepStrictEqual(cropSize, { w: 370, h: 420 }, `expected the saved Associate card's cropped portrait to match ASSOCIATE_PORTRAIT (370x420), got ${JSON.stringify(cropSize)}`);
  ok('Saving an Associate card crops its portrait to the Associate portrait box (370x420), not the standard character-card box');

  // ---- 4. Drag coordinate fix: dragging on a landscape canvas must scale
  // by the canvas's own current pixel size (1050x750), not the portrait
  // character-card CARD_W/CARD_H constants (750x1050) — using the wrong
  // constants here would silently under-scale every drag on an Associate
  // card by a factor of 750/1050 ≈ 0.71. ----
  const canvasBox = await page.locator('#card-canvas').boundingBox();
  const scaleX = canvasSize.w / canvasBox.width; // 1050 / css-width
  // Start the drag from the portrait box's on-screen center.
  const startCssX = canvasBox.x + (boxes.associate.x + boxes.associate.w / 2) * (canvasBox.width / canvasSize.w);
  const startCssY = canvasBox.y + (boxes.associate.y + boxes.associate.h / 2) * (canvasBox.height / canvasSize.h);
  const dragCssDx = 20;
  await page.mouse.move(startCssX, startCssY);
  await page.mouse.down();
  await page.mouse.move(startCssX + dragCssDx, startCssY, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const offsetXAfterDrag = await page.evaluate(() => state.portraitView.offsetX);
  const expectedCorrect = dragCssDx * scaleX; // ~ 20 * (1050/canvas-css-width)
  const expectedIfBuggy = dragCssDx * (750 / canvasBox.width); // the old, wrong CARD_W-based scale
  assert(Math.abs(offsetXAfterDrag - expectedCorrect) < 5, `expected the drag offset to scale by the canvas's actual pixel width (1050), got offsetX=${offsetXAfterDrag}, expected ~${expectedCorrect.toFixed(1)}`);
  assert(Math.abs(offsetXAfterDrag - expectedIfBuggy) > 8, `drag offset looks like it used the old portrait-card CARD_W constant instead of the canvas's actual width — got offsetX=${offsetXAfterDrag}, which matches the buggy ~${expectedIfBuggy.toFixed(1)} rather than the correct ~${expectedCorrect.toFixed(1)}`);
  ok(`Dragging a portrait on the landscape Associate canvas scales correctly by the canvas's own pixel size (offsetX=${offsetXAfterDrag.toFixed(1)}, expected ~${expectedCorrect.toFixed(1)})`);

  // ---- 5. Print Sheet: an Associate card is excluded (not stretched into
  // a portrait slot) — an explicit, noted, deferred follow-up. ----
  await page.click('#btn-new-card');
  await page.selectOption('#f-cardType', 'Leader');
  await page.fill('#f-name', 'A Normal Leader Card');
  await page.waitForTimeout(150);
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);

  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  // Only the 2 cards saved by this test exist, so Select All picks exactly
  // "The Concierge" (Associate) and "A Normal Leader Card" (Leader).
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  await page.click('#go-print');
  await page.waitForTimeout(300);

  const heading = await page.textContent('#print-sheet-heading');
  assert(heading.includes('not shown'), `expected the Print Sheet heading to note that the Associate card was skipped, got: "${heading}"`);
  const sheetCanvasCount = await page.evaluate(() => document.querySelectorAll('.sheet-page-canvas').length);
  assert.strictEqual(sheetCanvasCount, 1, `expected a single A4 page (only the 1 non-Associate card rendered), got ${sheetCanvasCount} pages`);
  ok(`Print Sheet excludes the Associate card and notes it in the heading ("${heading}")`);

  assert.deepStrictEqual(errors, [], `expected no page errors, got ${JSON.stringify(errors)}`);
  console.log('\nAll verify54 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
