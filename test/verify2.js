const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const handler = require('serve-handler');

const PORT = 8812;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(500);

  // Stress test: long name, max level, many long abilities, no portrait, no
  // quote. (Level used to be a free-typed number and this stress-tested a
  // two-digit value; it's now a 0-4 dropdown, so the two-digit badge-size
  // safety margin is covered separately in verify29.js instead.)
  await page.fill('#f-name', 'Baroness Von Wrecking-Ball The Unstoppable Engine of Ruin');
  await page.selectOption('#f-level', '4');
  await page.selectOption('#f-cardType', 'Villain');

  const longText = 'This ability has a very long description that should wrap across multiple lines and force the auto-fit sizer to shrink the font so everything still fits neatly above the health bar without overlapping any other element on the card.';
  const names = ['Unearthly', 'Cursed Presence', 'Commander', 'Iron Will', 'Death Ray', 'Regeneration'];
  for (let i = 0; i < names.length; i++) {
    if (i > 0) await page.click('#add-ability');
    const nameInputs = await page.$$('.ability-item input[data-field="name"]');
    const textInputs = await page.$$('.ability-item textarea[data-field="text"]');
    await nameInputs[i].fill(names[i]);
    await textInputs[i].fill(longText);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'shot-stress.png'), fullPage: true });
  const dataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  fs.writeFileSync(path.join(__dirname, 'card-stress.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));

  // now fill 9 cards for full-grid print sheet test
  for (let i = 1; i <= 9; i++) {
    await page.click('#btn-new-card');
    await page.fill('#f-name', 'Card ' + i);
    await page.click('#btn-save-card');
    await page.waitForTimeout(150);
  }
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(400);
  const total = await page.$$eval('.gallery-card', els => els.length);
  for (let i = 0; i < Math.min(9, total); i++) {
    const c = (await page.$$('.gallery-card'))[i];
    await c.click();
    await page.waitForTimeout(80);
  }
  await page.click('.tab-btn[data-tab="print"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, 'shot-print-full.png'), fullPage: true });

  console.log('errors:', errors);
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
