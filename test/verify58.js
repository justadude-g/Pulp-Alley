// verify58.js — Gadget-flagged Asset card descriptions render the "Gadget"
// and "Mishap" keywords in bold, while the rest of the effect text stays
// regular weight — per explicit user feedback that these are the two main
// keywords a player scans for on a Gear/Gadget card.
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

  // ---- 0. tokenizeRichText correctly flags "Gadget."/"Mishap:" as bold,
  // and leaves everything else (including unrelated words and the plural-
  // free singular "gadget" if lowercase) alone. ----
  const tokenCheck = await page.evaluate(() => {
    const t1 = tokenizeRichText('Gadget. Instead of rolling for a challenge, you may automatically score X successes.');
    const t2 = tokenizeRichText('Mishap: Each time you draw to determine the X number for this Gadget, check the story-icon.');
    return {
      firstWordBold: t1[0].bold && t1[0].text === 'Gadget.',
      restNotBold: t1.slice(1).every(t => !t.bold),
      mishapBold: t2[0].bold && t2[0].text === 'Mishap:',
      secondGadgetBold: t2.find(t => t.text === 'Gadget,')?.bold === true,
    };
  });
  assert(tokenCheck.firstWordBold, 'expected "Gadget." to be flagged bold');
  assert(tokenCheck.restNotBold, 'expected the rest of a Gadget description to NOT be bold');
  assert(tokenCheck.mishapBold, 'expected "Mishap:" to be flagged bold');
  assert(tokenCheck.secondGadgetBold, 'expected "Gadget," inside the Mishap note to also be flagged bold');
  ok('tokenizeRichText correctly flags "Gadget"/"Mishap" word tokens (with attached punctuation) as bold');

  // ---- 1. wrapRichLine, fed a real Gadget item's actual description text
  // (Sonic Spanner, straight from GEAR_ITEMS), preserves the bold flag on
  // "Gadget." and "Mishap:" all the way through word-wrapping, and a bold
  // vs. regular 700/400-weight render of that same word measures a
  // genuinely different width at the same font size — proving the two
  // weights are visually distinct, not just flagged in data. ----
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
  assert.deepStrictEqual(richWrapCheck.boldWords, ['Gadget.', 'Mishap:', 'Gadget,', 'Gadget'],
    `expected "Gadget."/"Mishap:"/"Gadget,"/"Gadget" (all 4 Gadget/Mishap occurrences in Sonic Spanner's text) to survive word-wrap flagged bold, got ${JSON.stringify(richWrapCheck.boldWords)}`);
  assert(richWrapCheck.boldWidth > richWrapCheck.normalWidth,
    `expected the 700-weight render of "Gadget." to measure wider than the 400-weight render at the same font size (bold=${richWrapCheck.boldWidth}, normal=${richWrapCheck.normalWidth})`);
  ok(`wrapRichLine preserves the Gadget/Mishap bold flags through word-wrap, and the bold weight measurably differs from regular (${richWrapCheck.normalWidth.toFixed(1)}px -> ${richWrapCheck.boldWidth.toFixed(1)}px)`);

  console.log('\nAll verify58 checks passed.');
  await browser.close();
  server.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
