// verify58.js — Gadget-flagged Asset card descriptions render each
// paragraph's OWN LEADING LABEL in bold — e.g. "Gadget.", "BOOM:",
// "Mishap:", "Health:" — while the rest of that paragraph's effect text
// stays regular weight, even where the same keyword repeats later in the
// paragraph (e.g. "the Gadget does not function" inside the Mishap note).
// Per explicit user feedback/screenshot on Boom-Bot: only the label at the
// front of each clause should stand out, not every occurrence of the word.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const assert = require('assert');
const PORT = 8880;
const ROOT = path.join(__dirname, '..');

function ok(label) { console.log('OK  ', label); }

(async () => {
  const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); process.exitCode = 1; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(400);

  // ---- 0. tokenizeRichText flags ONLY the first word of a paragraph, and
  // only when that word itself carries a "." or ":" (a label), leaving
  // every later word — including a later repeat of that same label word —
  // regular. ----
  const tokenCheck = await page.evaluate(() => {
    const t1 = tokenizeRichText('Gadget. Instead of rolling for a challenge, you may automatically score X successes.');
    const t2 = tokenizeRichText('Mishap: Each time you draw to determine the X number for this Gadget, check the story-icon. The Gadget does not function.');
    const t3 = tokenizeRichText('You gain one random level 1 Backup character.');
    return {
      firstWordBold: t1[0].bold && t1[0].text === 'Gadget.',
      restNotBold: t1.slice(1).every(t => !t.bold),
      mishapLabelBold: t2[0].bold && t2[0].text === 'Mishap:',
      midParagraphGadgetNotBold: !t2.find(t => t.text === 'Gadget,')?.bold && !t2.find((t, i) => t.text === 'Gadget' && i > 0)?.bold,
      noLabelWhenNoneLeads: t3.every(t => !t.bold),
    };
  });
  assert(tokenCheck.firstWordBold, 'expected "Gadget." (the paragraph\'s first word) to be flagged bold');
  assert(tokenCheck.restNotBold, 'expected every other word in a "Gadget." paragraph to stay regular weight');
  assert(tokenCheck.mishapLabelBold, 'expected "Mishap:" (the paragraph\'s first word) to be flagged bold');
  assert(tokenCheck.midParagraphGadgetNotBold, 'expected "Gadget," and "Gadget" appearing LATER in the Mishap paragraph to stay regular weight, not bold');
  assert(tokenCheck.noLabelWhenNoneLeads, 'expected a plain-Gear paragraph with no leading label (e.g. "You gain...") to have no bold words at all');
  ok('tokenizeRichText bolds only each paragraph\'s own leading label ("Gadget.", "Mishap:"), never a later repeat of that word');

  // ---- 1. Boom-Bot's actual 3-paragraph description (Gadget tag / BOOM
  // effect / Mishap rule) — straight from GEAR_ITEMS — bolds exactly its
  // three leading labels, matching the screenshot the user flagged. ----
  const boomBotCheck = await page.evaluate(() => {
    const boomBot = GEAR_ITEMS.find(i => i.name === 'Boom-Bot');
    const paragraphs = boomBot.description.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const boldWords = paragraphs.flatMap(p => tokenizeRichText(p).filter(t => t.bold).map(t => t.text));
    return { paragraphCount: paragraphs.length, boldWords };
  });
  assert.strictEqual(boomBotCheck.paragraphCount, 3, `expected Boom-Bot's description to have 3 paragraphs (Gadget tag, BOOM effect, Mishap rule), got ${boomBotCheck.paragraphCount}`);
  assert.deepStrictEqual(boomBotCheck.boldWords, ['Gadget.', 'BOOM:', 'Mishap:'],
    `expected exactly "Gadget."/"BOOM:"/"Mishap:" (one per paragraph, each the paragraph's own leading label) to be bold, got ${JSON.stringify(boomBotCheck.boldWords)}`);
  ok('Boom-Bot\'s description bolds exactly its 3 leading labels: "Gadget.", "BOOM:", "Mishap:" — nothing else');

  // ---- 2. wrapRichLine preserves the leading-label bold flag through
  // word-wrap, and the bold (700) weight measurably differs in width from
  // regular (400) at the same font size — proving the two weights are
  // visually distinct, not just flagged in data. ----
  const richWrapCheck = await page.evaluate(() => {
    const sonicSpanner = GEAR_ITEMS.find(i => i.name === 'Sonic Spanner');
    const paragraphs = sonicSpanner.description.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const normalFont = '400 33px Inter, sans-serif';
    const boldFont = '700 33px Inter, sans-serif';
    const allLines = paragraphs.flatMap(p => wrapRichLine(ctx, tokenizeRichText(p), 500, normalFont, boldFont));
    const boldWords = allLines.flat().filter(t => t.bold).map(t => t.text);

    ctx.font = normalFont;
    const normalWidth = ctx.measureText('Gadget.').width;
    ctx.font = boldFont;
    const boldWidth = ctx.measureText('Gadget.').width;

    return { boldWords, normalWidth, boldWidth };
  });
  assert.deepStrictEqual(richWrapCheck.boldWords, ['Gadget.', 'Mishap:'],
    `expected only "Gadget."/"Mishap:" (Sonic Spanner's two paragraph-leading labels) to survive word-wrap flagged bold, got ${JSON.stringify(richWrapCheck.boldWords)}`);
  assert(richWrapCheck.boldWidth > richWrapCheck.normalWidth,
    `expected the 700-weight render of "Gadget." to measure wider than the 400-weight render at the same font size (bold=${richWrapCheck.boldWidth}, normal=${richWrapCheck.normalWidth})`);
  ok(`wrapRichLine preserves the leading-label bold flags through word-wrap, and the bold weight measurably differs from regular (${richWrapCheck.normalWidth.toFixed(1)}px -> ${richWrapCheck.boldWidth.toFixed(1)}px)`);

  console.log('\nAll verify58 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
