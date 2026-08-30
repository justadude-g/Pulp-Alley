// verify34.js — Zoom can go below 1x (down to 0.3x) to shrink an uploaded
// portrait and show more of it, instead of the old 1x floor which forced
// every image to be cropped to fill the box ("cover" fit) with no way to
// back off. Below 1x the box's own background/tint fill (already painted
// for the transparent-PNG case) shows through as visible padding around an
// otherwise fully opaque image too.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8875;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }
function colorDist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. The Zoom slider's floor is now well below 1x. ----
  const zoomMin = await page.$eval('#f-zoom', el => +el.min);
  assert(zoomMin <= 0.3, `expected the Zoom slider's min to allow zooming out to 0.3x or lower, got min=${zoomMin}`);
  ok(`Zoom slider now allows zooming out to ${zoomMin}x (previously floored at 1x)`);

  // ---- 2. Upload a fully opaque solid-color square. At the default 1x
  // zoom (unchanged "cover" behavior), it fills the portrait box edge to
  // edge — sampling near all four sides should be pure image color. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-theme', 'light');
  const fixture = path.join(__dirname, 'fixture-opaque-square.png');
  await page.setInputFiles('#f-portrait', fixture);
  await page.waitForTimeout(400);

  const BLUE = [0, 128, 255];
  // PORTRAIT box is {x:28, y:132, w:412, h:430}; sample points a few px in
  // from the middle of each flat side (not the rounded corners).
  const edgePoints = {
    left: [28 + 6, 132 + 215],
    right: [28 + 412 - 6, 132 + 215],
    top: [28 + 206, 132 + 8],
    bottom: [28 + 206, 132 + 430 - 8],
  };
  const center = [28 + 206, 132 + 215];

  async function samplePoint([x, y]) {
    return page.evaluate(([px, py]) => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      return [...ctx.getImageData(px, py, 1, 1).data.slice(0, 3)];
    }, [x, y]);
  }

  for (const [name, pt] of Object.entries(edgePoints)) {
    const rgb = await samplePoint(pt);
    assert(colorDist(rgb, BLUE) < 20, `expected the ${name} edge of the portrait box to be covered by the opaque blue image at default 1x zoom, got rgb(${rgb})`);
  }
  ok('At default 1x Zoom, an opaque upload still covers the portrait box edge-to-edge (unchanged behavior)');

  // ---- 3. Zoom out to 0.4x: the image should shrink to a small centered
  // square, leaving the box's own background visible as padding on all
  // four sides, while the center still shows the image. ----
  await page.fill('#f-zoom', '0.4');
  await page.dispatchEvent('#f-zoom', 'input');
  await page.waitForTimeout(200);

  for (const [name, pt] of Object.entries(edgePoints)) {
    const rgb = await samplePoint(pt);
    assert(colorDist(rgb, BLUE) > 40, `expected the ${name} edge of the portrait box to show background padding (not the blue image) once zoomed out to 0.4x, got rgb(${rgb})`);
  }
  const centerAtLowZoom = await samplePoint(center);
  assert(colorDist(centerAtLowZoom, BLUE) < 20, `expected the box's center to still show the (now smaller) blue image at 0.4x zoom, got rgb(${centerAtLowZoom})`);
  ok('Zooming out to 0.4x shrinks the image and reveals the card\'s own background as padding around it, while the image stays visible and centered');

  // ---- 4. Reset restores the default 1x "cover" fit (no padding). ----
  await page.click('#reset-portrait');
  await page.waitForTimeout(200);
  const zoomAfterReset = await page.inputValue('#f-zoom');
  assert.strictEqual(zoomAfterReset, '1', `expected Reset to put Zoom back to 1x, got ${zoomAfterReset}`);
  const rightEdgeAfterReset = await samplePoint(edgePoints.right);
  assert(colorDist(rightEdgeAfterReset, BLUE) < 20, `expected Reset to restore full edge-to-edge coverage, got rgb(${rightEdgeAfterReset})`);
  ok('Reset restores the default 1x zoom with full edge-to-edge coverage (no padding)');

  console.log('\nAll verify34 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
