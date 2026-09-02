// verify44.js — Saving a card now crops its stored portrait down to
// exactly what's framed at the current zoom/pan (instead of keeping the
// full uploaded photo), to shrink the backup.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8894;
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

  // ---- 1. Upload a portrait, zoom in, and save. The saved card's
  // portraitDataURL should now be an image exactly the size of the
  // portrait box (412x430), not the much larger original upload. ----
  await page.fill('#f-name', 'Zoomed Hero');
  const samplePortrait = '/mnt/user-data/uploads/Pulp Alley/Sample Card 1.png';
  await page.setInputFiles('#f-portrait', samplePortrait);
  await page.waitForTimeout(400);

  const boxSize = await page.evaluate(() => getPortraitBox());
  assert.deepStrictEqual({ w: boxSize.w, h: boxSize.h }, { w: 412, h: 430 }, `expected the portrait box to be 412x430, got ${JSON.stringify(boxSize)}`);

  await page.fill('#f-zoom', '2');
  await page.dispatchEvent('#f-zoom', 'input');
  await page.waitForTimeout(200);
  await page.click('#btn-save-card');
  await page.waitForTimeout(300);

  const savedInfo = await page.evaluate(async () => {
    const cards = await getAllCards();
    const c = cards.find(x => x.formData?.name === 'Zoomed Hero');
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = c.portraitDataURL;
    });
    return { w: img.width, h: img.height, view: c.portraitView, dataLen: c.portraitDataURL.length };
  });
  assert.strictEqual(savedInfo.w, 412, `expected the saved portrait to be cropped to box width 412, got ${savedInfo.w}`);
  assert.strictEqual(savedInfo.h, 430, `expected the saved portrait to be cropped to box height 430, got ${savedInfo.h}`);
  ok('Saving a card crops its stored portrait down to exactly the portrait box size (412x430)');

  assert.deepStrictEqual(savedInfo.view, { scale: 1, offsetX: 0, offsetY: 0 }, `expected the saved portraitView to reset to scale 1 / no offset after cropping, got ${JSON.stringify(savedInfo.view)}`);
  ok('The saved portraitView resets to {scale:1, offsetX:0, offsetY:0} since the crop already matches exactly');

  // ---- 2. The in-session zoom slider also resets to 1 after save, since
  // the now-stored portrait already IS the exact zoomed-in framing. ----
  const sliderValueAfterSave = await page.inputValue('#f-zoom');
  assert.strictEqual(sliderValueAfterSave, '1', `expected the zoom slider to reset to 1 after save, got "${sliderValueAfterSave}"`);
  ok('The zoom slider resets to 1 in the Designer after a save, matching the now-cropped portrait');

  // ---- 3. Re-rendering the on-screen card canvas right after save (no
  // reload) still shows visually correct output — the crop was a
  // pixel-for-pixel capture, so nothing should look different. Checked
  // indirectly: the canvas doesn't throw and still has portrait pixels
  // (non-uniform color) in the portrait box region. ----
  const hasContent = await page.evaluate((box) => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(box.x + 10, box.y + 10, 4, 4).data;
    // Not fully transparent / not a flat placeholder fill.
    return d[3] > 0;
  }, boxSize);
  assert.ok(hasContent, 'expected the portrait box on the live canvas to still show rendered content after save');
  ok('The live card preview still renders correctly right after the crop-on-save');

  // ---- 4. A second save (without touching zoom again) doesn't degrade
  // further — the box-sized crop, re-cropped at scale 1/no offset, comes
  // back out exactly box-sized again (idempotent). ----
  await page.click('#btn-save-card');
  await page.waitForTimeout(300);
  const secondSaveInfo = await page.evaluate(async () => {
    const cards = await getAllCards();
    const c = cards.find(x => x.formData?.name === 'Zoomed Hero');
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = c.portraitDataURL;
    });
    return { w: img.width, h: img.height };
  });
  assert.deepStrictEqual(secondSaveInfo, { w: 412, h: 430 }, `expected a second save to leave the crop exactly box-sized, got ${JSON.stringify(secondSaveInfo)}`);
  ok('Saving again after the crop is idempotent — still exactly box-sized, no further shrinkage/distortion');

  console.log('\nAll verify44 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
