// roster.js — builds the A4 print sheet (3x3 grid of standard playing-card-size cards)
// CARD_W/CARD_H are the same standard-playing-card constants defined in
// cardRenderer.js (loaded before this file in index.html) — reused here
// rather than redeclared, since plain <script> files share one global scope.
//
// Cards sit flush against their neighbours (GAP=0) instead of with a gap
// between them, per explicit user request: with a 3x3 grid flush like this,
// separating all 9 cards on a guillotine paper cutter takes exactly 2 full
// vertical cuts (splitting the 3 columns) + 2 full horizontal cuts
// (splitting the 3 rows) = 4 cuts total, stacking the column strips so each
// horizontal cut is made once across all three at a time.
//
// The cut-guide marks are short tick marks in the page margin around the
// outside of the grid — never a line drawn across a card — matching a
// reference commercial print-and-play sheet the user supplied (official
// Star Wars: Legion Command Cards). That sheet marks each cut line only
// where it crosses the sheet's outer edge: a short tick in the top/bottom
// margin for each vertical cut, a short tick in the left/right margin for
// each horizontal cut, offset from the card edge by a small gap, with nothing
// drawn at the interior points where 4 cards meet flush. See cropMarks()
// below. The two interior lines are the only cuts actually needed to free
// all 9 cards; the tick marks at the sheet's own outer edge (where the
// grid's bounding box meets the page) are the same style, for trimming the
// surrounding white margin if the user wants to — an optional 5th/6th cut,
// not one of the required four.

const A4_W = 2480; // 210mm @ 300dpi
const A4_H = 3508; // 297mm @ 300dpi
const GAP = 0;
const COLS = 3, ROWS = 3;

function gridSlots() {
  const totalW = COLS * CARD_W + (COLS - 1) * GAP;
  const totalH = ROWS * CARD_H + (ROWS - 1) * GAP;
  const marginX = (A4_W - totalW) / 2;
  const marginY = (A4_H - totalH) / 2;
  const slots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      slots.push({
        x: marginX + c * (CARD_W + GAP),
        y: marginY + r * (CARD_H + GAP),
        w: CARD_W,
        h: CARD_H,
      });
    }
  }
  return slots;
}

// Every vertical and horizontal grid line bounding the card block: COLS+1
// x-positions (outer left edge, each internal column boundary, outer right
// edge) and ROWS+1 y-positions, in sheet coordinates.
function gridLines() {
  const totalW = COLS * CARD_W + (COLS - 1) * GAP;
  const totalH = ROWS * CARD_H + (ROWS - 1) * GAP;
  const marginX = (A4_W - totalW) / 2;
  const marginY = (A4_H - totalH) / 2;
  const xs = [];
  for (let c = 0; c <= COLS; c++) xs.push(marginX + c * (CARD_W + GAP));
  const ys = [];
  for (let r = 0; r <= ROWS; r++) ys.push(marginY + r * (CARD_H + GAP));
  return { xs, ys };
}

// Short tick marks in the page margin, one pair per grid line, never drawn
// across any card — see the file header comment above for the reasoning.
function cropMarks(ctx) {
  const { xs, ys } = gridLines();
  const top = ys[0], bottom = ys[ys.length - 1];
  const left = xs[0], right = xs[xs.length - 1];
  const gap = 10; // clearance between the card edge and where a tick starts
  const len = 26; // tick length

  ctx.save();
  ctx.strokeStyle = '#3a4150';
  ctx.lineWidth = 2;

  // A vertical tick at the top and bottom margins for every vertical grid
  // line (the 2 internal column boundaries plus the block's own left/right
  // edges) — this is where each vertical cut would enter/exit the sheet.
  xs.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, top - gap);
    ctx.lineTo(x, top - gap - len);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, bottom + gap);
    ctx.lineTo(x, bottom + gap + len);
    ctx.stroke();
  });

  // A horizontal tick at the left and right margins for every horizontal
  // grid line, same idea.
  ys.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(left - gap, y);
    ctx.lineTo(left - gap - len, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right + gap, y);
    ctx.lineTo(right + gap + len, y);
    ctx.stroke();
  });

  ctx.restore();
}

function renderRosterSheet(canvas, images) {
  canvas.width = A4_W;
  canvas.height = A4_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_W, A4_H);

  const slots = gridSlots();

  slots.forEach((slot, i) => {
    const img = images[i];
    if (img) {
      ctx.drawImage(img, slot.x, slot.y, slot.w, slot.h);
    } else {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#d8dde5';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    }
  });

  cropMarks(ctx);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
