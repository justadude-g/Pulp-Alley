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
// horizontal cut is made once across all three at a time. The dotted guide
// lines below mark exactly those 4 cut lines, drawn edge-to-edge across the
// whole sheet (matching how a guillotine cut actually works) rather than as
// small per-corner tick marks, since flush cards leave no gap for corner
// marks to live in any more.

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

// The straight guillotine cut lines needed to separate the grid: one per
// internal column boundary (vertical cuts) and one per internal row
// boundary (horizontal cuts), each running the full length of the sheet.
function cutLines() {
  const totalW = COLS * CARD_W + (COLS - 1) * GAP;
  const totalH = ROWS * CARD_H + (ROWS - 1) * GAP;
  const marginX = (A4_W - totalW) / 2;
  const marginY = (A4_H - totalH) / 2;
  const vertical = [];
  for (let c = 1; c < COLS; c++) vertical.push(marginX + c * (CARD_W + GAP));
  const horizontal = [];
  for (let r = 1; r < ROWS; r++) horizontal.push(marginY + r * (CARD_H + GAP));
  return { vertical, horizontal };
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

  // Dotted cut-guide lines, full sheet length, at each internal grid
  // boundary — these are the only 4 cuts needed (2 vertical, 2 horizontal)
  // to separate all 9 cards.
  const { vertical, horizontal } = cutLines();
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = '#8a92a0';
  ctx.lineWidth = 2;
  vertical.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, A4_H);
    ctx.stroke();
  });
  horizontal.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(A4_W, y);
    ctx.stroke();
  });
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
