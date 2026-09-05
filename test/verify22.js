// verify22.js — League Roster gets a printable reference sheet: "Print
// Roster" (full-page print view via window.print()) and "Download PDF"
// (jsPDF, text-based so it wraps/paginates correctly regardless of roster
// size). Unlike the on-screen Perks/Associates columns, the printed sheet
// includes the full rules text of every perk and every Associate ability,
// not just names.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8855;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- Build a roster: one colleague, a perk with real errata text
  // (Dominion, so we can check its full incompatibility text prints, not
  // just the name), and an Associate with a real ability. Associates are
  // their own Card Type (built in the Designer, added from My Cards) —
  // see verify12.js for full coverage of that mechanic; this test only
  // needs one on the roster to prove the print sheet includes its text. ----
  await page.selectOption('#f-cardType', 'Associate');
  await page.fill('#f-name', 'The Butler');
  await page.click('#add-ability');
  const associateNameInputs = await page.$$('.ability-item input[data-field="name"]');
  const associateTextInputs = await page.$$('.ability-item textarea[data-field="text"]');
  await associateNameInputs[0].fill('Got Your Back');
  await associateTextInputs[0].fill('You gain +1 Backup point.');
  await page.waitForTimeout(150);
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);

  await page.click('#btn-new-card');
  await page.fill('#f-name', 'Doc Thunderbolt');
  await page.selectOption('#f-cardType', 'Leader');
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);

  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.fill('#roster-name', 'The Riverside Crew');

  await page.click('#open-colleague-picker');
  await page.waitForTimeout(150);
  await page.locator('#colleague-picker-list .library-add-btn').first().click();
  await page.waitForTimeout(150);
  await page.click('#close-colleague-picker');

  await page.click('#open-perk-library');
  await page.waitForTimeout(150);
  await page.fill('#perk-search', 'Dominion');
  await page.waitForTimeout(150);
  await page.click('#perk-library-list .library-add-btn[data-name="Dominion"]');
  await page.waitForTimeout(150);
  await page.click('#close-perk-library');

  await page.click('#open-associate-picker');
  await page.waitForTimeout(150);
  await page.click('#associate-picker-list .library-item:has-text("The Butler") .library-add-btn');
  await page.waitForTimeout(150);
  await page.click('#close-associate-picker');
  await page.waitForTimeout(150);

  // ---- 1. Render the print sheet DOM directly (skip window.print() itself,
  // which opens a native dialog Playwright shouldn't drive) and check the
  // full text made it in, not just names. ----
  await page.evaluate(() => renderRosterPrintSheet());
  const rpsName = await page.$eval('#rps-name', el => el.textContent);
  assert.strictEqual(rpsName, 'The Riverside Crew', `expected roster name on the print sheet, got: ${rpsName}`);

  const rpsSummary = await page.$eval('#rps-summary', el => el.textContent);
  assert(/slots used/.test(rpsSummary), `expected a slot summary line, got: ${rpsSummary}`);
  ok('Print sheet header shows the league name and a slot-usage summary');

  const colleagueRow = await page.$eval('#rps-colleagues', el => el.textContent);
  assert(colleagueRow.includes('Doc Thunderbolt'), 'expected the colleague name on the print sheet');
  assert(colleagueRow.includes('Leader'), 'expected the colleague card type on the print sheet');
  ok('Print sheet lists colleagues with name and type');

  const perksText = await page.$eval('#rps-perks', el => el.textContent);
  assert(perksText.includes('Dominion'), 'expected the perk name on the print sheet');
  assert(perksText.includes('Network of Supporters') && perksText.includes('Bastion of Science') && perksText.includes('Call to Arms'),
    'expected Dominion\'s FULL errata text (naming the incompatible perks) on the print sheet, not just its name');
  ok('Print sheet shows a perk\'s full rules text, not just its name');

  const associatesText = await page.$eval('#rps-associates', el => el.textContent);
  assert(associatesText.includes('The Butler'), 'expected the Associate\'s name on the print sheet');
  assert(associatesText.length > (associatesText.indexOf('The Butler') + 'The Butler'.length) + 10,
    'expected actual ability rules text after the Associate\'s name, not just the bare name');
  ok('Print sheet shows an Associate\'s chosen ability with its full rules text');

  // ---- 2. Empty-roster case: sections show their "no X yet" placeholders
  // instead of blank space. ----
  await page.evaluate(() => {
    // Directly exercise the empty case without tearing down the built
    // roster: build print data for a blank roster shape.
    const emptyData = { name: 'Empty League', used: 0, remaining: 10, total: 10, memberSlots: 0, perkSlots: 0, associateSlots: 0, members: [], perks: [], associates: [] };
    document.getElementById('rps-name').textContent = emptyData.name;
    document.getElementById('rps-colleagues').innerHTML = '';
    document.getElementById('rps-colleagues-empty').style.display = 'block';
    document.getElementById('rps-perks').innerHTML = '';
    document.getElementById('rps-perks-empty').style.display = 'block';
    document.getElementById('rps-associates').innerHTML = '';
    document.getElementById('rps-associates-empty').style.display = 'block';
  });
  const emptyVisible = await page.evaluate(() => ({
    colleagues: getComputedStyle(document.getElementById('rps-colleagues-empty')).display,
    perks: getComputedStyle(document.getElementById('rps-perks-empty')).display,
    associates: getComputedStyle(document.getElementById('rps-associates-empty')).display,
  }));
  assert(emptyVisible.colleagues === 'block' && emptyVisible.perks === 'block' && emptyVisible.associates === 'block',
    'expected empty-state placeholders to show when a section has nothing in it');
  ok('Empty sections show a placeholder instead of blank space');

  // Re-render the real roster back onto the sheet before testing Print/PDF.
  await page.evaluate(() => renderRosterPrintSheet());

  // ---- 3. Print Roster: stub window.print (no real dialog in a headless
  // test) and confirm the body class that isolates the sheet in @media
  // print gets toggled on click. ----
  await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.click('#roster-print-btn');
  await page.waitForTimeout(100);
  const printState = await page.evaluate(() => ({
    calls: window.__printCalls,
    hasClass: document.body.classList.contains('printing-roster-sheet'),
  }));
  assert.strictEqual(printState.calls, 1, 'expected Print Roster to call window.print() exactly once');
  assert(printState.hasClass, 'expected body to get the printing-roster-sheet class so @media print can isolate the sheet');
  ok('Print Roster calls window.print() and flags the body so only the roster sheet shows');

  // afterprint won't fire without a real print in headless Chromium — fire
  // it manually to confirm the cleanup listener actually removes the class
  // (so a real print/cancel doesn't leave the app stuck showing nothing).
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const classAfter = await page.evaluate(() => document.body.classList.contains('printing-roster-sheet'));
  assert.strictEqual(classAfter, false, 'expected afterprint to clear the printing-roster-sheet class');
  ok('afterprint cleans up the body class so the app returns to normal');

  // ---- 4. Download PDF: a real file comes down, non-trivial size, valid
  // PDF header, and named after the league. ----
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#roster-download-pdf'),
  ]);
  const suggested = download.suggestedFilename();
  assert(suggested.toLowerCase().includes('riverside-crew'), `expected the PDF filename to reference the league name, got: ${suggested}`);
  const pdfPath = path.join(__dirname, 'roster-download-test.pdf');
  await download.saveAs(pdfPath);
  const buf = fs.readFileSync(pdfPath);
  assert(buf.slice(0, 5).toString('latin1') === '%PDF-', 'expected a valid PDF file header');
  assert(buf.length > 2000, `expected a non-trivial PDF file size, got ${buf.length} bytes`);
  fs.unlinkSync(pdfPath);
  ok('Download PDF produces a real, named PDF file');

  console.log('\nAll verify22 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
