// verify29.js — Level badge improvements, across several rounds of
// feedback on this same element:
// 1. (original) The level number's font size increased (44px -> 60px) so
//    it filled the (then 46px-radius) badge circle with much less
//    surrounding empty space.
// 2. (original) Classical's badge fill changed from a near-white cream
//    (#fdf8f0) to a warm bronze/brown medallion look (fill #8a5a34, dark
//    ink ring #3d2614) — the old white circle drew the eye away from the
//    rest of the aged-parchment card.
// 3. (later) The whole badge shrank (radius 46->38) because it read too
//    large on the printed card — see verify26.js's own history.
// 4. (later still) The badge became a 3-color medallion — outer ring,
//    colored band (the theme's existing badgeRing/badgeFill, unchanged),
//    and a new inner white circle (radius 27) with the level number
//    always drawn black-on-white instead of white-on-theme-color — per
//    explicit user request, matching the look of the official printed
//    cards. This moved the real "does the glyph stay clear of its
//    container" boundary from the ring's inner edge to the new white
//    circle's own edge, and flipped the glyph's color from white to
//    black, so the pixel-scan checks below look for black ink within the
//    white circle now, not white ink within the ring.
// 5. (later still) The digit grew again (36px -> 56px) per explicit user
//    feedback that it needed to stand out more, at a flat size with no
//    smaller fallback for a hypothetical multi-digit value — the user
//    confirmed the Level field has always been single-digit in practice,
//    on older saved cards too, so there's no real case to size around.
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

  // ---- 1. The level number fills a good portion of the new white inner
  // circle (radius 27) without crowding its edge. The digit is always
  // black now, regardless of theme — scan for black ink rather than the
  // old white-on-accent-fill text. Bounding the scan to a box just past
  // the white circle's own radius (not out to the old 46px badge radius)
  // keeps this from ever picking up the ring, which sits well outside it
  // (ring's inner edge is ~36px from center). ----
  async function blackInkReach(cardType, level) {
    await page.selectOption('#f-cardType', cardType);
    await page.selectOption('#f-level', String(level));
    await page.waitForTimeout(120);
    return page.evaluate(() => {
      const ctx = document.getElementById('card-canvas').getContext('2d');
      const cx = 85, cy = 59;
      let maxDist = 0;
      for (let y = cy - 30; y <= cy + 30; y++) {
        for (let x = cx - 30; x <= cx + 30; x++) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          if (d[0] < 60 && d[1] < 60 && d[2] < 60 && d[3] > 200) {
            const dist = Math.hypot(x - cx, y - cy);
            if (dist > maxDist) maxDist = dist;
          }
        }
      }
      return maxDist;
    });
  }

  // Compare against what a smaller, earlier font size (36px, the size this
  // badge used just before the "make the number bigger" feedback) would
  // have produced, rendered the same way on an isolated offscreen canvas,
  // rather than relying on a guessed constant.
  const [reach4, reachOld36] = await Promise.all([
    blackInkReach('Leader', 4),
    page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const cx = 100, cy = 100;
      ctx.fillStyle = '#000000';
      ctx.font = '700 36px Rajdhani, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('4', cx, cy);
      const img = ctx.getImageData(0, 0, 200, 200).data;
      let maxDist = 0;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          const idx = (y * 200 + x) * 4;
          if (img[idx] < 60 && img[idx + 1] < 60 && img[idx + 2] < 60 && img[idx + 3] > 200) {
            const d = Math.hypot(x - cx, y - cy);
            if (d > maxDist) maxDist = d;
          }
        }
      }
      return maxDist;
    }),
  ]);
  assert(reach4 > reachOld36, `expected the larger level digit font to reach further from badge center than the old 36px font (${reachOld36.toFixed(1)}px), got ${reach4.toFixed(1)}px`);
  assert(reach4 < 27, `expected the level digit to stay inside the white inner circle (radius 27), got ${reach4.toFixed(1)}px`);
  ok(`Level number now reaches ${reach4.toFixed(1)}px from the badge center (up from ${reachOld36.toFixed(1)}px at the old 36px font) while staying inside the 27px-radius white circle`);

  // (A two-digit worst-case check — "20", the highest a pre-dropdown saved
  // card could once carry — used to live here. Per explicit user
  // confirmation, the Level field has always been single-digit in
  // practice, including on older saved cards, so there's no real scenario
  // left to protect against and the check was removed rather than testing
  // a case that doesn't happen.)

  // ---- 2. Classical's badge band is still its own warm bronze tone, not
  // the (now white) inner circle. ----
  await page.selectOption('#f-theme', 'classical');
  await page.waitForTimeout(150);
  const badgeFillPixel = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    // A point in the colored band between the white inner circle (radius
    // 27) and the ring's own inner edge (~36px from center) — 31px left of
    // center (badge center is (85,59)) sits safely in that band, clear of
    // both the white circle and the ring stroke.
    return [...ctx.getImageData(54, 59, 1, 1).data.slice(0, 3)];
  });
  assert(closeTo(badgeFillPixel, '#8a5a34', 12), `expected Classical's badge band to be the bronze tone #8a5a34, got rgb(${badgeFillPixel})`);
  ok('Classical badge band is the bronze/brown medallion color');

  const oldCreamDiff = Math.abs(badgeFillPixel[0] - 0xfd) + Math.abs(badgeFillPixel[1] - 0xf8) + Math.abs(badgeFillPixel[2] - 0xf0);
  assert(oldCreamDiff > 100, `expected the badge band to be clearly different from the old near-white cream (#fdf8f0), got rgb(${badgeFillPixel})`);
  ok('Classical badge band is clearly distinct from the old bright cream color');

  // ---- 3. The level number itself is always black-on-white now,
  // regardless of theme (even Classical, which used to tint the text).
  // Scans a small box around the badge center for any black-ish pixel
  // rather than sampling one exact point, since not every digit's glyph
  // covers the dead-center pixel. ----
  const hasBlackDigitInk = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    const cx = 85, cy = 59;
    for (let y = cy - 10; y <= cy + 10; y++) {
      for (let x = cx - 10; x <= cx + 10; x++) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (d[0] < 60 && d[1] < 60 && d[2] < 60 && d[3] > 200) return true;
      }
    }
    return false;
  });
  assert(hasBlackDigitInk, 'expected to find black level-digit ink near the badge center, even under the Classical theme');
  ok('Level digit renders black, even under the Classical theme');

  console.log('\nAll verify29 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
