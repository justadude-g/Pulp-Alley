// verify13.js — Abilities hint text split into short paragraphs, and the
// ability description textarea becomes read-only (locked to the official
// rules text) once an ability is picked from autocomplete/library, while
// freeform/homebrew abilities (typed by hand, never picked) stay editable.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8832;
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

  // ---- 1. Hint text is split into separate short paragraphs ----
  const hints = await page.$$eval('fieldset:has(#abilities-list) > p.hint', els => els.map(e => e.textContent.trim()));
  assert.strictEqual(hints.length, 3, `expected 3 separate hint paragraphs, got ${hints.length}: ${JSON.stringify(hints)}`);
  assert(hints[0].includes('autocomplete abilities'), `unexpected hint[0]: ${hints[0]}`);
  assert(hints[1].includes('Gang-only abilities'), `unexpected hint[1]: ${hints[1]}`);
  assert(hints[2].includes('rename an ability'), `unexpected hint[2]: ${hints[2]}`);
  ok('Abilities intro hint is split into 3 short paragraphs');

  // ---- 2. Picking an official ability locks its text ----
  await page.click('#open-ability-library');
  await page.fill('#library-search', 'Marksman');
  await page.waitForTimeout(150);
  await page.click('.library-add-btn');
  await page.click('#close-ability-library');
  await page.waitForTimeout(150);

  let textarea = await page.$('.ability-item textarea[data-field="text"]');
  let isReadonly = await textarea.evaluate(el => el.readOnly);
  assert.strictEqual(isReadonly, true, 'expected the picked ability\'s text to be readonly');
  ok('Picking "Marksman" from the library locks its description text');

  const lockNoteVisible = await page.isVisible('.ability-text-locked-note');
  assert.strictEqual(lockNoteVisible, true, 'expected a "locked" note under the readonly textarea');
  ok('A "locked" note explains why the text can\'t be edited');

  // Attempting to type into a readonly textarea via the keyboard should not change its value.
  const before = await textarea.inputValue();
  await textarea.click();
  await page.keyboard.type('trying to sneak in an edit');
  const after = await textarea.inputValue();
  assert.strictEqual(after, before, 'expected readonly textarea value to be unchanged after attempted typing');
  ok('Typing into the locked textarea has no effect');

  // Renaming should NOT unlock the text (only the name is customizable).
  const nameInput = await page.$('.ability-item input[data-field="name"]');
  await nameInput.fill('Sharpshooter');
  await page.click('#f-name'); // blur
  await page.waitForTimeout(250);
  textarea = await page.$('.ability-item textarea[data-field="text"]');
  isReadonly = await textarea.evaluate(el => el.readOnly);
  assert.strictEqual(isReadonly, true, 'expected text to remain locked after renaming the ability');
  ok('Renaming "Marksman" to "Sharpshooter" keeps its rules text locked');

  // ---- 3. A freeform/homebrew ability (typed by hand) stays editable ----
  await page.click('#btn-new-card');
  await page.waitForTimeout(150);
  await page.fill('.ability-item input[data-field="name"]', 'Homebrew Ability');
  await page.waitForTimeout(150);
  textarea = await page.$('.ability-item textarea[data-field="text"]');
  isReadonly = await textarea.evaluate(el => el.readOnly);
  assert.strictEqual(isReadonly, false, 'expected a freeform ability\'s text to stay editable');
  await textarea.fill('Whatever homebrew effect I want.');
  const val = await textarea.inputValue();
  assert.strictEqual(val, 'Whatever homebrew effect I want.', 'expected freeform text to be editable');
  ok('A freeform/homebrew ability (never picked from the catalog) keeps an editable text field');

  console.log('\nAll verify13 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
