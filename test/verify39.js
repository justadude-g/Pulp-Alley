// verify39.js — new "Quick Reference" tab: an on-screen, one-page cheat
// sheet distilled from the Core Rules, Terms & Flow v1.2, and the official
// Action Sequence reference, plus a "Save as PDF" button that downloads a
// real single-page PDF (drawn directly with jsPDF, not a screenshot of the
// DOM) sized to print on one sheet of A4.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const { execFileSync } = require('child_process');
const PORT = 8880;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. The tab exists in the nav and switches in like the others. ----
  const tabExists = await page.$('.tab-btn[data-tab="quickref"]');
  assert.ok(tabExists, 'expected a "Quick Reference" tab button in the nav');
  await page.click('.tab-btn[data-tab="quickref"]');
  await page.waitForTimeout(200);
  const panelVisible = await page.$eval('#tab-quickref', el => el.classList.contains('active'));
  assert.strictEqual(panelVisible, true, 'expected #tab-quickref to become the active panel');
  ok('"Quick Reference" tab exists and switches in normally');

  // ---- 2. A single on-screen sheet with two columns, covering the key
  // sections drawn from the source rules documents. ----
  const sheetCount = await page.$$eval('.qr-sheet', els => els.length);
  assert.strictEqual(sheetCount, 1, `expected exactly 1 on-screen "sheet" (everything fits on one page), got ${sheetCount}`);
  const colCount = await page.$$eval('.qr-sheet .qr-col', els => els.length);
  assert.strictEqual(colCount, 2, `expected 2 columns on the single sheet, got ${colCount}`);

  const bodyText = await page.$eval('#tab-quickref', el => el.textContent);
  const expectedHeadings = [
    'Director', 'Key Terms', 'Action Sequence', 'Health & Recovery', 'Engagement & Dodge',
    'Blocking Hits', 'Shooting Sequence', 'Brawling Sequence', 'Fortune Cards', 'Competitive Rolls',
  ];
  for (const heading of expectedHeadings) {
    assert.ok(bodyText.includes(heading), `expected the Quick Reference tab to include a "${heading}" section`);
  }
  assert.ok(bodyText.includes('Success is a 4+ on any die'), 'expected the core success-rule callout on screen');
  ok('The single on-screen sheet renders two columns and covers all the key sections from the source rules');

  // ---- 3. "Save as PDF" downloads a real PDF file named as expected. ----
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-qr-save-pdf'),
  ]);
  assert.strictEqual(download.suggestedFilename(), 'pulp-alley-quick-reference.pdf', `unexpected PDF filename "${download.suggestedFilename()}"`);
  const pdfPath = await download.path();
  ok('"Save as PDF" downloads a file named pulp-alley-quick-reference.pdf');

  // ---- 4. The PDF is exactly 1 page — the whole point of consolidating
  // from the original 2-page design once it was clear everything fit —
  // and carries every section's content, proven with pypdf rather than
  // guessing from byte size, matching this project's general preference
  // for verifying actual rendered/extracted content over indirect proxies. ----
  const py = `
import pypdf, json, sys
r = pypdf.PdfReader(${JSON.stringify(pdfPath)})
pages = [p.extract_text() or '' for p in r.pages]
print(json.dumps({"count": len(r.pages), "pages": pages}))
`;
  const out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
  const { count, pages } = JSON.parse(out);
  assert.strictEqual(count, 1, `expected the saved PDF to have exactly 1 page (everything fits on one sheet of A4), got ${count}`);
  ok('The saved PDF has exactly 1 page');

  // Section headings are drawn in all-caps in the PDF (see heading() in
  // downloadQuickReferencePDF), so these checks are case-insensitive —
  // they're proving the section is present, not policing its letter case.
  const text = pages[0].toLowerCase();
  const expectedSections = [
    'director', 'key terms', 'action sequence', 'health & recovery', 'engagement & dodge',
    'blocking hits', 'dice modifiers', 'shooting sequence', 'brawling sequence',
    'fortune cards', 'competitive rolls',
  ];
  for (const section of expectedSections) {
    assert.ok(text.includes(section), `expected the single-page PDF to contain the "${section}" section, but it was missing`);
  }
  assert.ok(text.includes('everything on one sheet'), 'expected the PDF header to read "Everything on one sheet"');
  ok('The single page carries every section from both halves of the reference — Director through Competitive Rolls');

  // Guard against the exact encoding bug found during development: jsPDF's
  // built-in Helvetica font silently mangles characters outside WinAnsi
  // (arrows, the U+2212 minus sign, >=) into interleaved-null-byte garbage
  // instead of throwing, so a stray Unicode symbol in a future edit would
  // otherwise pass every other check here while rendering as gibberish.
  assert.ok(!pages[0].includes('\x00'), 'expected no null-byte encoding artifacts in the PDF text (a sign a non-WinAnsi character snuck into the PDF-drawing code — use ASCII arrows/comparisons there, not →/≥/− )');
  ok('No encoding-corruption artifacts (null bytes) in the extracted text — confirms only WinAnsi-safe characters were used in the PDF-drawing code');

  assert.deepStrictEqual(errors, [], `expected no page errors, got ${JSON.stringify(errors)}`);
  console.log('\nAll verify39 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
