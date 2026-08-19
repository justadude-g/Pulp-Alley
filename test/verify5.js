const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

const PORT = 8817;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // open library
  await page.click('#open-ability-library');
  await page.waitForTimeout(200);
  const modalVisible = await page.isVisible('#ability-library-modal .modal-panel');
  console.log('modal visible:', modalVisible);

  const headingsAll = await page.locator('.library-level-heading').allTextContents();
  console.log('headings (All filter):', headingsAll);

  // filter to level 2
  await page.click('.level-btn[data-level="2"]');
  await page.waitForTimeout(150);
  const headingsL2 = await page.locator('.library-level-heading').allTextContents();
  const itemCountL2 = await page.locator('.library-item').count();
  console.log('headings (Level 2 filter):', headingsL2, 'item count:', itemCountL2);

  // search within level 2
  await page.fill('#library-search', 'burst');
  await page.waitForTimeout(150);
  const namesFiltered = await page.locator('.library-item-name').allTextContents();
  console.log('search "burst" within L2:', namesFiltered);

  // clear search, go back to All, add "Agile" (level 1)
  await page.fill('#library-search', '');
  await page.click('.level-btn[data-level="all"]');
  await page.waitForTimeout(150);
  await page.fill('#library-search', 'Agile');
  await page.waitForTimeout(150);
  await page.click('.library-add-btn');
  await page.waitForTimeout(150);

  // modal should still be open
  const stillOpenAfterAdd = await page.isVisible('#ability-library-modal .modal-panel');
  console.log('modal still open after add:', stillOpenAfterAdd);

  // click same + again -> should show duplicate feedback, not add a second row
  await page.click('.library-add-btn');
  await page.waitForTimeout(150);

  // close modal, check the card form for the added ability
  await page.click('#close-ability-library');
  await page.waitForTimeout(150);
  const firstAbilityName = await page.locator('.ability-item input[data-field="name"]').first().inputValue();
  const firstAbilityText = await page.locator('.ability-item textarea[data-field="text"]').first().inputValue();
  const abilityRowCount = await page.locator('.ability-item').count();
  console.log('first ability row:', firstAbilityName, '|', firstAbilityText);
  console.log('total ability rows after adding once + duplicate click:', abilityRowCount);

  // Escape key closes modal
  await page.click('#open-ability-library');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const hiddenAfterEsc = await page.locator('#ability-library-modal').evaluate(el => el.classList.contains('hidden'));
  console.log('hidden after Escape:', hiddenAfterEsc);

  console.log('page errors:', errors);
  await page.screenshot({ path: path.join(__dirname, 'shot-library-final.png'), fullPage: true });
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
