const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const handler = require('serve-handler');

const PORT = 8811;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  console.log('server up on', PORT);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(String(err)));

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(800);

  // fill form
  await page.fill('#f-name', 'Jax "Blackout" Rourke');
  await page.selectOption('#f-cardType', 'Sidekick');
  await page.selectOption('#f-level', '3');
  await page.fill('#f-quote', "Lights out, pal.");

  // abilities
  await page.fill('.ability-item input[data-field="name"]', 'Marksman');
  await page.fill('.ability-item textarea[data-field="text"]', 'Included above. Re-roll one failed Shoot die per activation.');
  await page.click('#add-ability');
  const abilityInputs = await page.$$('.ability-item input[data-field="name"]');
  await abilityInputs[1].fill('Cyber Reflexes');
  const abilityTexts = await page.$$('.ability-item textarea[data-field="text"]');
  await abilityTexts[1].fill('Gain a +1 bonus to Dodge when targeted at range.');

  // upload portrait
  const samplePortrait = '/mnt/user-data/uploads/Pulp Alley/Sample Card 1.png';
  await page.setInputFiles('#f-portrait', samplePortrait);
  await page.waitForTimeout(400);

  // drag portrait a bit
  const box = await page.locator('#card-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.35, { steps: 5 });
  await page.mouse.up();
  await page.fill('#f-zoom', '1.3');
  await page.dispatchEvent('#f-zoom', 'input');
  await page.waitForTimeout(300);

  const canvasSize = await page.evaluate(() => {
    const c = document.getElementById('card-canvas');
    return { w: c.width, h: c.height };
  });
  console.log('card canvas size:', canvasSize);

  await page.screenshot({ path: path.join(__dirname, 'shot-designer.png'), fullPage: true });

  // export raw card PNG at native res
  const cardDataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
  fs.writeFileSync(path.join(__dirname, 'card-export.png'), Buffer.from(cardDataUrl.split(',')[1], 'base64'));

  // save to gallery
  await page.click('#btn-save-card');
  await page.waitForTimeout(300);

  // save a second card (Leader, no portrait) to test multi-select
  await page.click('#btn-new-card');
  await page.fill('#f-name', 'Dr. Voss');
  await page.selectOption('#f-cardType', 'Leader');
  await page.selectOption('#f-level', '4');
  await page.click('#btn-save-card');
  await page.waitForTimeout(300);

  // go to gallery
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(400);
  const galleryCount = await page.$$eval('.gallery-card', els => els.length);
  console.log('gallery cards:', galleryCount);
  await page.screenshot({ path: path.join(__dirname, 'shot-gallery.png'), fullPage: true });

  // select both cards (re-query each time since gallery re-renders on click)
  const galleryTotal = await page.$$eval('.gallery-card', els => els.length);
  for (let i = 0; i < galleryTotal; i++) {
    const c = (await page.$$('.gallery-card'))[i];
    await c.click();
    await page.waitForTimeout(150);
  }

  // go to print sheet
  await page.click('.tab-btn[data-tab="print"]');
  await page.waitForTimeout(500);
  const sheetSize = await page.evaluate(() => {
    const c = document.querySelector('.sheet-page-canvas');
    return { w: c.width, h: c.height };
  });
  console.log('sheet canvas size:', sheetSize);
  await page.screenshot({ path: path.join(__dirname, 'shot-print.png'), fullPage: true });

  const sheetDataUrl = await page.evaluate(() => document.querySelector('.sheet-page-canvas').toDataURL('image/png'));
  fs.writeFileSync(path.join(__dirname, 'sheet-export.png'), Buffer.from(sheetDataUrl.split(',')[1], 'base64'));

  console.log('console/page errors:', errors);

  await browser.close();
  server.close();
}

main().catch(e => { console.error(e); process.exit(1); });
