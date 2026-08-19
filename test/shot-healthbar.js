const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const PORT = 8828;
const ROOT = path.join(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  await page.fill('#f-name', 'Health Bar Check');
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(200);
  let cardDataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  require('fs').writeFileSync(path.join(__dirname, 'card-healthbar-standard.png'), Buffer.from(cardDataUrl.split(',')[1], 'base64'));

  // crop just the bottom health-bar strip for a close look
  const sharp = require('child_process');

  await page.selectOption('#f-cardType', 'Gang');
  await page.fill('#f-gangModels', '7');
  await page.waitForTimeout(200);
  cardDataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  require('fs').writeFileSync(path.join(__dirname, 'card-healthbar-gang.png'), Buffer.from(cardDataUrl.split(',')[1], 'base64'));

  await browser.close();
  server.close();
})();
