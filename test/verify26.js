// verify26.js — bigger print legibility: the Card Type tag (top right) and
// the Health track pills (bottom) render at a larger font size than
// before (20px -> 23px, 27px -> 30px in cardRenderer.js), since the user
// found them hard to read on an actual printed sheet.
//
// The Card Type tag was later removed from character cards entirely (per
// explicit user request, along with centering the Name text) — it only
// renders on Asset cards (Gear/Contacts/Backup/Minions/Cult/Gifts) now, via
// renderAssetCard's own copy of the same pill code. Section 1 below tests
// that pill on an Asset card type ('Gear') instead of 'Leader'. Section 2
// (Health track pills) is unaffected — Health only exists on character
// cards, so it still tests against 'Leader'. The old worst-case section 3
// used to test the pill and the Health chain together on the same
// (Follower) card; since those two elements no longer coexist on one card
// type, that's now two separate checks (3a: widest Asset Card Type label
// clears the pill's own left-side margin; 3b: the Follower/d12 Health
// chain, unchanged from before).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8866;
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

  await page.selectOption('#f-cardType', 'Gear');
  await page.selectOption('#f-theme', 'light');
  await page.waitForTimeout(150);

  // ---- 1. Card Type tag pill (Asset cards only — see header comment):
  // right edge is always CARD_W-24=732 (independent of font size, since
  // the pill is right-anchored), so its rendered width is just 732 minus
  // wherever the pill visually starts. Scan for that left edge at the
  // pill's vertical middle. ----
  const OLD_PILLW_20PX = 93; // "LEADER" at the previous 20px font + old 32px padding — still a valid size baseline, just measured against a different (now pill-bearing) Card Type
  const typeTagScan = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    // Scan at the pill's own vertical center (NAME_BAR_H/2+2 — the pill's
    // py is derived from that value, no longer a fixed y=36) rather than a
    // hardcoded row, so this doesn't silently stop measuring the real pill
    // if its position shifts again.
    const midY = Math.round(NAME_BAR_H / 2 + 2);
    const bg = ctx.getImageData(500, midY, 1, 1).data; // plain background, left of the pill
    const isBg = (x) => {
      const d = ctx.getImageData(x, midY, 1, 1).data;
      return Math.abs(d[0] - bg[0]) + Math.abs(d[1] - bg[1]) + Math.abs(d[2] - bg[2]) <= 4;
    };
    // Scan leftward from clear of the pill's right side (x=740): first skip
    // the background pixels to find where the pill actually starts (its
    // right edge), then keep going until background resumes on the far
    // side — that's the pill's left edge.
    let x = 740;
    while (x >= 500 && isBg(x)) x--;
    while (x >= 500 && !isBg(x)) x--;
    return { leftEdge: x + 1, rightEdge: 732 };
  });
  const measuredPillW = typeTagScan.rightEdge - typeTagScan.leftEdge;
  assert(measuredPillW > OLD_PILLW_20PX + 5,
    `expected the Card Type pill to render noticeably wider than the old 20px-font width (${OLD_PILLW_20PX}px) now that the font is larger, got ${measuredPillW}px`);
  ok(`Card Type tag pill is now ${measuredPillW}px wide (was ~${OLD_PILLW_20PX}px at the old font size) — text is larger`);

  // Pill height similarly grew (32px -> 36px) — scan vertically at the
  // pill's horizontal middle for the same reason.
  const typeTagHeight = await page.evaluate(({ leftEdge, rightEdge }) => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    const midX = Math.round((leftEdge + rightEdge) / 2);
    // y=2, not y=0: the top 1-2px of the card carry the outer border-stroke
    // pixels (drawn separately, right at the card edge), which don't match
    // the plain name-bar background used everywhere else on the card.
    const bg = ctx.getImageData(midX, 2, 1, 1).data;
    let top = null, bottom = null;
    // Scan the full name bar height (NAME_BAR_H), not just the pill's old
    // fixed position near the top — the pill's y is now derived from the
    // Name text's own vertical center, so it no longer sits in a fixed
    // spot near y=16-56.
    for (let y = 2; y < NAME_BAR_H - 4; y++) {
      const d = ctx.getImageData(midX, y, 1, 1).data;
      const diff = Math.abs(d[0] - bg[0]) + Math.abs(d[1] - bg[1]) + Math.abs(d[2] - bg[2]);
      if (diff > 4) { if (top === null) top = y; bottom = y; }
    }
    return bottom - top + 1;
  }, { leftEdge: typeTagScan.leftEdge, rightEdge: typeTagScan.rightEdge });
  assert(typeTagHeight >= 34, `expected the enlarged Card Type pill to be at least ~34px tall (36px pill height), got ${typeTagHeight}px`);
  ok(`Card Type tag pill is now ${typeTagHeight}px tall`);

  // ---- 2. Health track pills (character cards only — Asset cards have no
  // Health bar, so switch back to a character Card Type here): measure the
  // actual rendered group width via pixel scan, and independently compute
  // the expected width using the same layout formula cardRenderer.js uses
  // (measureText + 26 padding per pill, 14px gaps) at the font size it's
  // supposed to be using now (30px, up from 27px), for Leader's default
  // D10/D8/D6/DOWN/OUT sequence. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  const expectedHealthWidth = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    ctx.font = '700 30px Rajdhani, Inter, sans-serif';
    const labels = ['D10', 'D8', 'D6', 'DOWN', 'OUT'];
    const gap = 14;
    let total = 0;
    labels.forEach(l => { total += Math.round(ctx.measureText(l).width) + 26 + gap; });
    return total - gap;
  });
  const oldFontHealthWidth = await page.evaluate(() => {
    const ctx = document.getElementById('card-canvas').getContext('2d');
    ctx.font = '700 27px Rajdhani, Inter, sans-serif';
    const labels = ['D10', 'D8', 'D6', 'DOWN', 'OUT'];
    const gap = 14;
    let total = 0;
    labels.forEach(l => { total += Math.round(ctx.measureText(l).width) + 26 + gap; });
    return total - gap;
  });

  const healthScan = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const y = c.height - 39; // vertical middle of the 78px health bar
    const bg = ctx.getImageData(10, y, 1, 1).data; // plain health-bar background, far left
    // Scan x=5..width-5, not the full width: the outer 1-2px carries the
    // card's own border-stroke pixels, which don't match this background
    // reference and would otherwise register as a false pill edge.
    let left = null, right = null;
    for (let x = 5; x < c.width - 5; x++) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const diff = Math.abs(d[0] - bg[0]) + Math.abs(d[1] - bg[1]) + Math.abs(d[2] - bg[2]);
      if (diff > 4) { if (left === null) left = x; right = x; }
    }
    return right - left + 1;
  });

  assert(Math.abs(healthScan - expectedHealthWidth) <= 10,
    `expected the rendered Health pill group width (${healthScan}px) to match the 30px-font layout formula (${expectedHealthWidth}px)`);
  assert(healthScan > oldFontHealthWidth + 10,
    `expected the Health pills to render noticeably wider than at the old 27px font (${oldFontHealthWidth}px), got ${healthScan}px`);
  ok(`Health track pills now span ${healthScan}px (formula predicts ${expectedHealthWidth}px at 30px font; old 27px font would give ~${oldFontHealthWidth}px)`);

  // ---- 3a. Worst case Card Type pill still fits: the longest Asset Card
  // Type label ("Contacts", 8 letters — longer than Gear/Backup/Minions/
  // Cult/Gifts) must still sit well clear of the left side of the name
  // bar. (No Name text to collide with on Asset cards per se, but this
  // keeps the same clearance check the old Follower-based version had.) ----
  await page.selectOption('#f-cardType', 'Contacts');
  await page.waitForTimeout(150);
  const worstPill = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    // Leftmost pixel of the pill must stay right of the name column's
    // reserved boundary (x=150) with real room to spare. Scan at the
    // pill's own vertical center (NAME_BAR_H/2+2 — the pill's py is
    // derived from that same value) rather than a hardcoded row.
    const pillMidY = Math.round(NAME_BAR_H / 2 + 2);
    const bg1 = ctx.getImageData(140, pillMidY, 1, 1).data;
    const isBg1 = (x) => {
      const d = ctx.getImageData(x, pillMidY, 1, 1).data;
      return Math.abs(d[0] - bg1[0]) + Math.abs(d[1] - bg1[1]) + Math.abs(d[2] - bg1[2]) <= 4;
    };
    let tx = c.width - 20; // clear of the pill's right side, in plain background
    while (tx >= 140 && isBg1(tx)) tx--;
    while (tx >= 140 && !isBg1(tx)) tx--;
    return tx + 1;
  });
  assert(worstPill > 300, `expected the widest Card Type pill ("Contacts") to still sit well clear of the name column, got left edge at x=${worstPill}`);
  ok('Worst-case Asset Card Type label ("Contacts") still fits without overflowing the name bar');

  // ---- 3b. Worst case Health die chain still fits: Follower (no pill any
  // more, but still the longest character Card Type label, so kept as the
  // card type here) with a d12 start, the longest possible die chain. ----
  await page.selectOption('#f-cardType', 'Follower');
  await page.selectOption('#f-healthStart', 'd12');
  await page.waitForTimeout(150);
  const worstHealth = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const y = c.height - 39;
    const bg2 = ctx.getImageData(10, y, 1, 1).data;
    let left = null, right = null;
    for (let x = 5; x < c.width - 5; x++) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (Math.abs(d[0] - bg2[0]) + Math.abs(d[1] - bg2[1]) + Math.abs(d[2] - bg2[2]) > 4) { if (left === null) left = x; right = x; }
    }
    return { cardW: c.width, left, right };
  });
  assert(worstHealth.left > 4 && worstHealth.right < worstHealth.cardW - 4,
    `expected the widest Health pill group (d12 start: D12*/D10/D8/D6/OUT) to stay within the card bounds, got [${worstHealth.left}, ${worstHealth.right}] on a ${worstHealth.cardW}px-wide card`);
  ok('Worst-case Health die chain (Follower, d12 start) still fits without overflowing the card');

  console.log('\nAll verify26 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
