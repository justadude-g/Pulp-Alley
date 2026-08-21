// verify16.js — cards render at Gamegenic Standard sleeve size (64mm x 89mm)
// so a Print Sheet page printed at 100% drops cards straight into a sleeve.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8838;
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

  // ---- 1. Card canvas is sized to 64mm x 89mm at 300dpi ----
  const { w, h } = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    return { w: c.width, h: c.height };
  });
  const wMm = (w / 300) * 25.4;
  const hMm = (h / 300) * 25.4;
  assert(Math.abs(wMm - 64) < 0.1, `expected card width ~64mm at 300dpi, got ${wMm.toFixed(3)}mm (${w}px)`);
  assert(Math.abs(hMm - 89) < 0.1, `expected card height ~89mm at 300dpi, got ${hMm.toFixed(3)}mm (${h}px)`);
  ok(`Card canvas is ${w}x${h}px = ${wMm.toFixed(2)}mm x ${hMm.toFixed(2)}mm at 300dpi (Gamegenic Standard sleeve target: 64x89mm)`);

  // ---- 2. CARD_W/CARD_H (used everywhere else — roster grid, drag math,
  // portrait box hit-testing) match the canvas's own actual dimensions, so
  // nothing in the app is still assuming the old 750x1050 poker-card size. ----
  const constants = await page.evaluate(() => ({ CARD_W, CARD_H }));
  assert.strictEqual(constants.CARD_W, w, 'expected CARD_W constant to match the live canvas width');
  assert.strictEqual(constants.CARD_H, h, 'expected CARD_H constant to match the live canvas height');
  ok('CARD_W/CARD_H constants match the live card canvas exactly');

  // ---- 3. The 3x3 A4 print sheet grid still fits within the page at the
  // new, slightly larger card size — no card or crop mark should be clipped
  // off the physical A4 page. ----
  const layout = await page.evaluate(() => {
    const slots = gridSlots();
    return {
      A4_W, A4_H,
      slots,
      last: slots[slots.length - 1],
    };
  });
  for (const slot of layout.slots) {
    assert(slot.x >= 0 && slot.y >= 0, `expected every card slot to stay on-page, got x=${slot.x} y=${slot.y}`);
    assert(slot.x + slot.w <= layout.A4_W, `expected card right edge (${slot.x + slot.w}) within A4 width (${layout.A4_W})`);
    assert(slot.y + slot.h <= layout.A4_H, `expected card bottom edge (${slot.y + slot.h}) within A4 height (${layout.A4_H})`);
  }
  assert.strictEqual(layout.slots.length, 9, 'expected a 3x3 = 9 card grid');
  ok(`All 9 print-sheet card slots fit on the A4 page (${layout.A4_W}x${layout.A4_H}px) with no clipping`);

  // Sanity: margins around the grid are still comfortably inside typical
  // home-printer unprintable-area limits (not asserting an exact value,
  // just that the grid isn't crammed edge-to-edge or overflowing).
  const marginX = layout.slots[0].x;
  const marginY = layout.slots[0].y;
  assert(marginX > 20 && marginY > 20, `expected a real margin around the grid, got marginX=${marginX} marginY=${marginY}`);
  ok(`Page margins around the grid: ${marginX}px (${(marginX / 300 * 25.4).toFixed(1)}mm) horizontal, ${marginY}px (${(marginY / 300 * 25.4).toFixed(1)}mm) vertical`);

  console.log('\nAll verify16 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
