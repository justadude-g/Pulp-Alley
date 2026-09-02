// verify49.js — The Print Sheet used to hard-cap My Cards selection at 9
// (one 3x3 A4 page). Selection is uncapped now, and the Print Sheet
// renders one page per 9 selected cards, spilling onto as many pages as
// needed: on-screen (one .sheet-page-canvas per page, labeled "Page N of
// M" past the first), Download PDF (one multi-page PDF via jsPDF
// addPage()), and Download PNG (one numbered PNG per page).
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const { execFileSync } = require('child_process');
const PORT = 8899;
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

  // ---- 1. Seed 20 cards (2 full pages of 9 + a 3rd page of 2), select
  // all of them via Select All (no cap), then go to Print Sheet. ----
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  await page.evaluate(async (pngData) => {
    for (let i = 0; i < 20; i++) {
      await saveCard({ id: `sheet-card-${i}`, formData: { name: `Card ${i}`, cardType: 'Leader' }, pngDataURL: pngData, createdAt: Date.now() + i, updatedAt: Date.now() + i });
    }
  }, png);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('#select-all-btn');
  await page.waitForTimeout(150);
  const selectedCount = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(selectedCount, '20 selected', `expected all 20 cards to be selectable with no 9-card cap, got "${selectedCount}"`);
  ok('20 cards can all be selected at once — no 9-card cap');

  await page.click('.tab-btn[data-tab="print"]');
  await page.waitForTimeout(500);

  // ---- 2. The Print Sheet renders 3 pages (ceil(20/9)) — 2 full 3x3
  // pages plus a 3rd with the remaining 2 — and labels them. ----
  const pageCanvasCount = await page.$$eval('.sheet-page-canvas', els => els.length);
  assert.strictEqual(pageCanvasCount, 3, `expected ceil(20/9) = 3 page canvases, got ${pageCanvasCount}`);
  ok('The Print Sheet renders exactly 3 pages for 20 selected cards (ceil(20/9))');

  const pageLabels = await page.$$eval('.sheet-page-label', els => els.map(e => e.textContent));
  assert.deepStrictEqual(pageLabels, ['Page 1 of 3', 'Page 2 of 3', 'Page 3 of 3'], `expected sequential page labels, got ${JSON.stringify(pageLabels)}`);
  ok('Each page is labeled "Page N of M" when there\'s more than one');

  const heading = await page.$eval('#print-sheet-heading', el => el.textContent);
  assert.ok(/20 cards, 3 pages/.test(heading), `expected the heading to summarize the card/page counts, got "${heading}"`);
  ok('The Print Sheet heading summarizes the card and page counts');

  // Each page canvas is a full A4-proportioned sheet (2480x3508 @ 300dpi),
  // same size regardless of how many of its 9 slots are filled.
  const canvasSizes = await page.$$eval('.sheet-page-canvas', els => els.map(c => ({ w: c.width, h: c.height })));
  canvasSizes.forEach((size, i) => {
    assert.deepStrictEqual(size, { w: 2480, h: 3508 }, `expected page ${i + 1} to be a full A4 canvas (2480x3508), got ${JSON.stringify(size)}`);
  });
  ok('Every page renders as a full A4-sized canvas, including the partially-filled 3rd page');

  // ---- 3. Download PDF produces one multi-page PDF (3 pages, matching
  // the 3 rendered page canvases). ----
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#print-download-pdf'),
  ]);
  const pdfPath = await pdfDownload.path();
  const pyScript = `
import pypdf
r = pypdf.PdfReader("${pdfPath}")
print(len(r.pages))
`;
  const pageCountOut = execFileSync('python3', ['-c', pyScript]).toString().trim();
  assert.strictEqual(pageCountOut, '3', `expected the downloaded PDF to have 3 pages, got ${pageCountOut}`);
  ok('Download PDF produces a single multi-page PDF file with all 3 pages');

  // ---- 4. Download PNG is disabled for a multi-page sheet — a single PNG
  // can't hold multiple pages, and firing off several downloads at once
  // from one click is exactly what Chrome's "multiple automatic
  // downloads" guard blocks (silently, past the first). Download PDF
  // (checked above) is the multi-page path; PNG stays single-page-only. ----
  const pngDisabled = await page.$eval('#print-download-png', el => el.disabled);
  assert.strictEqual(pngDisabled, true, 'expected Download PNG to be disabled when the sheet has more than one page');
  const pngTitle = await page.$eval('#print-download-png', el => el.title);
  assert.ok(/single-page|Download PDF/i.test(pngTitle), `expected the disabled PNG button's title to explain why, got "${pngTitle}"`);
  ok('Download PNG is disabled (with an explanatory title) for a multi-page sheet, rather than firing off multiple downloads');

  // ---- 5. Back down to 9 or fewer selected: back to the single-page
  // behavior (no page label, plain heading, single unnumbered PNG). ----
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(300);
  await page.click('#select-all-btn'); // deselect all
  await page.waitForTimeout(150);
  for (let i = 0; i < 5; i++) {
    await page.locator('.gallery-card').nth(i).click();
    await page.waitForTimeout(80);
  }
  const smallSelectedCount = await page.$eval('#selected-count', el => el.textContent);
  assert.strictEqual(smallSelectedCount, '5 selected', `expected exactly 5 selected, got "${smallSelectedCount}"`);

  await page.click('.tab-btn[data-tab="print"]');
  await page.waitForTimeout(500);
  const singlePageCanvasCount = await page.$$eval('.sheet-page-canvas', els => els.length);
  assert.strictEqual(singlePageCanvasCount, 1, `expected exactly 1 page canvas for 5 selected cards, got ${singlePageCanvasCount}`);
  const singlePageLabels = await page.$$eval('.sheet-page-label', els => els.length);
  assert.strictEqual(singlePageLabels, 0, 'expected no "Page N of M" label when there\'s only a single page');
  const singleHeading = await page.$eval('#print-sheet-heading', el => el.textContent);
  assert.strictEqual(singleHeading.trim(), 'Print Sheet — A4', `expected the plain heading (no card/page count) for a single page, got "${singleHeading}"`);
  ok('With 9 or fewer selected, the Print Sheet is back to a single unlabeled page with a plain heading');

  const pngReenabled = await page.$eval('#print-download-png', el => el.disabled);
  assert.strictEqual(pngReenabled, false, 'expected Download PNG to be re-enabled once back down to a single page');
  ok('Download PNG re-enables once the sheet is back down to a single page');

  const [singlePngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#print-download-png'),
  ]);
  assert.strictEqual(singlePngDownload.suggestedFilename(), 'pulp-alley-roster-a4.png', `expected the single-page PNG filename to stay unnumbered, got "${singlePngDownload.suggestedFilename()}"`);
  ok('Download PNG for a single page keeps the plain, unnumbered filename');

  console.log('\nAll verify49 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
