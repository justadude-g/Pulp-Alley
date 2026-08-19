const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

const PORT = 8816;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(500);
  const nameInput = page.locator('.ability-item input[data-field="name"]').first();
  await nameInput.click();
  await nameInput.type('qu', { delay: 30 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'shot-autocomplete.png') });
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
