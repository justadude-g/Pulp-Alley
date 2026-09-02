// verify39.js — the "Quick Reference" tab: an on-screen, two-page cheat
// sheet distilled from the Core Rules, Terms & Flow v1.2, and the official
// Action Sequence reference, plus a "Save as PDF" button that downloads a
// real two-page PDF (drawn directly with jsPDF, not a screenshot of the
// DOM) sized to print on two sheets of A4 — page 1 covers turns, health,
// and the core fight/shoot rules; page 2 (Core Rules p. 57-73) covers
// Dodging, Modifiers, Splitting Dice, Cover, Bursts & Stealth.
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

  // ---- 2. Two on-screen sheets (one per PDF page), two columns each,
  // covering the key sections drawn from the source rules documents. ----
  const sheetCount = await page.$$eval('.qr-sheet', els => els.length);
  assert.strictEqual(sheetCount, 2, `expected exactly 2 on-screen "sheets" (one per PDF page), got ${sheetCount}`);
  const colCount = await page.$$eval('.qr-sheet .qr-col', els => els.length);
  assert.strictEqual(colCount, 4, `expected 2 columns per sheet across 2 sheets (4 total), got ${colCount}`);

  const bodyText = await page.$eval('#tab-quickref', el => el.textContent);
  const expectedHeadingsPage1 = [
    'Director', 'Key Terms', 'Action Sequence', 'Health & Recovery', 'Engagement & Dodge',
    'Blocking Hits', 'Shooting Sequence', 'Brawling Sequence', 'Fortune Cards', 'Competitive Rolls',
  ];
  const expectedHeadingsPage2 = [
    'Dodging', 'Disengage', 'Basic Modifiers', 'Defensive Fire', 'Splitting Dice',
    'Cover Save', 'Shooting Engaged Characters', 'Bursts', 'Stealth', 'Spotting', 'Ambush',
  ];
  for (const heading of [...expectedHeadingsPage1, ...expectedHeadingsPage2]) {
    assert.ok(bodyText.includes(heading), `expected the Quick Reference tab to include a "${heading}" section`);
  }
  assert.ok(bodyText.includes('Success is a 4+ on any die'), 'expected the core success-rule callout on screen');
  assert.ok(bodyText.includes('Page 1 of 2'), 'expected the first sheet to be labeled "Page 1 of 2"');
  assert.ok(bodyText.includes('Page 2 of 2'), 'expected the second sheet to be labeled "Page 2 of 2"');
  ok('Both on-screen sheets render two columns each and cover all the key sections from the source rules, including the p. 57-73 additions');

  // ---- 3. "Save as PDF" downloads a real PDF file named as expected. ----
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-qr-save-pdf'),
  ]);
  assert.strictEqual(download.suggestedFilename(), 'pulp-alley-quick-reference.pdf', `unexpected PDF filename "${download.suggestedFilename()}"`);
  const pdfPath = await download.path();
  ok('"Save as PDF" downloads a file named pulp-alley-quick-reference.pdf');

  // ---- 4. The PDF is exactly 2 pages, and each page carries the right
  // section content — proven with pypdf rather than guessing from byte
  // size, matching this project's general preference for verifying actual
  // rendered/extracted content over indirect proxies. ----
  const py = `
import pypdf, json, sys
r = pypdf.PdfReader(${JSON.stringify(pdfPath)})
pages = [p.extract_text() or '' for p in r.pages]
print(json.dumps({"count": len(r.pages), "pages": pages}))
`;
  const out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
  const { count, pages } = JSON.parse(out);
  assert.strictEqual(count, 2, `expected the saved PDF to have exactly 2 pages (one per sheet of A4), got ${count}`);
  ok('The saved PDF has exactly 2 pages');

  // Section headings are drawn in all-caps in the PDF (see heading() in
  // downloadQuickReferencePDF), so these checks are case-insensitive —
  // they're proving the section is present, not policing its letter case.
  const text1 = pages[0].toLowerCase();
  const expectedSectionsPage1 = [
    'director', 'key terms', 'action sequence', 'health & recovery', 'engagement & dodge',
    'blocking hits', 'dice modifiers', 'shooting sequence', 'brawling sequence',
    'fortune cards', 'competitive rolls',
  ];
  for (const section of expectedSectionsPage1) {
    assert.ok(text1.includes(section), `expected PDF page 1 to contain the "${section}" section, but it was missing`);
  }
  assert.ok(text1.includes('page 1 of 2'), 'expected PDF page 1\'s header to read "Page 1 of 2"');
  ok('PDF page 1 carries every section from the turns/health/combat-basics half of the reference');

  const text2 = pages[1].toLowerCase();
  const expectedSectionsPage2 = [
    'dodging', 'disengage', 'basic modifiers', 'defensive fire', 'splitting dice',
    'cover save', 'shooting engaged characters', 'bursts', 'stealth', 'spotting', 'ambush',
  ];
  for (const section of expectedSectionsPage2) {
    assert.ok(text2.includes(section), `expected PDF page 2 to contain the "${section}" section, but it was missing`);
  }
  assert.ok(text2.includes('page 2 of 2'), 'expected PDF page 2\'s header to read "Page 2 of 2"');
  ok('PDF page 2 carries every section added from Core Rules p. 57-73 — Dodging through Ambush');

  // Guard against the exact encoding bug found during development: jsPDF's
  // built-in Helvetica font silently mangles characters outside WinAnsi
  // (arrows, the U+2212 minus sign, >=) into interleaved-null-byte garbage
  // instead of throwing, so a stray Unicode symbol in a future edit would
  // otherwise pass every other check here while rendering as gibberish.
  for (let i = 0; i < pages.length; i++) {
    assert.ok(!pages[i].includes('\x00'), `expected no null-byte encoding artifacts in PDF page ${i + 1} (a sign a non-WinAnsi character snuck into the PDF-drawing code — use ASCII arrows/comparisons there, not →/≥/− )`);
  }
  ok('No encoding-corruption artifacts (null bytes) on either page — confirms only WinAnsi-safe characters were used in the PDF-drawing code');

  assert.deepStrictEqual(errors, [], `expected no page errors, got ${JSON.stringify(errors)}`);
  console.log('\nAll verify39 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
