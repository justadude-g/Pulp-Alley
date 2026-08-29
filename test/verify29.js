// verify29.js — Level badge improvements:
// 1. The level number's font size increased (44px -> 60px) so it fills the
//    46px-radius badge circle with much less surrounding empty space, while
//    a worst-case two-digit level (the Level field allowed up to 20 before
//    it became a 0-4 dropdown — see verify30.js — and old saved cards can
//    still carry such a value) still stays clear of the ring.
// 2. Classical's badge fill changed from a near-white cream (#fdf8f0) to a
//    warm bronze/brown medallion look (fill #8a5a34, dark ink ring
//    #3d2614, cream text #f5e8cf) — the old white circle drew the eye away
//    from the rest of the aged-parchment card.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8870;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }
function closeTo(rgb, hex, tol = 12) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return Math.abs(rgb[0] - r) <= tol && Math.abs(rgb[1] - g) <= tol && Math.abs(rgb[2] - b) <= tol;
}

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
  await page.waitForTimeout(150);

  // ---- 1. The level number now fills much more of the badge than before.
  // Badge is centered at (85,59) with radius 46. Measure the bounding box
  // of dark ("4" is drawn in white on Ivory's accent-filled badge, so
  // scan for the accent-colored ring / white text vs the surrounding
  // name-bar background instead) — simplest reliable signal is the
  // farthest-from-center white pixel belonging to the glyph itself.
  async function textReach(cardType, level) {
    await page.selectOption('#f-cardType', cardType);
    await page.selectOption('#f-level', String(level));
    await page.waitForTimeout(120);
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      const cx = 85, cy = 59;
      let maxDist = 0;
      for (let y = cy - 46; y <= cy + 46; y++) {
        for (let x = cx - 46; x <= cx + 46; x++) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          // White-ish text pixel (badgeText on Ivory defaults to white).
          if (d[0] > 235 && d[1] > 235 && d[2] > 235 && d[3] > 200) {
            const dist = Math.hypot(x - cx, y - cy);
            if (dist > maxDist) maxDist = dist;
          }
        }
      }
      return maxDist;
    });
  }

  // The Level field is now a 0-4 dropdown (a later change — see
  // verify30.js), so a two-digit level can no longer be typed in through
  // the UI. But old saved cards from before that change can still have a
  // two-digit value (the field used to allow up to 20), and those still
  // need to render safely — so this renders directly through the app's
  // own renderCard()/collectFormData() pipeline with an injected level,
  // simulating what happens when such a legacy card is opened or printed.
  async function textReachRawLevel(level) {
    return page.evaluate((lvl) => {
      const canvas = document.getElementById('card-canvas');
      const data = collectFormData();
      data.portraitImg = null;
      data.portraitView = { scale: 1, offsetX: 0, offsetY: 0 };
      data.level = lvl;
      renderCard(canvas, data);
      const ctx = canvas.getContext('2d');
      const cx = 85, cy = 59;
      let maxDist = 0;
      for (let y = cy - 46; y <= cy + 46; y++) {
        for (let x = cx - 46; x <= cx + 46; x++) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          if (d[0] > 235 && d[1] > 235 && d[2] > 235 && d[3] > 200) {
            const dist = Math.hypot(x - cx, y - cy);
            if (dist > maxDist) maxDist = dist;
          }
        }
      }
      return maxDist;
    }, level);
  }

  // Compare directly against what the OLD 44px font would have produced,
  // rendered the same way on an isolated offscreen canvas, rather than
  // relying on a guessed constant.
  const [reach4, reachOld44] = await Promise.all([
    textReach('Leader', 4),
    page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const cx = 100, cy = 100;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 44px Rajdhani, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('4', cx, cy + 3);
      const img = ctx.getImageData(0, 0, 200, 200).data;
      let maxDist = 0;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          const idx = (y * 200 + x) * 4;
          if (img[idx] > 235 && img[idx + 1] > 235 && img[idx + 2] > 235 && img[idx + 3] > 200) {
            const d = Math.hypot(x - cx, y - cy);
            if (d > maxDist) maxDist = d;
          }
        }
      }
      return maxDist;
    }),
  ]);
  assert(reach4 > reachOld44, `expected the larger 60px level digit to reach further from badge center than the old 44px font (${reachOld44.toFixed(1)}px), got ${reach4.toFixed(1)}px`);
  ok(`Level number now reaches ${reach4.toFixed(1)}px from the badge center, up from ${reachOld44.toFixed(1)}px at the old 44px font size — fills the circle better`);

  // ---- 2. A worst-case two-digit level ("20", the highest a pre-dropdown
  // saved card could have) still stays clear of the badge ring (ring is
  // centered on radius 46, 4px wide, so its inner edge is ~44px from
  // center). ----
  const reach20 = await textReachRawLevel(20);
  assert(reach20 < 42, `expected "20" (max legacy level) to stay clear of the badge ring (~44px from center), got ${reach20}`);
  ok(`Worst-case two-digit level "20" stays clear of the ring (reaches ${reach20.toFixed(1)}px, ring inner edge ~44px)`);

  // ---- 3. Classical's badge is no longer a bright white/cream circle —
  // it now fills with a warm bronze tone. ----
  await page.selectOption('#f-theme', 'classical');
  await page.waitForTimeout(150);
  const badgeFillPixel = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    // A point inside the badge that's fill, not text or ring: (50, 59) —
    // 35px left of center (badge center is (85,59), radius 46) clears the
    // level-number glyph horizontally regardless of which digit(s) are
    // shown, and stays well inside the ring (~44px inner edge).
    return [...ctx.getImageData(50, 59, 1, 1).data.slice(0, 3)];
  });
  assert(closeTo(badgeFillPixel, '#8a5a34', 12), `expected Classical's badge fill to be the new bronze tone #8a5a34, got rgb(${badgeFillPixel})`);
  ok('Classical badge fill is the new bronze/brown medallion color, not the old near-white cream');

  const oldCreamDiff = Math.abs(badgeFillPixel[0] - 0xfd) + Math.abs(badgeFillPixel[1] - 0xf8) + Math.abs(badgeFillPixel[2] - 0xf0);
  assert(oldCreamDiff > 100, `expected the badge fill to be clearly different from the old near-white cream (#fdf8f0), got rgb(${badgeFillPixel})`);
  ok('Classical badge fill is clearly distinct from the old bright cream color');

  console.log('\nAll verify29 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
