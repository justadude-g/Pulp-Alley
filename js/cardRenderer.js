// cardRenderer.js
// Draws a Pulp Alley character card onto a canvas at fixed print resolution.
// Standard playing card @ 300dpi = 2.5in x 3.5in = 750 x 1050 px.

const CARD_W = 750;
const CARD_H = 1050;
const CARD_RADIUS = 34;

const DIE_ORDER = ['d12', 'd10', 'd8', 'd6'];

// Saturated-but-print-safe accents: dark enough to stay legible as text/line
// color on a white background, still read fine on the dark theme too.
// Each default accent corresponds to a Gamegenic Prime Sleeves color, so a
// card's on-screen/printed accent matches the sleeve color a player would
// actually use for that role: Leader=Orange, Sidekick=Green, Ally=Blue,
// Follower=Black, Gang=Dark Gray, Villain=Red, Creature=Purple,
// Custom=Lime. accentColor stays a normal, editable color picker per card
// (see app.js), so this is only ever the starting point. When Card
// Background is one of the Classical (parchment) themes, app.js overrides
// this table and defaults every Card Type to black instead — Classical's
// fixed brown/tan palette reads better with a plain "ink" accent than a
// bright modern color.
//
// level/healthStart/healthAsterisk/maxAbilities/maxAbilityLevel/skillDiceHint
// mirror the fixed character-creation table on Core Rules p. 8-9:
// Leader/Sidekick/Ally/Follower each have a rules-mandated Level, starting
// Health die, ability budget (count + level cap), and a stat-allocation
// guideline (Gang is fixed at Level 2 per p. 21, but tracks Health by model
// count instead of a die, and its stats are auto-calculated from model
// count elsewhere — see app.js/cardRenderer.js's Gang handling).
// Villain/Creature/Custom aren't part of that table — opposition and
// homebrew characters can be any level with any abilities — so those
// fields are left undefined and nothing here ever overrides what the user
// typed for them.
// defaultStats gives the "Reset Stats" button (app.js) something concrete
// to apply: the rulebook only fixes the total dice budget per Card Type
// (skillDiceHint above) and leaves which specific skills get the higher
// tier up to the player. These pick Brawl/Shoot/Might as the "boosted"
// skills by default — matching the same split the Gang stat auto-fill
// already uses (see applyGangStatsFromModels in app.js) — as a valid,
// rules-legal starting point. Every field stays a normal, editable input
// afterward, same as everywhere else in the app.
const TYPE_PRESETS = {
  Leader: {
    // Tailwind's orange-500 (#f97316) reads a bit coral/pink once tinted
    // light for the Stats/Card Type/Health backgrounds (low-alpha tints of
    // a red-leaning orange skew toward salmon) — shifted toward a punchier,
    // more yellow-leaning orange that stays unambiguously "orange" even at
    // low opacity, and reads more distinctly from Villain's red.
    accent: '#f6930a', level: 4, healthStart: 'd10', healthAsterisk: false,
    maxAbilities: 3, maxAbilityLevel: 4,
    skillDiceHint: 'Leader (p.9): pick 4 skills to start at 3d10, the other 2 at 2d8.',
    defaultStats: {
      brawl: { n: 3, d: 10 }, shoot: { n: 3, d: 10 }, might: { n: 3, d: 10 }, finesse: { n: 3, d: 10 },
      dodge: { n: 2, d: 8 }, cunning: { n: 2, d: 8 },
    },
  },
  Sidekick: {
    accent: '#16a34a', level: 3, healthStart: 'd8', healthAsterisk: false,
    maxAbilities: 2, maxAbilityLevel: 3,
    skillDiceHint: 'Sidekick (p.9): pick 3 skills to start at 3d8, the other 3 at 2d6.',
    defaultStats: {
      brawl: { n: 3, d: 8 }, shoot: { n: 3, d: 8 }, might: { n: 3, d: 8 },
      dodge: { n: 2, d: 6 }, cunning: { n: 2, d: 6 }, finesse: { n: 2, d: 6 },
    },
  },
  Ally: {
    accent: '#2563eb', level: 2, healthStart: 'd6', healthAsterisk: false,
    maxAbilities: 1, maxAbilityLevel: 2,
    skillDiceHint: 'Ally (p.9): all skills start at d6 — pick 2 skills at 2 dice, the other 4 at 1 die.',
    defaultStats: {
      brawl: { n: 2, d: 6 }, shoot: { n: 2, d: 6 },
      might: { n: 1, d: 6 }, finesse: { n: 1, d: 6 }, dodge: { n: 1, d: 6 }, cunning: { n: 1, d: 6 },
    },
  },
  Follower: {
    accent: '#000000', level: 1, healthStart: 'd6', healthAsterisk: true,
    maxAbilities: 1, maxAbilityLevel: 1,
    skillDiceHint: 'Follower (p.9): all skills start at 1d6.',
    defaultStats: {
      brawl: { n: 1, d: 6 }, shoot: { n: 1, d: 6 }, might: { n: 1, d: 6 },
      finesse: { n: 1, d: 6 }, dodge: { n: 1, d: 6 }, cunning: { n: 1, d: 6 },
    },
  },
  Villain:  { accent: '#dc2626' },
  Creature: { accent: '#9333ea' },
  Gang:     { accent: '#3f3f46', level: 2 },
  Custom:   { accent: '#84cc16' },
};

// Shared palette for both Classical variants (see THEMES.classical /
// classicalNoSkull below) — kept as one object so the two themes can never
// drift apart on anything except the skull watermark.
const CLASSICAL_BASE = {
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
  // Down/Out pills sit on the health bar's own olive-khaki background
  // (healthBarBg above), so they need an opaque fill of their own — a
  // low-alpha tint (like the other themes use) barely shows up against
  // that background color, leaving Down/Out nearly unreadable. Match the
  // grey already used for the Might/Finesse/Cunning stat row (fixedTint2)
  // instead, with solid dark-ink border/text for contrast.
  downOutFill: '#c1ac9c',
  downOutBorder: 'rgba(36,27,19,0.45)',
  downOutText: '#241b13',
  cornerAccentAlpha: 0,
  // A plain cream/white badge fill was too bright against the aged-parchment
  // palette — it drew the eye away from the rest of the card. A bronze
  // medallion look (warm brown fill, dark ink ring, cream number) reads as
  // period-appropriate and still gives the level number strong contrast.
  badgeFill: '#8a5a34',
  badgeRing: '#3d2614',
  badgeText: '#f5e8cf',
};

// 'ivory' is a near-zero ink-coverage design (still just thin lines, small
// fills, and text — no solid backgrounds), warmed off pure white so a
// printed card doesn't read as a stark printer-paper white against the
// pulp-adventure art style. 'light' (pure white) stays available for
// anyone who wants the coolest, lightest-ink option. Classical (no skull)
// is the app's actual default now — see the Card Background dropdown in
// index.html — with ivory/light offered as lighter-ink alternatives.
// 'dark' is no longer offered in that dropdown (not practical to print),
// but its definition stays here so cards saved with it before this change
// keep rendering correctly.
const THEMES = {
  ivory: {
    bgTop: '#fdfaf2', bgBottom: '#f8f2e6',
    textPrimary: '#181c24',
    textSecondary: '#333a46',
    textMuted: 'rgba(24,28,36,0.45)',
    nameBarBg: 'rgba(60,50,30,0.035)',
    healthBarBg: 'rgba(60,50,30,0.05)',
    borderSubtle: 'rgba(60,50,30,0.14)',
    outerBorder: 'rgba(50,42,26,0.24)',
    placeholderBg: '#f0ece0',
    placeholderPattern: 'rgba(60,50,30,0.07)',
    placeholderText: 'rgba(45,38,25,0.42)',
    tintAlpha: 0.11,
    tint2: 'rgba(24,28,36,0.045)',
    downOutFill: 'rgba(24,28,36,0.02)',
    downOutBorder: 'rgba(24,28,36,0.28)',
    downOutText: 'rgba(24,28,36,0.6)',
    cornerAccentAlpha: 0,
  },
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
    cornerAccentAlpha: 0,
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
  // Colors sampled directly from that template (CLASSICAL_BASE above).
  // classicalNoSkull is the identical palette with the background skull
  // watermark switched off — kept as a separate theme key (rather than a
  // checkbox) so it's picked the same way as every other Card Background
  // option, and so existing saved cards with theme:'classical' keep
  // rendering exactly as before.
  classical: { ...CLASSICAL_BASE, skullWatermark: 'rgba(36,27,19,0.075)' },
  classicalNoSkull: { ...CLASSICAL_BASE },
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

// Portrait's left edge lines up with the Abilities text's left inset
// (abilLeft, below) rather than the card's literal edge, so the two
// columns of content read as aligned; its right edge stays flush to the
// Stats table's left edge (no gap). Stats itself now runs flush to the
// card's right edge (background fill included) instead of stopping short
// of it, and starts further right than before — tightening the label-to-
// dice-value gap inside each row — which hands the reclaimed width to the
// portrait.
const PORTRAIT = { x: 28, y: 132, w: 412, h: 430 };
const STATS = { x: 440, y: 132, w: CARD_W - 440, h: 430 };
const NAME_BAR_H = 118;

function getPortraitBox() { return { ...PORTRAIT }; }
function getThemeNames() { return Object.keys(THEMES); }

// Renders exactly the portion of `img` that's visible inside the portrait
// box at the given pan/zoom (`view`), onto a PORTRAIT.w x PORTRAIT.h
// canvas, and returns it as a PNG data URL. Uses the identical cover-fit +
// clamped-offset math as the portrait block in renderCard() below, so the
// result is pixel-for-pixel what that block would have drawn — just
// captured on its own, sized to only what's ever actually shown, instead
// of keeping the full (possibly much larger) uploaded photo around.
// Transparent areas (possible when `view.scale` is zoomed below 1) are
// left transparent, not filled — matching how the live render lets the
// card's own background gradient show through rather than baking one in.
function renderPortraitCrop(img, view) {
  const boxW = PORTRAIT.w, boxH = PORTRAIT.h;
  const c = document.createElement('canvas');
  c.width = boxW;
  c.height = boxH;
  const ctx = c.getContext('2d');
  const v = view || { scale: 1, offsetX: 0, offsetY: 0 };
  const coverScale = Math.max(boxW / img.width, boxH / img.height) * (v.scale || 1);
  const dw = img.width * coverScale;
  const dh = img.height * coverScale;
  const maxOffX = Math.max(0, (dw - boxW) / 2);
  const maxOffY = Math.max(0, (dh - boxH) / 2);
  const ox = Math.max(-maxOffX, Math.min(maxOffX, v.offsetX || 0));
  const oy = Math.max(-maxOffY, Math.min(maxOffY, v.offsetY || 0));
  const dx = (boxW - dw) / 2 + ox;
  const dy = (boxH - dh) / 2 + oy;
  ctx.drawImage(img, dx, dy, dw, dh);
  return c.toDataURL('image/png');
}

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
  const T = THEMES[data.theme] || THEMES.ivory;
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
  // Sized to fill the 46px-radius badge with much less surrounding empty
  // space, while still leaving safe clearance inside the ring for a
  // worst-case two-digit level (the Level field allows up to 20).
  ctx.font = '700 60px Rajdhani, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(data.level ?? ''), badgeCx, badgeCy + 3);

  // Type tag (top-right pill)
  if (data.cardType) {
    ctx.font = '700 23px Rajdhani, Inter, sans-serif';
    const label = data.cardType.toUpperCase();
    const tw = ctx.measureText(label).width;
    const padX = 16, pillH = 36;
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
  // Image Frame (data.portraitFrame, OFF by default): ON reproduces the
  // original look — an accent-tinted fill behind any transparent areas of
  // the upload, plus a 3px accent border around the whole box. OFF instead
  // fills transparent areas with the card's own background gradient (the
  // same `bg` gradient painted for the whole card above) so a
  // transparent-background PNG blends directly into the card instead of
  // sitting inside a visibly tinted box, and skips the border entirely so
  // the portrait gets the full box. At the default Zoom (1x, the tightest
  // "just covers the box" size) a fully opaque upload covers this fill
  // completely either way, so it only shows through actual transparency —
  // but Zoom can also go below 1x (view.scale below) to shrink the image
  // and show more of it, in which case this same fill shows as visible
  // padding around an otherwise-opaque image too, not just through
  // transparency.
  const showFrame = !!data.portraitFrame;
  // Square corners (radius 0) to match the Stats box beside it — the two
  // sit flush together, and rounded portrait corners next to Stats'
  // square ones used to look mismatched.
  roundedRectPath(ctx, PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h, 0);
  ctx.save();
  ctx.clip();
  if (data.portraitImg) {
    ctx.fillStyle = showFrame ? tint : bg;
  } else {
    ctx.fillStyle = T.placeholderBg;
  }
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
  if (showFrame) {
    // Square corners, matching the clip path above.
    roundedRectPath(ctx, PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h, 0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    ctx.stroke();
  }

  // ---- Abilities geometry + auto-fit font size ----
  const abilTop = PORTRAIT.y + PORTRAIT.h + 22;
  const abilLeft = 28;
  const abilRight = CARD_W - 28;
  const abilMaxWidth = abilRight - abilLeft;
  const healthBarH = 78;
  const abilBottom = CARD_H - healthBarH - (data.quote ? 72 : 14);

  const abilities = (data.abilities || []).filter(a => a.name || a.text);
  // Stats (labels + dice values) always render at exactly the picked
  // Ability Text Size — Stats has its own fixed row height (STATS.h / 6 ≈
  // 71.7px) that comfortably fits any of the four presets (29-42px), so it
  // never needs to shrink and stays a plain, predictable size no matter
  // how long the Abilities text is. Only the Abilities block below
  // auto-fits its own separate space.
  const statsFontSize = data.abilityFontSize || 33;
  let abilFontSize = statsFontSize;
  let lineHeight;
  if (abilities.length) {
    const buildBlocks = (fs) => {
      ctx.font = `400 ${fs}px Inter, sans-serif`;
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
    const available = abilBottom - abilTop;
    const fitsAt = (fs) => {
      const r = buildBlocks(fs);
      const height = r.totalLines * (fs * 1.28) + (abilities.length - 1) * 10;
      return { out: r.out, fits: height <= available };
    };

    var res = fitsAt(abilFontSize);
    // Coarse pass: whole-pixel steps down until it fits, or the
    // print-legibility floor (16px).
    while (!res.fits && abilFontSize > 16) {
      abilFontSize -= 1;
      res = fitsAt(abilFontSize);
    }
    // Fine pass: line-wrapping only reflows text at specific pixel-width
    // thresholds, so the whole-pixel search above can overshoot — dropping
    // one more pixel can drop an entire wrapped line, leaving up to a full
    // line's worth of the Abilities box empty even though a slightly
    // bigger, still-fitting size existed in between (e.g. abilities that
    // wrap to 11 lines at 26px and overflow, but only need 10 at 25.4px —
    // whole-pixel stepping jumps straight past that to 25px/9 lines,
    // wasting the space the extra 0.4px would have recovered). Binary-
    // search the 1px gap between the size that just fit and the next size
    // up (confirmed too big by the loop above) to land right at the real
    // boundary. Capped at the size that fit the search above, so this only
    // recovers wasted space inside an auto-shrink — it never grows the
    // Abilities text past the Ability Text Size actually picked (when that
    // size already fits with no shrink needed, abilFontSize + 1 is already
    // past the pick and the loop below runs zero iterations).
    if (res.fits && abilFontSize + 1 <= statsFontSize) {
      let lo = abilFontSize, hi = abilFontSize + 1;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (fitsAt(mid).fits) lo = mid; else hi = mid;
      }
      // Floor (never round) to 0.1px so the final size is guaranteed to
      // still fit — rounding up could push it just past the boundary the
      // search converged on.
      const refined = Math.floor(lo * 10) / 10;
      const refinedRes = fitsAt(refined);
      if (refinedRes.fits) {
        abilFontSize = refined;
        res = refinedRes;
      }
    }
    lineHeight = Math.round(abilFontSize * 1.28);
  }

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
      ctx.font = `600 ${statsFontSize}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, STATS.x + 20, ry + rowH / 2 + 1);

      // Dice pool value uses the same Inter family and the same fixed
      // statsFontSize as the stat label — bold weight keeps it the visual
      // focal point of the row without making it a different size from the
      // label. A skill set to 0d0 means the character has no rating in it
      // at all (as opposed to a normal, if weak, 1d6) — printed as "–d–"
      // instead of the literal "0d0", which reads as a data-entry mistake
      // rather than a deliberate "no skill here" mark.
      const dieStr = !val ? '—' : (val.n === 0 && val.d === 0) ? '–d–' : `${val.n}d${val.d}`;
      ctx.font = `700 ${statsFontSize}px Inter, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillStyle = accent;
      ctx.fillText(dieStr, STATS.x + STATS.w - 20, ry + rowH / 2 + 1);
    });
    // outer border
    ctx.strokeStyle = T.borderSubtle;
    ctx.lineWidth = 1;
    ctx.strokeRect(STATS.x + 0.5, STATS.y + 0.5, STATS.w - 1, STATS.h - 1);
  }

  if (T.skullWatermark) {
    drawSkullWatermark(ctx, CARD_W / 2, (abilTop + abilBottom) / 2, 260, T.skullWatermark);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (abilities.length) {
    const fontSize = abilFontSize;
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
  // Asterisked characters (Followers, "d6*") have no Down state either —
  // per the rulebook note, they're knocked out on a failed Health check
  // instead of going down, at any point in their sequence.
  const isGangHealth = !!data.health?.isGang;
  const noDownState = isGangHealth || !!data.health?.asterisk;
  const seq = (data.health?.sequence && data.health.sequence.length) ? data.health.sequence : (isGangHealth ? ['5', '4', '3'] : ['d6']);
  const pills = noDownState ? [...seq, 'Out'] : [...seq, 'Down', 'Out'];
  ctx.font = '700 30px Rajdhani, Inter, sans-serif';
  const gap = 14;
  let totalW = 0;
  const widths = pills.map(p => {
    const w = ctx.measureText(p.toUpperCase()).width + 26;
    totalW += w + gap;
    return w;
  });
  totalW -= gap;
  let px = (CARD_W - totalW) / 2;
  const pillH = 42;
  const pillY = hbY + (healthBarH - pillH) / 2; // vertically centered in the bar, not top-hugging
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
