const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

const PORT = 8825;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(300);

  async function readLevelHealth() {
    const level = await page.locator('#f-level').inputValue();
    const healthStart = await page.locator('#f-healthStart').inputValue();
    const asterisk = await page.locator('#f-healthAsterisk').isChecked();
    return { level, healthStart, asterisk };
  }

  const expectations = [
    ['Leader', { level: '4', healthStart: 'd10', asterisk: false }],
    ['Sidekick', { level: '3', healthStart: 'd8', asterisk: false }],
    ['Ally', { level: '2', healthStart: 'd6', asterisk: false }],
    ['Follower', { level: '1', healthStart: 'd6', asterisk: true }],
    ['Gang', { level: '2' }], // health die n/a for Gang, not checked here
  ];
  for (const [type, expected] of expectations) {
    await page.selectOption('#f-cardType', type);
    await page.waitForTimeout(120);
    const got = await readLevelHealth();
    const pass = Object.entries(expected).every(([k, v]) => String(got[k]) === String(v));
    console.log(`${type}: level=${got.level} healthStart=${got.healthStart} asterisk=${got.asterisk} -> ${pass ? 'OK' : 'MISMATCH, expected ' + JSON.stringify(expected)}`);
  }

  // Villain/Creature/Custom should NOT force a level -- hand-set a weird
  // level first, then confirm switching to these types leaves it alone.
  await page.selectOption('#f-cardType', 'Leader');
  await page.fill('#f-level', '7');
  await page.selectOption('#f-cardType', 'Villain');
  await page.waitForTimeout(100);
  console.log('Villain after hand-set level 7 (expect untouched, still 7):', await page.locator('#f-level').inputValue());
  await page.selectOption('#f-cardType', 'Creature');
  await page.waitForTimeout(100);
  console.log('Creature (expect still 7):', await page.locator('#f-level').inputValue());
  await page.selectOption('#f-cardType', 'Custom');
  await page.waitForTimeout(100);
  console.log('Custom (expect still 7):', await page.locator('#f-level').inputValue());

  // Manual override still works after auto-fill (auto-fill, not lock)
  await page.selectOption('#f-cardType', 'Sidekick');
  await page.waitForTimeout(100);
  await page.fill('#f-level', '9');
  console.log('Sidekick manually overridden to 9:', await page.locator('#f-level').inputValue());

  // Save a Custom card at level 7, reload it via My Cards, confirm loadCardIntoForm
  // does NOT re-trigger the auto-fill and clobber the saved value.
  await page.click('#btn-new-card');
  await page.fill('#f-name', 'Weird One');
  await page.selectOption('#f-cardType', 'Custom');
  await page.fill('#f-level', '7');
  await page.click('#btn-save-card');
  await page.waitForTimeout(200);
  await page.click('.tab-btn[data-tab="gallery"]');
  await page.waitForTimeout(200);
  await page.click('.gallery-card [data-act="edit"]');
  await page.waitForTimeout(200);
  console.log('reloaded Custom card level (expect still 7, not clobbered by load):', await page.locator('#f-level').inputValue());

  console.log('page errors:', errors);
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
