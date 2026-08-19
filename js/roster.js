// roster.js — builds the A4 print sheet (3x3 grid of standard playing-card-size cards)
// CARD_W/CARD_H are the same standard-playing-card constants defined in
// cardRenderer.js (loaded before this file in index.html) — reused here
// rather than redeclared, since plain <script> files share one global scope.

const A4_W = 2480; // 210mm @ 300dpi
const A4_H = 3508; // 297mm @ 300dpi
const GAP = 16;
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

function cropMark(ctx, x, y, dx, dy, len) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx * len, y + dy * len);
  ctx.stroke();
}

function renderRosterSheet(canvas, images) {
  canvas.width = A4_W;
  canvas.height = A4_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_W, A4_H);

  const slots = gridSlots();
  const markLen = 14;

  ctx.strokeStyle = '#b9c0cc';
  ctx.lineWidth = 1.5;

  slots.forEach((slot, i) => {
    const img = images[i];
    if (img) {
      ctx.save();
      // rounded-corner clip so gaps between cards look clean when cut
      const r = 16;
      ctx.beginPath();
      ctx.moveTo(slot.x + r, slot.y);
      ctx.arcTo(slot.x + slot.w, slot.y, slot.x + slot.w, slot.y + slot.h, r);
      ctx.arcTo(slot.x + slot.w, slot.y + slot.h, slot.x, slot.y + slot.h, r);
      ctx.arcTo(slot.x, slot.y + slot.h, slot.x, slot.y, r);
      ctx.arcTo(slot.x, slot.y, slot.x + slot.w, slot.y, r);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#d8dde5';
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    }

    // crop marks at each corner, pointing outward into the margin/gap
    const corners = [
      { x: slot.x, y: slot.y, dx: -1, dy: 0, dx2: 0, dy2: -1 },
      { x: slot.x + slot.w, y: slot.y, dx: 1, dy: 0, dx2: 0, dy2: -1 },
      { x: slot.x, y: slot.y + slot.h, dx: -1, dy: 0, dx2: 0, dy2: 1 },
      { x: slot.x + slot.w, y: slot.y + slot.h, dx: 1, dy: 0, dx2: 0, dy2: 1 },
    ];
    ctx.strokeStyle = '#b9c0cc';
    ctx.lineWidth = 1.5;
    corners.forEach(c => {
      cropMark(ctx, c.x, c.y, c.dx, c.dy, markLen);
      cropMark(ctx, c.x, c.y, c.dx2, c.dy2, markLen);
    });
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
