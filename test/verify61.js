// verify61.js — Vice Alley (2014) review: of its 4 candidate abilities not
// already in the catalog by name (Short Blast, Short Range, Blast, Fast
// Thinking), only "Short Range" (Level 1) is genuinely new — the other 3
// are the same mechanic as an existing 2e Core Rules ability under a
// different, superseded 1st-edition name (Fast Thinking = Insight,
// Short Blast/Blast = the simpler Short Burst/Long Burst), so per the
// user's "keep the latest rules" instruction they were skipped rather
// than added as duplicates.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8881;
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

  // ---- 1. "Short Range" ability exists at Level 1 with the Vice Alley
  // text, and is distinct from the "Short Range" league Perk (different
  // data table, different 2e-revised text). ----
  const shortRangeAbility = await page.evaluate(() => findAbilityByName('Short Range'));
  assert(shortRangeAbility, 'expected a "Short Range" ability to exist in the catalog');
  assert.strictEqual(shortRangeAbility.level, 1, `expected the Short Range ability to be Level 1, got Level ${shortRangeAbility.level}`);
  assert(/running and shooting/i.test(shortRangeAbility.text), `expected Short Range's ability text to describe ignoring the running-and-shooting penalty, got: ${shortRangeAbility.text}`);

  const shortRangePerk = await page.evaluate(() => findPerkByName('Short Range'));
  assert(shortRangePerk, 'expected the existing "Short Range" Perk to still exist');
  assert.notStrictEqual(shortRangePerk.text, shortRangeAbility.text,
    'expected the Short Range Perk and the Short Range Ability to keep their own distinct texts (different mechanics, same name)');
  ok('New "Short Range" ability (Level 1) exists distinctly from the pre-existing "Short Range" Perk');

  // ---- 2. The 3 superseded candidates were deliberately NOT added under
  // their old Vice Alley names — their mechanic already exists under the
  // current 2e name instead. ----
  const skipped = await page.evaluate(() => ({
    fastThinking: findAbilityByName('Fast Thinking'),
    shortBlast: findAbilityByName('Short Blast'),
    blast: findAbilityByName('Blast'),
    insight: findAbilityByName('Insight'),
    shortBurst: findAbilityByName('Short Burst'),
    longBurst: findAbilityByName('Long Burst'),
  }));
  assert.strictEqual(skipped.fastThinking, null, 'expected "Fast Thinking" (superseded by Insight) to NOT be added as a separate ability');
  assert.strictEqual(skipped.shortBlast, null, 'expected "Short Blast" (superseded by Short Burst) to NOT be added as a separate ability');
  assert.strictEqual(skipped.blast, null, 'expected "Blast" (superseded by Long Burst) to NOT be added as a separate ability');
  assert(skipped.insight && skipped.shortBurst && skipped.longBurst, 'expected the superseding 2e abilities (Insight, Short Burst, Long Burst) to still exist');
  ok('Fast Thinking/Short Blast/Blast were correctly skipped as superseded duplicates, not added under their old names');

  // ---- 3. Short Range is selectable from the Ability Library on a Card
  // Designer profile and fills in its text. ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  await page.click('#open-ability-library');
  await page.waitForTimeout(150);
  await page.fill('#library-search', 'Short Range');
  await page.waitForTimeout(150);
  const libraryNames = await page.locator('#library-list .library-item-name').allTextContents();
  assert(libraryNames.some(n => n.trim() === 'Short Range'), `expected "Short Range" to appear in the filtered Ability Library, got ${JSON.stringify(libraryNames)}`);
  ok('"Short Range" ability shows up in the Ability Library search');
  await page.fill('#library-search', '');
  await page.click('#close-ability-library');

  console.log('\nAll verify61 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
