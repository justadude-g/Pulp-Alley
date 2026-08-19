const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

const PORT = 8814;
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

  const nameInput = page.locator('.ability-item input[data-field="name"]').first();
  await nameInput.click();
  await nameInput.type('Mark', { delay: 30 });
  await page.waitForTimeout(200);

  const suggCount = await page.locator('.ability-suggestions .sugg-item').count();
  console.log('suggestions for "Mark":', suggCount);
  const suggTexts = await page.locator('.ability-suggestions .sugg-name').allTextContents();
  console.log('names:', suggTexts);

  // click the "Marksman" suggestion
  await page.locator('.ability-suggestions .sugg-item', { hasText: 'Marksman' }).first().click();
  await page.waitForTimeout(150);

  const nameVal = await nameInput.inputValue();
  const textVal = await page.locator('.ability-item textarea[data-field="text"]').first().inputValue();
  console.log('name field:', nameVal);
  console.log('text field:', textVal);

  // suggestions should be closed now
  const stillOpen = await page.locator('.ability-suggestions').count();
  console.log('suggestions still open after pick:', stillOpen);

  // test keyboard nav: second ability row, arrow down then enter
  await page.click('#add-ability');
  const secondNameInput = page.locator('.ability-item input[data-field="name"]').nth(1);
  await secondNameInput.click();
  await secondNameInput.type('Quick', { delay: 30 });
  await page.waitForTimeout(200);
  await secondNameInput.press('ArrowDown');
  await secondNameInput.press('ArrowDown');
  await secondNameInput.press('Enter');
  await page.waitForTimeout(150);
  const secondVal = await secondNameInput.inputValue();
  console.log('second row after keyboard select:', secondVal);

  // custom (non-catalog) ability should NOT autofill and NOT throw
  await page.click('#add-ability');
  const thirdNameInput = page.locator('.ability-item input[data-field="name"]').nth(2);
  await thirdNameInput.click();
  await thirdNameInput.type('Totally Made Up Thing', { delay: 10 });
  await page.waitForTimeout(150);
  const thirdSuggCount = await page.locator('.ability-item').nth(2).locator('.ability-suggestions .sugg-item').count();
  console.log('suggestions for gibberish input:', thirdSuggCount);

  console.log('page errors:', errors);
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
