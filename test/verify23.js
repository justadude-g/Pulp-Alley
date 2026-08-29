// verify23.js — "Copy Roster" button: copies the roster sheet (full perk
// and Associate rules text, not just names) to the clipboard so it can be
// pasted into Apple Notes or any other app, no printing needed. Primary
// path is a rich DOM-selection copy (carries headings/bold into rich-text
// apps); this test also exercises the plain-text fallback builder directly
// since headless Chromium's execCommand('copy') support can be
// environment-dependent.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8856;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- Build the same kind of roster as verify22: a colleague, Dominion
  // (real errata text), and an Associate with a real ability. ----
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

  await page.click('#add-associate');
  await page.waitForTimeout(150);
  await page.fill('.associate-name-input[data-idx="0"]', 'The Butler');
  const firstAssociateAbility = await page.$eval('.associate-ability-select[data-idx="0"][data-slot="0"] option:nth-child(2)', el => el.value);
  await page.selectOption('.associate-ability-select[data-idx="0"][data-slot="0"]', firstAssociateAbility);
  await page.waitForTimeout(150);

  // ---- 1. The plain-text builder includes full rules text, not just
  // names — this is what backs both the fallback path and the manual-copy
  // prompt, so it has to carry everything on its own. ----
  const plainText = await page.evaluate(() => buildRosterPlainText(renderRosterPrintSheet()));
  assert(plainText.includes('The Riverside Crew'), 'expected the league name in the plain-text export');
  assert(plainText.includes('Doc Thunderbolt') && plainText.includes('Leader'), 'expected the colleague name and type');
  assert(plainText.includes('Dominion') && plainText.includes('Network of Supporters') && plainText.includes('Bastion of Science') && plainText.includes('Call to Arms'),
    'expected Dominion\'s full errata text in the plain-text export, not just its name');
  assert(plainText.includes('The Butler'), 'expected the Associate\'s name');
  assert(plainText.length > plainText.indexOf('The Butler') + 100, 'expected the Associate\'s ability name AND rules text after its name, not just the bare name');
  ok('Plain-text roster export includes full perk and Associate rules text, not just names');

  // ---- 2. Clicking Copy Roster does not throw, flashes a confirmation on
  // the button, and restores the original label afterward. ----
  const originalLabel = await page.$eval('#roster-copy-btn', el => el.textContent);
  await page.click('#roster-copy-btn');
  await page.waitForTimeout(150);
  const flashedLabel = await page.$eval('#roster-copy-btn', el => el.textContent);
  assert.notStrictEqual(flashedLabel, originalLabel, 'expected the button to show a confirmation immediately after copying');
  assert(/copied/i.test(flashedLabel), `expected a "Copied" confirmation, got: ${flashedLabel}`);
  ok('Copy Roster shows a "Copied!" confirmation on click');

  await page.waitForTimeout(1500);
  const restoredLabel = await page.$eval('#roster-copy-btn', el => el.textContent);
  assert.strictEqual(restoredLabel, originalLabel, 'expected the button label to revert after the confirmation window');
  ok('Copy Roster button label reverts after the confirmation flashes');

  // ---- 3. The off-screen render used for the copy trick is cleaned up
  // afterward — it shouldn't leave the sheet visibly rendered or the body
  // flagged as still copying. ----
  const afterState = await page.evaluate(() => ({
    hasClass: document.body.classList.contains('copying-roster-sheet'),
    display: getComputedStyle(document.getElementById('roster-print-sheet')).display,
  }));
  assert.strictEqual(afterState.hasClass, false, 'expected the copying-roster-sheet body class to be removed after copying');
  assert.strictEqual(afterState.display, 'none', 'expected the roster print sheet to be hidden again after copying');
  ok('The off-screen copy helper cleans up after itself (sheet hidden, body class removed)');

  // ---- 4. Whatever actually landed on the OS clipboard (rich path or
  // plain-text fallback, depending on this environment's execCommand
  // support) contains the real content, not a truncated placeholder. ----
  let clipboardText = '';
  try {
    clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  } catch (err) {
    console.log('(clipboard read not available in this environment — skipping direct clipboard content check)');
  }
  if (clipboardText) {
    assert(clipboardText.includes('Riverside Crew') || clipboardText.includes('Doc Thunderbolt'),
      `expected the clipboard content to reference the roster, got: ${clipboardText.slice(0, 120)}`);
    ok('Clipboard actually contains roster content after Copy Roster');
  }

  console.log('\nAll verify23 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
