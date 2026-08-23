// verify17.js — Dominion perk errata: incompatible with Network of
// Supporters, Bastion of Science, and Call to Arms.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8840;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

async function addPerkByName(page, name) {
  // Search by exact name and target the add button by its data-name attribute
  // rather than "first result" — Dominion's own errata text now mentions the
  // other three perks by name, so a plain text search for e.g. "Network of
  // Supporters" also matches Dominion's entry (text search), not just the
  // Network of Supporters entry (name match).
  await page.click('#open-perk-library');
  await page.waitForTimeout(150);
  await page.fill('#perk-search', name);
  await page.waitForTimeout(150);
  await page.click(`#perk-library-list .library-add-btn[data-name="${name}"]`);
  await page.waitForTimeout(150);
  await page.fill('#perk-search', '');
  await page.click('#close-perk-library');
  await page.waitForTimeout(150);
}

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(300);
  await page.fill('#roster-name', 'Errata Test League');

  // ---- 1. Dominion's own rules text in the Perk Library shows the errata ----
  await page.click('#open-perk-library');
  await page.waitForTimeout(150);
  await page.fill('#perk-search', 'Dominion');
  await page.waitForTimeout(150);
  const dominionText = await page.locator('#perk-library-list .library-item-text').first().textContent();
  assert(/incompatible with Network of Supporters, Bastion of Science, and Call to Arms/i.test(dominionText),
    `expected Dominion's library text to state the errata, got: ${dominionText}`);
  ok('Dominion\'s Perk Library entry states the errata');
  await page.fill('#perk-search', '');
  await page.click('#close-perk-library');
  await page.waitForTimeout(150);

  // ---- 2. No warning yet with Dominion alone ----
  await addPerkByName(page, 'Dominion');
  let warnings = await page.locator('.roster-warning').allTextContents();
  assert(!warnings.some(w => /incompatible/i.test(w)), `expected no incompatibility warning with only Dominion, got: ${JSON.stringify(warnings)}`);
  ok('No incompatibility warning with Dominion alone');

  // ---- 3. Adding Network of Supporters alongside Dominion triggers a warning ----
  await addPerkByName(page, 'Network of Supporters');
  warnings = await page.locator('.roster-warning').allTextContents();
  assert(warnings.some(w => /Dominion is incompatible with Network of Supporters/i.test(w)),
    `expected a Dominion/Network of Supporters incompatibility warning, got: ${JSON.stringify(warnings)}`);
  ok('Adding Network of Supporters alongside Dominion triggers the errata warning');

  // ---- 4. Adding Bastion of Science and Call to Arms too — all three named ----
  await addPerkByName(page, 'Bastion of Science');
  await addPerkByName(page, 'Call to Arms');
  warnings = await page.locator('.roster-warning').allTextContents();
  const combined = warnings.join(' | ');
  assert(/Network of Supporters/.test(combined) && /Bastion of Science/.test(combined) && /Call to Arms/.test(combined),
    `expected all three conflicting perks named in the warning(s), got: ${combined}`);
  ok('All three Dominion-incompatible perks are named once each is added');

  // ---- 5. Removing the conflicting perks clears the warning ----
  const perkRows = page.locator('#roster-perks .roster-row');
  const perkCount = await perkRows.count();
  for (let i = perkCount - 1; i >= 0; i--) {
    const name = await perkRows.nth(i).locator('.roster-row-name').textContent();
    if (name.trim() !== 'Dominion') {
      await perkRows.nth(i).locator('.roster-row-remove').click();
      await page.waitForTimeout(120);
    }
  }
  warnings = await page.locator('.roster-warning').allTextContents();
  assert(!warnings.some(w => /incompatible/i.test(w)), `expected the incompatibility warning to clear once conflicting perks are removed, got: ${JSON.stringify(warnings)}`);
  ok('Removing the conflicting perks clears the errata warning (Dominion alone remains fine)');

  console.log('\nAll verify17 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
