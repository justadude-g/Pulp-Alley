const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const PORT = 8827;
const ROOT = path.join(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  await page.fill('#f-name', 'Stress Test');
  await page.selectOption('#f-cardType', 'Leader');

  // push worst-case wide values into every stat (double-digit dice count +
  // largest die) to check for overlap with the longest labels (Finesse/Cunning)
  const stats = ['brawl', 'might', 'shoot', 'finesse', 'dodge', 'cunning'];
  for (const s of stats) {
    const row = page.locator(`.stat-row[data-stat="${s}"]`);
    await row.locator('select.stat-n').selectOption('4');
    await row.locator('select.stat-d').selectOption('12');
  }
  await page.waitForTimeout(300);

  const cardDataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  require('fs').writeFileSync(path.join(__dirname, 'card-dicesize.png'), Buffer.from(cardDataUrl.split(',')[1], 'base64'));

  await browser.close();
  server.close();
})();
