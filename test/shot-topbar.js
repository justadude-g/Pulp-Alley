const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const PORT = 8824;
const ROOT = path.join(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 300 } });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'shot-topbar.png') });

  // also re-confirm file:// still works with the new backup buttons present
  const page2 = await browser.newPage();
  const errors = [];
  page2.on('pageerror', e => errors.push(String(e)));
  await page2.goto('file://' + ROOT + '/index.html');
  await page2.waitForTimeout(500);
  await page2.click('.tab-btn[data-tab="roster"]');
  const rosterActive = await page2.locator('#tab-roster').evaluate(el => el.classList.contains('active'));
  console.log('file:// still works, roster tab active:', rosterActive, '| errors:', errors);

  await browser.close();
  server.close();
})();
