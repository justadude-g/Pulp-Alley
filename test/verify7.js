const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

const PORT = 8820;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // Save a Leader card and a Sidekick card so the roster has something to add
  await page.fill('#f-name', 'Aunt Agnes');
  await page.selectOption('#f-cardType', 'Leader');
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);

  await page.click('#btn-new-card');
  await page.fill('#f-name', 'Cousin Billy');
  await page.selectOption('#f-cardType', 'Sidekick');
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);

  await page.click('#btn-new-card');
  await page.fill('#f-name', 'Cousin Mac');
  await page.selectOption('#f-cardType', 'Sidekick');
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);

  // go to League Roster tab
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(300);
  await page.fill('#roster-name', 'The Shadow Tong');

  // open colleague picker, add all three
  await page.click('#open-colleague-picker');
  await page.waitForTimeout(200);
  let addBtns = await page.locator('#colleague-picker-list .library-add-btn').count();
  console.log('available colleagues to add:', addBtns);
  for (let i = 0; i < 3; i++) {
    await page.locator('#colleague-picker-list .library-add-btn').first().click();
    await page.waitForTimeout(150);
  }
  await page.click('#close-colleague-picker');
  await page.waitForTimeout(150);

  const memberRows = await page.locator('#roster-members .roster-row').count();
  console.log('member rows:', memberRows);
  const slotLabel = await page.locator('#slot-meter-label').textContent();
  console.log('slot label (2 sidekicks + 1 leader = 0+3+3=6 used):', slotLabel);

  const warnings = await page.locator('.roster-warning').allTextContents();
  console.log('warnings (expect sidekick warning):', warnings);

  // open perk library, filter to 2-slot, add Company of Heroes
  await page.click('#open-perk-library');
  await page.waitForTimeout(200);
  await page.click('.level-btn[data-slots="2"]');
  await page.waitForTimeout(150);
  await page.fill('#perk-search', 'Company');
  await page.waitForTimeout(150);
  const perkNames = await page.locator('#perk-library-list .library-item-name').allTextContents();
  console.log('perk search "Company" in 2-slot filter:', perkNames);
  await page.click('#perk-library-list .library-add-btn');
  await page.waitForTimeout(150);
  // click again -> duplicate
  await page.click('#perk-library-list .library-add-btn');
  await page.waitForTimeout(150);
  await page.click('#close-perk-library');
  await page.waitForTimeout(150);

  const perkRows = await page.locator('#roster-perks .roster-row').count();
  console.log('perk rows (expect 1, no duplicate):', perkRows);
  const warningsAfter = await page.locator('.roster-warning').allTextContents();
  console.log('warnings after Company of Heroes (sidekick warning should be gone):', warningsAfter);

  const slotLabel2 = await page.locator('#slot-meter-label').textContent();
  console.log('slot label after perk (6 + 2 = 8 used):', slotLabel2);

  // save roster, reload page, verify persistence
  await page.click('#roster-save');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(400);
  await page.click('.tab-btn[data-tab="roster"]');
  await page.waitForTimeout(300);
  const pickerOptions = await page.locator('#roster-picker option').allTextContents();
  console.log('saved rosters in picker:', pickerOptions);
  await page.selectOption('#roster-picker', { label: 'The Shadow Tong' });
  await page.waitForTimeout(300);
  const reloadedMemberRows = await page.locator('#roster-members .roster-row').count();
  const reloadedPerkRows = await page.locator('#roster-perks .roster-row').count();
  console.log('after reload+load: member rows:', reloadedMemberRows, 'perk rows:', reloadedPerkRows);

  // remove a member, check slot count updates
  await page.click('#roster-members .roster-row-remove');
  await page.waitForTimeout(150);
  const slotLabel3 = await page.locator('#slot-meter-label').textContent();
  console.log('slot label after removing one member:', slotLabel3);

  console.log('page errors:', errors);
  await page.screenshot({ path: path.join(__dirname, 'shot-roster.png'), fullPage: true });
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
