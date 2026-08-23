// verify18.js — big errata/content batch:
// - Errata text updates: Commander, Bastion of Science, Network of
//   Supporters, Dominion.
// - New abilities: Acrobat, T.B.D., Trench Fighter, Combat Sense, Sleuth,
//   Snipe, Touched, Fade, Gambler, Wild Card.
// - New Special Burst abilities (Drop/Extended/Heavy/Sustained/Sweeping/
//   Tactical Burst).
// - New Non-Player Characters abilities (Crush, Evasive, Occult, Torment,
//   Toxin, Vicious), tagged "NPC only" in the Ability Library, plus the
//   NPC advanced-rules reference note for Villain/Creature Card Types.
// - New Background Perk: Crewmates.
// - Gangs & Horror errata note.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8841;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 1. Commander ability errata ----
  const commanderText = await page.evaluate(() => findAbilityByName('Commander').text);
  assert(/cannot have more than 1 slot of background perks/i.test(commanderText),
    `expected Commander's text to include the perk-slot errata, got: ${commanderText}`);
  ok('Commander ability includes the "1 slot of background perks" errata');

  // ---- 2. Bastion of Science / Network of Supporters / Dominion perk text ----
  const bastionText = await page.evaluate(() => findPerkByName('Bastion of Science').text);
  assert(/Gear and Gadget assets/i.test(bastionText), `expected Bastion of Science to mention Gear and Gadget assets, got: ${bastionText}`);
  ok('Bastion of Science perk text updated (Gear and Gadget assets)');

  const networkText = await page.evaluate(() => findPerkByName('Network of Supporters').text);
  assert(/Contact assets/i.test(networkText), `expected Network of Supporters to mention Contact assets, got: ${networkText}`);
  ok('Network of Supporters perk text updated (Contact assets)');

  const dominionText = await page.evaluate(() => findPerkByName('Dominion').text);
  assert(/incompatible with Network of Supporters, Bastion of Science, and Call to Arms/i.test(dominionText),
    `expected Dominion's text to state the incompatibility, got: ${dominionText}`);
  assert(/Minions, Gifts, and Cults assets/i.test(dominionText), `expected Dominion's updated wording, got: ${dominionText}`);
  ok('Dominion perk text updated to the new canonical wording');

  // ---- 3. Crewmates perk exists and is addable ----
  const crewmates = await page.evaluate(() => findPerkByName('Crewmates'));
  assert(crewmates && crewmates.slots === 1, `expected a 1-slot Crewmates perk, got: ${JSON.stringify(crewmates)}`);
  ok('Crewmates (1 slot) perk exists in the catalog');

  // ---- 4. New abilities exist with correct levels ----
  const NEW_ABILITIES = {
    'Acrobat': 1, 'T.B.D.': 2, 'Trench Fighter': 2, 'Combat Sense': 3,
    'Sleuth': 3, 'Snipe': 3, 'Touched': 3, 'Fade': 4, 'Gambler': 4, 'Wild Card': 4,
  };
  const found = await page.evaluate((names) => {
    return names.map(n => {
      const a = findAbilityByName(n);
      return a ? { name: n, level: a.level, text: a.text } : null;
    });
  }, Object.keys(NEW_ABILITIES));
  for (const [name, level] of Object.entries(NEW_ABILITIES)) {
    const a = found.find(f => f && f.name === name);
    assert(a, `expected new ability "${name}" to exist in the catalog`);
    assert.strictEqual(a.level, level, `expected "${name}" to be Level ${level}, got Level ${a.level}`);
  }
  // Sleuth's text should not carry the stray trailing "may" fragment from the source.
  const sleuth = found.find(f => f.name === 'Sleuth');
  assert(!/\bmay\s*$/i.test(sleuth.text.trim()), `expected Sleuth's text to be clean (no stray trailing "may"), got: "${sleuth.text}"`);
  ok('All 10 new abilities exist at the correct levels, with clean text');

  // ---- 5. New Special Burst abilities exist (spot check) ----
  const burstNames = ['Drop Burst', 'Extended Burst', 'Heavy Burst', 'Sustained Burst', 'Sweeping Burst', 'Tactical Burst'];
  const burstFound = await page.evaluate((names) => names.map(n => findAbilityByName(n)), burstNames);
  burstFound.forEach((a, i) => assert(a && a.level === 2, `expected Special Burst ability "${burstNames[i]}" to exist at Level 2`));
  ok('All 6 new Special Burst abilities exist at Level 2');

  // ---- 6. New NPC-only abilities exist, tagged, and appear in the library ----
  const npcNames = ['Crush', 'Evasive', 'Occult', 'Torment', 'Toxin', 'Vicious'];
  const npcFound = await page.evaluate((names) => names.map(n => findAbilityByName(n)), npcNames);
  npcFound.forEach((a, i) => assert(a && a.npcOnly === true, `expected NPC-only ability "${npcNames[i]}" to exist and be flagged npcOnly`));
  ok('All 6 new NPC-only abilities exist and are flagged npcOnly');

  // Open the Ability Library and confirm the "NPC only" tag renders for one of them.
  await page.click('#open-ability-library');
  await page.waitForTimeout(150);
  await page.fill('#library-search', 'Vicious');
  await page.waitForTimeout(150);
  const npcTagVisible = await page.locator('.library-item-npc-tag').count();
  assert(npcTagVisible >= 1, 'expected the "NPC only" tag to render in the Ability Library for Vicious');
  ok('Ability Library shows the "NPC only" tag');
  await page.fill('#library-search', '');
  await page.click('#close-ability-library');
  await page.waitForTimeout(150);

  // ---- 7. NPC advanced-rules reference note shows for Villain/Creature only ----
  await page.selectOption('#f-cardType', 'Leader');
  await page.waitForTimeout(150);
  assert(!(await page.isVisible('#npc-hint')), 'expected the NPC hint to be hidden for Leader');
  await page.selectOption('#f-cardType', 'Villain');
  await page.waitForTimeout(150);
  assert(await page.isVisible('#npc-hint'), 'expected the NPC hint to show for Villain');
  await page.selectOption('#f-cardType', 'Creature');
  await page.waitForTimeout(150);
  assert(await page.isVisible('#npc-hint'), 'expected the NPC hint to show for Creature');
  ok('NPC advanced-rules reference note shows only for Villain/Creature Card Types');

  // ---- 8. Gangs & Horror errata note shows for Gang ----
  await page.selectOption('#f-cardType', 'Gang');
  await page.waitForTimeout(150);
  const gangHint = await page.locator('#gang-health-fields').textContent();
  assert(/Gangs & Horror.*roll 1d6 for Horror checks/i.test(gangHint), `expected the Gangs & Horror errata note under Gang Health, got: ${gangHint}`);
  ok('Gangs & Horror errata note shows under Health for Gang cards');

  console.log('\nAll verify18 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
