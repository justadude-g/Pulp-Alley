const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const handler = require('serve-handler');
const { createCanvas, loadImage } = (() => { try { return require('canvas'); } catch { return {}; } })();

const PORT = 8813;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  const types = ['Leader', 'Sidekick', 'Ally', 'Follower', 'Villain', 'Creature'];
  const shots = [];
  for (const t of types) {
    await page.fill('#f-name', t + ' Example');
    await page.selectOption('#f-cardType', t);
    await page.waitForTimeout(150);
    const dataUrl = await page.evaluate(() => document.getElementById('card-canvas').toDataURL('image/png'));
    const p = path.join(__dirname, `type-${t}.png`);
    fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'));
    shots.push(p);
  }
  console.log('done', shots);
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
