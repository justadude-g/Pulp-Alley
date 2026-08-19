const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const PORT = 8826;
const ROOT = path.join(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  await page.fill('#f-name', 'The Raven');
  await page.selectOption('#f-cardType', 'Leader');
  await page.fill('.ability-item input[data-field="name"]', 'Marksman');
  await page.fill('.ability-item textarea[data-field="text"]', 'Add +1 die to Shoot.');
  await page.fill('#f-quote', "Mark my words. I will have my revenge, one way or another.");
  await page.waitForTimeout(300);

  // confirm the Footer field is gone
  const footerFieldExists = await page.locator('#f-footer').count();
  console.log('footer field still in DOM (expect 0):', footerFieldExists);

  const cardDataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  require('fs').writeFileSync(path.join(__dirname, 'card-quote.png'), Buffer.from(cardDataUrl.split(',')[1], 'base64'));

  await browser.close();
  server.close();
})();
