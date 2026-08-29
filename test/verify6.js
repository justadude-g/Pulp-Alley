const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const handler = require('serve-handler');

const PORT = 8819;
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

  await page.fill('#f-name', 'Dr. Fang');
  await page.selectOption('#f-cardType', 'Villain');
  await page.selectOption('#f-level', '4');
  await page.selectOption('#f-theme', 'classical');
  await page.click('#add-ability');
  const nameInputs = await page.$$('.ability-item input[data-field="name"]');
  await nameInputs[0].fill('Unearthly');
  const textInputs = await page.$$('.ability-item textarea[data-field="text"]');
  await textInputs[0].fill('Cannot run except to rush. Cannot shoot over 12". Enemies must substitute Cunning or Finesse when attacking.');
  await nameInputs[1].fill('Commander');
  await textInputs[1].fill('Add +4 slots to your league roster.');
  await page.waitForTimeout(200);

  const dataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  fs.writeFileSync(path.join(__dirname, 'card-classical.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));

  // now check font size options
  await page.selectOption('#f-abilityFontSize', '42');
  await page.waitForTimeout(200);
  const dataUrl2 = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  fs.writeFileSync(path.join(__dirname, 'card-classical-xl.png'), Buffer.from(dataUrl2.split(',')[1], 'base64'));

  console.log('errors:', errors);
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
