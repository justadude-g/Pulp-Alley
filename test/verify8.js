const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

const PORT = 8822;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // Switch to Gang card type
  await page.fill('#f-name', 'The Dockside Toughs');
  await page.selectOption('#f-cardType', 'Gang');
  await page.waitForTimeout(200);

  const gangFieldsetVisible = await page.locator('#gang-fieldset').isVisible();
  const standardHealthVisible = await page.locator('#standard-health-fields').isVisible();
  const gangHealthVisible = await page.locator('#gang-health-fields').isVisible();
  console.log('gang-fieldset visible:', gangFieldsetVisible, '| standard-health visible:', standardHealthVisible, '| gang-health visible:', gangHealthVisible);

  // Default 5 models -> Brawl/Shoot/Might = 3d6, Dodge/Cunning/Finesse = 1d6
  async function statVal(key) {
    const row = page.locator(`.stat-row[data-stat="${key}"]`);
    const n = await row.locator('select.stat-n').inputValue();
    const d = await row.locator('select.stat-d').inputValue();
    return `${n}d${d}`;
  }
  console.log('at 5 models -> brawl:', await statVal('brawl'), 'shoot:', await statVal('shoot'), 'might:', await statVal('might'),
    'dodge:', await statVal('dodge'), 'cunning:', await statVal('cunning'), 'finesse:', await statVal('finesse'));

  const healthPreview1 = await page.locator('#health-preview').textContent();
  console.log('health preview @5 models:', healthPreview1);

  // Change to 7 models -> ceil(7/2) = 4
  await page.fill('#f-gangModels', '7');
  await page.waitForTimeout(150);
  console.log('at 7 models -> brawl:', await statVal('brawl'), 'shoot:', await statVal('shoot'), 'might:', await statVal('might'));
  const healthPreview2 = await page.locator('#health-preview').textContent();
  console.log('health preview @7 models:', healthPreview2);

  // Manual override still works after auto-fill
  await page.locator('.stat-row[data-stat="brawl"] select.stat-n').selectOption('5');
  await page.waitForTimeout(100);
  console.log('brawl after manual override:', await statVal('brawl'));

  // Ability autocomplete restricted to gang-eligible pool
  await page.fill('.ability-name-wrap input[data-idx="0"]', 'Arm');
  await page.waitForTimeout(200);
  const suggNames = await page.locator('.sugg-name').allTextContents();
  console.log('autocomplete suggestions for "Arm" on Gang card:', suggNames);

  // Ability Library: level filter buttons + gang-only ability add
  await page.click('#open-ability-library');
  await page.waitForTimeout(150);
  const levelBtnLabels = await page.locator('#level-filter .level-btn').allTextContents();
  console.log('ability library level filter buttons for Gang:', levelBtnLabels);
  await page.click('.level-btn[data-level="Gang"]');
  await page.waitForTimeout(150);
  const gangOnlyNames = await page.locator('#library-list .library-item-name').allTextContents();
  console.log('Gang-only ability list:', gangOnlyNames);
  // add "Mob"
  const mobRow = page.locator('#library-list .library-item', { hasText: 'Mob' });
  await mobRow.locator('.library-add-btn').click();
  await page.waitForTimeout(150);
  await page.click('#close-ability-library');
  await page.waitForTimeout(150);

  const abilityNamesOnCard = await page.locator('.ability-name-wrap input').evaluateAll(els => els.map(e => e.value));
  console.log('abilities on card after adding Mob from library:', abilityNamesOnCard);

  // Save the gang card
  await page.click('#btn-save-card');
  await page.waitForTimeout(250);

  // Roster: add it as a colleague, check slot cost = 2
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(200);
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(150);
  const colleagueText = await page.locator('#colleague-picker-list .library-item-text').first().textContent();
  console.log('gang colleague roster-slot cost shown in picker:', colleagueText);
  await page.locator('#colleague-picker-list .library-add-btn').first().click();
  await page.waitForTimeout(150);
  await page.click('#close-colleague-picker');
  const memberSlots = await page.locator('#roster-members .roster-row-slots').first().textContent();
  console.log('gang member roster row slot label:', memberSlots);

  // Reload, load the gang card back into the designer, verify state restores
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  await page.click('.gallery-card [data-act="edit"]');
  await page.waitForTimeout(250);
  const restoredCardType = await page.locator('#f-cardType').inputValue();
  const restoredModels = await page.locator('#f-gangModels').inputValue();
  const restoredGangFieldsetVisible = await page.locator('#gang-fieldset').isVisible();
  console.log('after reload+edit -> cardType:', restoredCardType, 'models:', restoredModels, 'gang fieldset visible:', restoredGangFieldsetVisible);

  console.log('page errors:', errors);
  await page.screenshot({ path: path.join(__dirname, 'shot-gang-card.png') });
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
