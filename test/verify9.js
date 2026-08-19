const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const handler = require('serve-handler');

const PORT = 8823;
const ROOT = path.join(__dirname, '..');

async function main() {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ---- Context A: build data, export a backup ----
  const ctxA = await browser.newContext({ acceptDownloads: true });
  const pageA = await ctxA.newPage();
  const errorsA = [];
  pageA.on('pageerror', e => errorsA.push(String(e)));
  pageA.on('console', m => { if (m.type() === 'error') errorsA.push(m.text()); });

  const dialogsA = [];
  pageA.on('dialog', async (d) => { dialogsA.push(d.message()); await d.accept(); });

  await pageA.goto(`http://localhost:${PORT}/index.html`);
  await pageA.waitForTimeout(300);

  // exporting with nothing saved yet -> "nothing saved" alert, no download
  await pageA.click('#btn-export-backup');
  await pageA.waitForTimeout(200);
  console.log('alert on empty export:', dialogsA);
  dialogsA.length = 0;

  // save a card
  await pageA.fill('#f-name', 'Doc Thunderbolt');
  await pageA.selectOption('#f-cardType', 'Leader');
  await pageA.click('#btn-save-card');
  await pageA.waitForTimeout(200);

  // save a gang card too, to exercise gang fields round-tripping through backup
  await pageA.click('#btn-new-card');
  await pageA.fill('#f-name', 'Alley Rats');
  await pageA.selectOption('#f-cardType', 'Gang');
  await pageA.fill('#f-gangModels', '6');
  await pageA.click('#btn-save-card');
  await pageA.waitForTimeout(200);

  // build + save a roster
  await pageA.click('.tab-btn[data-tab="roster"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#roster-name', 'The Riverside Crew');
  await pageA.click('#open-colleague-picker');
  await pageA.waitForTimeout(150);
  await pageA.locator('#colleague-picker-list .library-add-btn').first().click();
  await pageA.waitForTimeout(150);
  await pageA.click('#close-colleague-picker');
  await pageA.click('#roster-save');
  await pageA.waitForTimeout(250);

  // export
  const [download] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.click('#btn-export-backup'),
  ]);
  const backupPath = path.join(__dirname, 'backup-download.json');
  await download.saveAs(backupPath);
  const backupJson = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log('exported file: app=', backupJson.app, 'schemaVersion=', backupJson.schemaVersion,
    'cards=', backupJson.cards.length, 'rosters=', backupJson.rosters.length);
  console.log('exported card names:', backupJson.cards.map(c => c.formData?.name));
  console.log('exported gang card has portrait/png data URLs present:',
    backupJson.cards.every(c => typeof c.pngDataURL === 'string' && c.pngDataURL.startsWith('data:image')));

  console.log('context A page errors:', errorsA);
  await ctxA.close();

  // ---- Context B: fresh browser storage (simulates a different device), import the backup ----
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  const errorsB = [];
  pageB.on('pageerror', e => errorsB.push(String(e)));
  pageB.on('console', m => { if (m.type() === 'error') errorsB.push(m.text()); });
  const dialogsB = [];
  pageB.on('dialog', async (d) => { dialogsB.push(d.message()); await d.accept(); });

  await pageB.goto(`http://localhost:${PORT}/index.html`);
  await pageB.waitForTimeout(300);

  // confirm fresh context truly starts empty
  await pageB.click('.tab-btn[data-tab="gallery"]');
  await pageB.waitForTimeout(200);
  const emptyBefore = await pageB.locator('#gallery-empty').isVisible();
  console.log('fresh context gallery empty before import:', emptyBefore);

  // set files directly on the hidden input (equivalent end-state to using
  // the "Import Backup" button's native file picker, without needing a
  // real OS file dialog in a headless run)
  await pageB.setInputFiles('#import-backup-file', backupPath);
  await pageB.waitForTimeout(300);
  console.log('import confirm dialog text includes counts:', dialogsB[0]);

  await pageB.waitForTimeout(300);
  const statusMsg = await pageB.locator('#save-status').textContent();
  console.log('import status message:', statusMsg);

  await pageB.click('.tab-btn[data-tab="gallery"]');
  await pageB.waitForTimeout(200);
  const cardNames = await pageB.locator('.gc-name').allTextContents();
  console.log('cards visible in fresh context after import:', cardNames);

  await pageB.click('.tab-btn[data-tab="roster"]');
  await pageB.waitForTimeout(200);
  const rosterOptions = await pageB.locator('#roster-picker option').allTextContents();
  console.log('rosters visible in fresh context after import:', rosterOptions);

  // re-importing the same file should be a safe no-op merge (overwrite by id, not duplicate)
  await pageB.setInputFiles('#import-backup-file', backupPath);
  await pageB.waitForTimeout(300);
  await pageB.click('.tab-btn[data-tab="gallery"]');
  await pageB.waitForTimeout(200);
  const cardNamesAfterReimport = await pageB.locator('.gc-name').allTextContents();
  console.log('cards after re-importing same backup (expect same 2, no dupes):', cardNamesAfterReimport);

  console.log('context B page errors:', errorsB);

  fs.unlinkSync(backupPath);
  await ctxB.close();
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
