// cardRenderer.js
// Draws a Pulp Alley character card onto a canvas at fixed print resolution.
// Standard playing card @ 300dpi = 2.5in x 3.5in = 750 x 1050 px.

const CARD_W = 750;
const CARD_H = 1050;
const CARD_RADIUS = 34;

const DIE_ORDER = ['d12', 'd10', 'd8', 'd6'];

// Saturated-but-print-safe accents: dark enough to stay legible as text/line
// color on a white background, still read fine on the dark theme too.
//
// level/healthStart/healthAsterisk mirror the fixed character-creation table
// on Core Rules p. 8-9: Leader/Sidekick/Ally/Follower each have a rules-
// mandated Level and starting Health die (Gang is fixed at Level 2 per
// p. 21, but tracks Health by model count instead of a die — see
// app.js/cardRenderer.js's Gang handling). Villain/Creature/Custom aren't
// part of that table — opposition and homebrew characters can be any level
// — so they're left undefined and never override what the user typed.
const TYPE_PRESETS = {
  Leader:   { accent: '#c2650a', level: 4, healthStart: 'd10', healthAsterisk: false },
  Sidekick: { accent: '#0d9488', level: 3, healthStart: 'd8', healthAsterisk: false },
  Ally:     { accent: '#2563eb', level: 2, healthStart: 'd6', healthAsterisk: false },
  Follower: { accent: '#64748b', level: 1, healthStart: 'd6', healthAsterisk: true },
  Villain:  { accent: '#dc2626' },
  Creature: { accent: '#9333ea' },
  Gang:     { accent: '#57534e', level: 2 },
  Custom:   { accent: '#0d9488' },
};

// Two background themes. 'light' is the default: it's the one that prints
// well on a home inkjet/laser (near-zero solid ink coverage, crisp on
// cardstock). 'dark' is kept for anyone who wants the punchier look for
// screen use / a color laser printer with cheap toner.
const THEMES = {
  light: {
    bgTop: '#ffffff', bgBottom: '#fbfbfa',
    textPrimary: '#181c24',
    textSecondary: '#333a46',
    textMuted: 'rgba(24,28,36,0.45)',
    nameBarBg: 'rgba(24,28,36,0.025)',
    healthBarBg: 'rgba(24,28,36,0.035)',
    borderSubtle: 'rgba(24,28,36,0.12)',
    outerBorder: 'rgba(24,28,36,0.22)',
    placeholderBg: '#f1f3f6',
    placeholderPattern: 'rgba(24,28,36,0.06)',
    placeholderText: 'rgba(24,28,36,0.38)',
    tintAlpha: 0.11,
    tint2: 'rgba(24,28,36,0.045)',
    downOutFill: 'rgba(24,28,36,0.02)',
    downOutBorder: 'rgba(24,28,36,0.28)',
    downOutText: 'rgba(24,28,36,0.6)',
    cornerAccentAlpha: 0.16,
  },
  dark: {
    bgTop: '#12161d', bgBottom: '#0b0e13',
    textPrimary: '#f4f6f8',
    textSecondary: '#d7dbe0',
    textMuted: 'rgba(255,255,255,0.45)',
    nameBarBg: 'rgba(255,255,255,0.03)',
    healthBarBg: 'rgba(255,255,255,0.04)',
    borderSubtle: 'rgba(255,255,255,0.08)',
    outerBorder: 'rgba(255,255,255,0.14)',
    placeholderBg: '#1a2029',
    placeholderPattern: 'rgba(255,255,255,0.035)',
    placeholderText: 'rgba(255,255,255,0.28)',
    tintAlpha: 0.17,
    tint2: 'rgba(148,163,184,0.10)',
    downOutFill: 'rgba(255,255,255,0.06)',
    downOutBorder: 'rgba(255,255,255,0.25)',
    downOutText: 'rgba(255,255,255,0.7)',
    cornerAccentAlpha: 0.10,
  },
  // 'Classical' matches the official Pulp Alley blank character card
  // template: aged parchment paper, terracotta/taupe stat bands, olive
  // health bar, dark typewriter-brown ink, and a dashed cut-guide border.
  // Colors sampled directly from that template.
  classical: {
    bgTop: '#e9cb9f', bgBottom: '#ddbb8a',
    textPrimary: '#241b13',
    textSecondary: '#332617',
    textMuted: 'rgba(36,27,19,0.6)',
    nameBarBg: 'rgba(36,27,19,0.05)',
    healthBarBg: '#bfab63',
    borderSubtle: 'rgba(36,27,19,0.22)',
    outerBorder: 'rgba(20,14,8,0.75)',
    outerBorderDashed: true,
    placeholderBg: '#e7c786',
    placeholderPattern: 'rgba(36,27,19,0.10)',
    placeholderText: 'rgba(36,27,19,0.45)',
    fixedTint: '#ebb185',
    fixedTint2: '#c1ac9c',
    downOutFill: 'rgba(36,27,19,0.05)',
    downOutBorder: 'rgba(36,27,19,0.4)',
    downOutText: 'rgba(36,27,19,0.75)',
    cornerAccentAlpha: 0,
    badgeFill: '#fdf8f0',
    badgeRing: '#865536',
    badgeText: '#241b13',
    skullWatermark: 'rgba(36,27,19,0.075)',
  },
};

// Build a Health dice sequence from a starting die type, e.g. 'd10' -> ['d10','d8','d6']
function healthSequenceFrom(startDie) {
  const idx = DIE_ORDER.indexOf(startDie);
  if (idx === -1) return ['d6'];
  return DIE_ORDER.slice(idx); // e.g. 'd10' -> ['d10','d8','d6']
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shade(hex, percent) {
  const h = hex.replace('#', '');
  let r = parseInt(h.substring(0, 2), 16);
  let g = parseInt(h.substring(2, 4), 16);
  let b = parseInt(h.substring(4, 6), 16);
  r = Math.max(0, Math.min(255, Math.round(r + (percent < 0 ? r : 255 - r) * percent)));
  g = Math.max(0, Math.min(255, Math.round(g + (percent < 0 ? g : 255 - g) * percent)));
  b = Math.max(0, Math.min(255, Math.round(b + (percent < 0 ? b : 255 - b) * percent)));
  return `rgb(${r},${g},${b})`;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + rr.tl, y);
  ctx.lineTo(x + w - rr.tr, y);
  ctx.arcTo(x + w, y, x + w, y + rr.tr, rr.tr);
  ctx.lineTo(x + w, y + h - rr.br);
  ctx.arcTo(x + w, y + h, x + w - rr.br, y + h, rr.br);
  ctx.lineTo(x + rr.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr.bl, rr.bl);
  ctx.lineTo(x, y + rr.tl);
  ctx.arcTo(x, y, x + rr.tl, y, rr.tl);
  ctx.closePath();
}

// Wrap text to a max width, returns array of lines
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Faint stylized skull watermark, echoing the official card template's
// background motif. Drawn as one flat silhouette with the eyes/nose
// punched out via destination-out compositing.
function drawSkullWatermark(ctx, cx, cy, w, color) {
  const s = w / 200;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-70, -15);
  ctx.bezierCurveTo(-70, -95, 70, -95, 70, -15);
  ctx.lineTo(66, 28);
  ctx.bezierCurveTo(66, 52, 52, 58, 40, 58);
  ctx.lineTo(40, 80);
  ctx.lineTo(24, 80);
  ctx.lineTo(24, 58);
  ctx.lineTo(9, 58);
  ctx.lineTo(9, 80);
  ctx.lineTo(-9, 80);
  ctx.lineTo(-9, 58);
  ctx.lineTo(-24, 58);
  ctx.lineTo(-24, 80);
  ctx.lineTo(-40, 80);
  ctx.lineTo(-40, 58);
  ctx.bezierCurveTo(-52, 58, -66, 52, -66, 28);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(-30, -10, 17, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(30, -10, 17, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-11, 26);
  ctx.lineTo(11, 26);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

const PORTRAIT = { x: 24, y: 132, w: 300, h: 430 };
const STATS = { x: 340, y: 132, w: 386, h: 430 };
const NAME_BAR_H = 118;

function getPortraitBox() { return { ...PORTRAIT }; }
function getThemeNames() { return Object.keys(THEMES); }

// data: {
//   name, level, cardType, accentColor, theme: 'light'|'dark',
//   stats: {brawl:{n,d}, shoot:{n,d}, dodge:{n,d}, might:{n,d}, finesse:{n,d}, cunning:{n,d}},
//   abilities: [{name, text}],
//   quote,
//   health: {sequence:['d10','d8','d6'], asterisk:false},
//   portraitImg: HTMLImageElement|null,
//   portraitView: {scale, offsetX, offsetY}  // pixel offsets in canvas space
// }
function renderCard(canvas, data) {
  const ctx = canvas.getContext('2d');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  ctx.clearRect(0, 0, CARD_W, CARD_H);

  const preset = TYPE_PRESETS[data.cardType] || TYPE_PRESETS.Custom;
  const accent = data.accentColor || preset.accent;
  const T = THEMES[data.theme] || THEMES.light;
  // Classical uses the official template's fixed terracotta/taupe bands
  // instead of accent-tinted ones; light/dark tint the stat rows with the
  // chosen accent color.
  const tint = T.fixedTint || hexToRgba(accent, T.tintAlpha);
  const tint2 = T.fixedTint2 || T.tint2;

  ctx.save();
  roundedRectPath(ctx, 0, 0, CARD_W, CARD_H, CARD_RADIUS);
  ctx.clip();

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, T.bgTop);
  bg.addColorStop(1, T.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // subtle corner accent (modern touch, minimal ink)
  ctx.save();
  ctx.globalAlpha = T.cornerAccentAlpha;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(CARD_W - 10 - i * 18, 0);
    ctx.lineTo(CARD_W, 10 + i * 18);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Name bar ----
  ctx.fillStyle = T.nameBarBg;
  ctx.fillRect(0, 0, CARD_W, NAME_BAR_H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, NAME_BAR_H - 4, CARD_W, 4);

  // Level badge — Classical uses the template's brown-ring-on-cream look;
  // light/dark fill the badge solid with the accent color.
  const badgeCx = 85, badgeCy = 59, badgeR = 46;
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = T.badgeFill || accent;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = T.badgeRing || shade(accent, -0.3);
  ctx.stroke();
  ctx.fillStyle = T.badgeText || '#ffffff';
  ctx.font = '700 44px Rajdhani, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(data.level ?? ''), badgeCx, badgeCy + 3);

  // Type tag (top-right pill)
  if (data.cardType) {
    ctx.font = '700 20px Rajdhani, Inter, sans-serif';
    const label = data.cardType.toUpperCase();
    const tw = ctx.measureText(label).width;
    const padX = 16, pillH = 32;
    const pillW = tw + padX * 2;
    const px = CARD_W - 24 - pillW, py = 18;
    roundedRectPath(ctx, px, py, pillW, pillH, pillH / 2);
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + pillW / 2, py + pillH / 2 + 1);
  }

  // Name text (auto-shrink to fit)
  {
    const nameX = 150;
    const nameMaxW = CARD_W - nameX - 24 - (data.cardType ? 150 : 0);
    let fontSize = 42;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let name = data.name || 'Unnamed Character';
    do {
      ctx.font = `700 ${fontSize}px Rajdhani, Inter, sans-serif`;
      if (ctx.measureText(name).width <= nameMaxW || fontSize <= 22) break;
      fontSize -= 2;
    } while (true);
    // If still too wide at minimum size, truncate with an ellipsis rather than
    // letting canvas squash the text horizontally.
    if (ctx.measureText(name).width > nameMaxW) {
      while (name.length > 1 && ctx.measureText(name + '...').width > nameMaxW) {
        name = name.slice(0, -1);
      }
      name = name.replace(/\s+$/, '') + '...';
    }
    ctx.fillStyle = T.textPrimary;
    ctx.fillText(name, nameX, NAME_BAR_H / 2 + 2);
  }

  // ---- Portrait ----
  roundedRectPath(ctx, PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h, 18);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = T.placeholderBg;
  ctx.fillRect(PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h);

  if (data.portraitImg) {
    const img = data.portraitImg;
    const view = data.portraitView || { scale: 1, offsetX: 0, offsetY: 0 };
    const boxW = PORTRAIT.w, boxH = PORTRAIT.h;
    const coverScale = Math.max(boxW / img.width, boxH / img.height) * (view.scale || 1);
    const dw = img.width * coverScale;
    const dh = img.height * coverScale;
    const maxOffX = Math.max(0, (dw - boxW) / 2);
    const maxOffY = Math.max(0, (dh - boxH) / 2);
    const ox = Math.max(-maxOffX, Math.min(maxOffX, view.offsetX || 0));
    const oy = Math.max(-maxOffY, Math.min(maxOffY, view.offsetY || 0));
    const dx = PORTRAIT.x + (boxW - dw) / 2 + ox;
    const dy = PORTRAIT.y + (boxH - dh) / 2 + oy;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    // placeholder pattern
    for (let i = -PORTRAIT.h; i < PORTRAIT.w; i += 24) {
      ctx.beginPath();
      ctx.moveTo(PORTRAIT.x + i, PORTRAIT.y);
      ctx.lineTo(PORTRAIT.x + i + PORTRAIT.h, PORTRAIT.y + PORTRAIT.h);
      ctx.lineWidth = 10;
      ctx.strokeStyle = T.placeholderPattern;
      ctx.stroke();
    }
    ctx.fillStyle = T.placeholderText;
    ctx.font = '600 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UPLOAD', PORTRAIT.x + PORTRAIT.w / 2, PORTRAIT.y + PORTRAIT.h / 2 - 14);
    ctx.fillText('IMAGE', PORTRAIT.x + PORTRAIT.w / 2, PORTRAIT.y + PORTRAIT.h / 2 + 14);
  }
  ctx.restore();
  roundedRectPath(ctx, PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h, 18);
  ctx.lineWidth = 3;
  ctx.strokeStyle = accent;
  ctx.stroke();

  // ---- Stats table ----
  {
    const rows = [
      ['Brawl', data.stats?.brawl],
      ['Shoot', data.stats?.shoot],
      ['Dodge', data.stats?.dodge],
      ['Might', data.stats?.might],
      ['Finesse', data.stats?.finesse],
      ['Cunning', data.stats?.cunning],
    ];
    const rowH = STATS.h / 6;
    rows.forEach(([label, val], i) => {
      const ry = STATS.y + i * rowH;
      ctx.fillStyle = i < 3 ? tint : tint2;
      ctx.fillRect(STATS.x, ry, STATS.w, rowH);
      if (i === 3) {
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(STATS.x, ry, STATS.w, 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = T.textPrimary;
      ctx.font = '600 27px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, STATS.x + 20, ry + rowH / 2 + 1);

      const dieStr = val ? `${val.n}d${val.d}` : '—';
      ctx.font = '700 27px Rajdhani, Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = accent;
      ctx.fillText(dieStr, STATS.x + STATS.w - 20, ry + rowH / 2 + 1);
    });
    // outer border
    ctx.strokeStyle = T.borderSubtle;
    ctx.lineWidth = 1;
    ctx.strokeRect(STATS.x + 0.5, STATS.y + 0.5, STATS.w - 1, STATS.h - 1);
  }

  // ---- Abilities + quote area ----
  const abilTop = PORTRAIT.y + PORTRAIT.h + 22;
  const abilLeft = 28;
  const abilRight = CARD_W - 28;
  const abilMaxWidth = abilRight - abilLeft;
  const healthBarH = 78;
  const abilBottom = CARD_H - healthBarH - (data.quote ? 72 : 14);

  if (T.skullWatermark) {
    drawSkullWatermark(ctx, CARD_W / 2, (abilTop + abilBottom) / 2, 260, T.skullWatermark);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const abilities = (data.abilities || []).filter(a => a.name || a.text);
  if (abilities.length) {
    let fontSize = data.abilityFontSize || 33;
    let lineHeight;
    const buildBlocks = (fs) => {
      ctx.font = `400 ${fs}px Inter, sans-serif`;
      lineHeight = Math.round(fs * 1.28);
      let totalLines = 0;
      const out = abilities.map(a => {
        const nameStr = a.name ? a.name + (a.text ? ': ' : '') : '';
        const full = nameStr + (a.text || '');
        const lines = wrapLines(ctx, full, abilMaxWidth);
        totalLines += lines.length;
        return { nameStr, text: a.text || '', lines };
      });
      return { out, totalLines };
    };
    let res = buildBlocks(fontSize);
    while ((res.totalLines * (fontSize * 1.28) + (abilities.length - 1) * 10) > (abilBottom - abilTop) && fontSize > 16) {
      fontSize -= 1;
      res = buildBlocks(fontSize);
    }
    lineHeight = Math.round(fontSize * 1.28);
    let y = abilTop + fontSize;
    for (const block of res.out) {
      ctx.font = `400 ${fontSize}px Inter, sans-serif`;
      // draw first line with bold name prefix
      let firstLine = block.lines[0] || '';
      if (block.nameStr && firstLine.startsWith(block.nameStr.trim().replace(/:$/, ''))) {
        ctx.font = `700 ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = accent;
        ctx.fillText(block.nameStr, abilLeft, y);
        const w = ctx.measureText(block.nameStr).width;
        ctx.font = `400 ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = T.textSecondary;
        ctx.fillText(firstLine.slice(block.nameStr.length), abilLeft + w, y);
      } else {
        ctx.fillStyle = T.textSecondary;
        ctx.fillText(firstLine, abilLeft, y);
      }
      y += lineHeight;
      for (let i = 1; i < block.lines.length; i++) {
        ctx.fillStyle = T.textSecondary;
        ctx.font = `400 ${fontSize}px Inter, sans-serif`;
        ctx.fillText(block.lines[i], abilLeft, y);
        y += lineHeight;
      }
      y += 8;
    }
  }

  // Quote — sized to stay legible once printed at true card size (2.5"x3.5").
  if (data.quote) {
    const quoteFontSize = 26;
    const quoteLineHeight = 32;
    ctx.font = `italic 400 ${quoteFontSize}px Inter, sans-serif`;
    ctx.fillStyle = T.textMuted;
    ctx.textAlign = 'center';
    const lines = wrapLines(ctx, `“${data.quote}”`, abilMaxWidth);
    let qy = CARD_H - healthBarH - 18 - (lines.length - 1) * quoteLineHeight;
    for (const l of lines) {
      ctx.fillText(l, CARD_W / 2, qy);
      qy += quoteLineHeight;
    }
    ctx.textAlign = 'left';
  }

  // ---- Health bar ----
  const hbY = CARD_H - healthBarH;
  ctx.fillStyle = T.healthBarBg;
  ctx.fillRect(0, hbY, CARD_W, healthBarH);
  ctx.fillStyle = accent;
  ctx.fillRect(0, hbY, CARD_W, 3);

  // Gangs never roll Health checks — instead of a die-based track ending in
  // Down/Out, they show a model-count track (e.g. 5 → 4 → 3) ending in a
  // single Out state (knocked out at 2 models or fewer, no "Down" state).
  const isGangHealth = !!data.health?.isGang;
  const seq = (data.health?.sequence && data.health.sequence.length) ? data.health.sequence : (isGangHealth ? ['5', '4', '3'] : ['d6']);
  const pills = isGangHealth ? [...seq, 'Out'] : [...seq, 'Down', 'Out'];
  ctx.font = '700 24px Rajdhani, Inter, sans-serif';
  const gap = 14;
  let totalW = 0;
  const widths = pills.map(p => {
    const w = ctx.measureText(p.toUpperCase()).width + 26;
    totalW += w + gap;
    return w;
  });
  totalW -= gap;
  let px = (CARD_W - totalW) / 2;
  const pillY = hbY + 14, pillH = 34;
  pills.forEach((p, i) => {
    const w = widths[i];
    const isDie = i < seq.length;
    roundedRectPath(ctx, px, pillY, w, pillH, pillH / 2);
    ctx.fillStyle = isDie ? tint : T.downOutFill;
    ctx.fill();
    ctx.strokeStyle = isDie ? accent : T.downOutBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = isDie ? accent : T.downOutText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.toUpperCase() + (isDie && data.health?.asterisk && i === 0 ? '*' : ''), px + w / 2, pillY + pillH / 2 + 2);
    px += w + gap;
  });

  ctx.restore(); // end clip

  // outer border stroke — doubles as a cut guide when printing a single card
  roundedRectPath(ctx, 1, 1, CARD_W - 2, CARD_H - 2, CARD_RADIUS);
  ctx.lineWidth = T.outerBorderDashed ? 2.5 : 2;
  ctx.strokeStyle = T.outerBorder;
  if (T.outerBorderDashed) ctx.setLineDash([10, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
}
