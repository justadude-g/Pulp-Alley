// verify19.js — Portrait Image relocated next to Save/Download/New (out of
// the long scrolling form, into the sticky preview panel), and dragging an
// image file from the OS directly onto the card preview now loads it as
// the portrait instead of navigating the tab to its file:// URL.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const fs = require('fs');
const PORT = 8843;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const navigations = [];
  page.on('framenavigated', f => navigations.push(f.url()));
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Portrait Image now lives in the preview panel, not the form ----
  const inForm = await page.evaluate(() => !!document.querySelector('#card-form #f-portrait'));
  const inPreviewPanel = await page.evaluate(() => !!document.querySelector('#preview-panel #f-portrait'));
  assert(!inForm, 'expected #f-portrait to no longer be inside #card-form');
  assert(inPreviewPanel, 'expected #f-portrait to be inside #preview-panel');
  ok('Portrait Image input moved out of the scrolling form into the sticky preview panel');

  // Visually: the portrait input's bounding box should sit between the
  // card canvas and the Save/Download/New buttons, not below them.
  const canvasBox = await page.locator('#card-canvas').boundingBox();
  const portraitBox = await page.locator('#f-portrait').boundingBox();
  const saveBox = await page.locator('#btn-save-card').boundingBox();
  assert(portraitBox.y > canvasBox.y, 'expected the portrait input to be below the card canvas');
  assert(portraitBox.y < saveBox.y, 'expected the portrait input to be above the Save to My Cards button');
  ok('Portrait Image input sits between the card preview and the Save button, as requested');

  // ---- 2. The file-picker path still works (no regression) ----
  const fixture = path.join(__dirname, 'fixture-transparent.png');
  await page.setInputFiles('#f-portrait', fixture);
  await page.waitForTimeout(400);
  const hasPortraitAfterPicker = await page.evaluate(() => typeof state !== 'undefined' && !!state.portraitImg);
  assert(hasPortraitAfterPicker, 'expected choosing a file via the picker to still set the portrait');
  ok('Choosing a file via the file picker still works');

  // "New Card" should fully clear the (now form-external) file input, not
  // just hide the zoom controls.
  await page.click('#btn-new-card');
  await page.waitForTimeout(200);
  const fileInputValueAfterNew = await page.evaluate(() => document.getElementById('f-portrait').value);
  assert.strictEqual(fileInputValueAfterNew, '', 'expected New Card to clear the file input value');
  ok('"New Card" clears the portrait file input (no stale filename left behind)');

  // ---- 3. Dragging an image file onto the card preview loads it as the
  // portrait, and does NOT navigate the tab to a file:// URL. ----
  const fileBuffer = fs.readFileSync(fixture);
  const base64 = fileBuffer.toString('base64');
  const urlBeforeDrop = page.url();

  await page.evaluate(async (b64) => {
    // Build a real File + DataTransfer in-page, matching what a browser
    // constructs for an actual OS drag-and-drop of an image file.
    const byteChars = atob(b64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const file = new File([bytes], 'dropped-portrait.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);

    const panel = document.getElementById('preview-panel');
    const mk = (type) => new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
    panel.dispatchEvent(mk('dragenter'));
    panel.dispatchEvent(mk('dragover'));
    panel.dispatchEvent(mk('drop'));
  }, base64);
  await page.waitForTimeout(400);

  assert.strictEqual(page.url(), urlBeforeDrop, 'expected the tab to stay on the app after a file drop, not navigate to the file');
  assert(navigations.every(u => !u.startsWith('file://')), `expected no navigation to a file:// URL, got: ${JSON.stringify(navigations)}`);
  ok('Dropping an image file does not navigate the tab to its file:// URL (the reported bug)');

  const portraitLoadedAfterDrop = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    // The fixture is a red circle on transparent — sample its center in the
    // portrait box to confirm the dropped file actually became the portrait.
    const d = ctx.getImageData(24 + 150, 132 + 215, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  assert(portraitLoadedAfterDrop[0] > 150 && portraitLoadedAfterDrop[1] < 150,
    `expected the dropped image to render as the portrait (reddish center), got rgb(${portraitLoadedAfterDrop})`);
  ok('Dropped image is actually loaded and rendered as the card portrait');

  // Drag-over highlight class is added and cleared correctly.
  const dragOverAfterDrop = await page.evaluate(() => document.getElementById('preview-panel').classList.contains('drag-over'));
  assert.strictEqual(dragOverAfterDrop, false, 'expected the drag-over highlight to clear after drop');
  ok('Drag-over highlight clears after the drop completes');

  console.log('\nAll verify19 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
