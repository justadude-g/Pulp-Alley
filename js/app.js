import { renderCard, healthSequenceFrom, getPortraitBox, TYPE_PRESETS, CARD_W, CARD_H } from './cardRenderer.js';
import { saveCard, deleteCard, getAllCards, getCard } from './db.js';
import { renderRosterSheet, loadImage } from './roster.js';
import { searchAbilities } from './abilitiesData.js';

// ---------------- State ----------------
const state = {
  editingId: null,
  portraitImg: null,
  portraitOriginalDataURL: null,
  portraitView: { scale: 1, offsetX: 0, offsetY: 0 },
  abilities: [{ name: '', text: '' }],
  selected: new Set(),
};

const canvas = document.getElementById('card-canvas');

// ---------------- Tabs ----------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});
function activateTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'gallery') refreshGallery();
  if (tab === 'print') refreshPrintSheet();
}
document.getElementById('go-print').addEventListener('click', () => activateTab('print'));

// ---------------- Ability rows ----------------
const abilitiesList = document.getElementById('abilities-list');
function renderAbilityRows() {
  abilitiesList.innerHTML = '';
  state.abilities.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'ability-item';
    row.innerHTML = `
      <div class="ability-name-wrap">
        <input type="text" placeholder="Ability name (e.g. Marksman)" value="${escapeAttr(a.name)}" data-idx="${i}" data-field="name" autocomplete="off">
      </div>
      <textarea placeholder="Ability description..." data-idx="${i}" data-field="text">${escapeHtml(a.text)}</textarea>
      <button type="button" class="ability-remove" data-idx="${i}">Remove</button>
    `;
    abilitiesList.appendChild(row);
  });
  abilitiesList.querySelectorAll('input,textarea').forEach(el => {
    el.addEventListener('input', () => {
      const idx = +el.dataset.idx;
      state.abilities[idx][el.dataset.field] = el.value;
      updatePreview();
      if (el.dataset.field === 'name') showSuggestions(el, idx);
    });
  });
  abilitiesList.querySelectorAll('input[data-field="name"]').forEach(el => {
    el.addEventListener('keydown', (e) => handleSuggestionKeydown(e, el));
    el.addEventListener('blur', () => {
      // delay so a click on a suggestion registers before the list is removed
      setTimeout(() => closeSuggestions(el), 150);
    });
  });
  abilitiesList.querySelectorAll('.ability-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.abilities.splice(+btn.dataset.idx, 1);
      if (!state.abilities.length) state.abilities.push({ name: '', text: '' });
      renderAbilityRows();
      updatePreview();
    });
  });
}
document.getElementById('add-ability').addEventListener('click', () => {
  state.abilities.push({ name: '', text: '' });
  renderAbilityRows();
});
renderAbilityRows();

// ---- Ability autocomplete ----
function closeSuggestions(inputEl) {
  const wrap = inputEl.closest('.ability-name-wrap');
  const existing = wrap?.querySelector('.ability-suggestions');
  if (existing) existing.remove();
}

function showSuggestions(inputEl, idx) {
  const wrap = inputEl.closest('.ability-name-wrap');
  closeSuggestions(inputEl);
  const results = searchAbilities(inputEl.value, 8);
  if (!results.length) return;

  const box = document.createElement('div');
  box.className = 'ability-suggestions';
  box.innerHTML = results.map((a, i) => `
    <div class="sugg-item" data-i="${i}">
      <div>
        <span class="sugg-name">${escapeHtml(a.name)}</span>
        <span class="sugg-text">${escapeHtml(a.text)}</span>
      </div>
      <span class="sugg-level">${a.level === 'Epic' ? 'Epic' : 'Lvl ' + a.level}</span>
    </div>
  `).join('');
  wrap.appendChild(box);

  box.querySelectorAll('.sugg-item').forEach((item, i) => {
    item.addEventListener('mousedown', (e) => {
      // mousedown (not click) fires before the input's blur handler removes the list
      e.preventDefault();
      applySuggestion(inputEl, idx, results[i]);
    });
  });
}

function handleSuggestionKeydown(e, inputEl) {
  const wrap = inputEl.closest('.ability-name-wrap');
  const box = wrap?.querySelector('.ability-suggestions');
  if (!box) return;
  const items = [...box.querySelectorAll('.sugg-item')];
  if (!items.length) return;
  let active = items.findIndex(el => el.classList.contains('active'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    active = (active + 1) % items.length;
    items.forEach(el => el.classList.remove('active'));
    items[active].classList.add('active');
    items[active].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    active = active <= 0 ? items.length - 1 : active - 1;
    items.forEach(el => el.classList.remove('active'));
    items[active].classList.add('active');
    items[active].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (active >= 0) {
      e.preventDefault();
      items[active].dispatchEvent(new MouseEvent('mousedown'));
    }
  } else if (e.key === 'Escape') {
    closeSuggestions(inputEl);
  }
}

function applySuggestion(inputEl, idx, ability) {
  state.abilities[idx].name = ability.name;
  state.abilities[idx].text = ability.text;
  inputEl.value = ability.name;
  const row = inputEl.closest('.ability-item');
  const textEl = row?.querySelector('textarea[data-field="text"]');
  if (textEl) textEl.value = ability.text;
  closeSuggestions(inputEl);
  updatePreview();
}

function escapeHtml(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// ---------------- Form wiring ----------------
const form = document.getElementById('card-form');
form.addEventListener('input', updatePreview);
form.addEventListener('change', updatePreview);

document.getElementById('f-cardType').addEventListener('change', (e) => {
  const preset = TYPE_PRESETS[e.target.value];
  if (preset) document.getElementById('f-accentColor').value = preset.accent;
  updatePreview();
});

document.getElementById('f-healthStart').addEventListener('change', updateHealthPreview);
document.getElementById('f-healthAsterisk').addEventListener('change', updateHealthPreview);
function updateHealthPreview() {
  const seq = healthSequenceFrom(document.getElementById('f-healthStart').value);
  document.getElementById('health-preview').textContent =
    'Track: ' + seq.join(' → ') + ' → Down → Out';
}
updateHealthPreview();

function collectStats() {
  const stats = {};
  document.querySelectorAll('.stat-row').forEach(row => {
    const key = row.dataset.stat;
    const n = +row.querySelector('input[type="number"]').value || 0;
    const d = +row.querySelector('select').value;
    stats[key] = { n, d };
  });
  return stats;
}

function collectFormData() {
  return {
    cardType: document.getElementById('f-cardType').value,
    accentColor: document.getElementById('f-accentColor').value,
    theme: document.getElementById('f-theme').value,
    name: document.getElementById('f-name').value,
    level: +document.getElementById('f-level').value,
    stats: collectStats(),
    abilities: state.abilities,
    quote: document.getElementById('f-quote').value.trim(),
    footerText: document.getElementById('f-footer').value.trim(),
    health: {
      sequence: healthSequenceFrom(document.getElementById('f-healthStart').value),
      asterisk: document.getElementById('f-healthAsterisk').checked,
    },
  };
}

function updatePreview() {
  const data = collectFormData();
  data.portraitImg = state.portraitImg;
  data.portraitView = state.portraitView;
  renderCard(canvas, data);
}

// ---------------- Portrait upload / zoom / drag ----------------
const fileInput = document.getElementById('f-portrait');
const portraitControls = document.getElementById('portrait-controls');
const zoomSlider = document.getElementById('f-zoom');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const dataURL = await resizeImageFile(file, 1200);
  const img = await loadImage(dataURL);
  state.portraitImg = img;
  state.portraitOriginalDataURL = dataURL;
  state.portraitView = { scale: 1, offsetX: 0, offsetY: 0 };
  zoomSlider.value = 1;
  portraitControls.style.display = 'flex';
  updatePreview();
});

function resizeImageFile(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

zoomSlider.addEventListener('input', () => {
  state.portraitView.scale = +zoomSlider.value;
  updatePreview();
});

document.getElementById('reset-portrait').addEventListener('click', () => {
  state.portraitView = { scale: 1, offsetX: 0, offsetY: 0 };
  zoomSlider.value = 1;
  updatePreview();
});

// Drag-to-reposition directly on the canvas preview
let dragging = false;
let dragStart = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!state.portraitImg) return;
  const { cx, cy } = toCanvasCoords(e);
  const box = getPortraitBox();
  if (cx < box.x || cx > box.x + box.w || cy < box.y || cy > box.y + box.h) return;
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY, offsetX: state.portraitView.offsetX, offsetY: state.portraitView.offsetY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const scaleFactor = CARD_W / rect.width;
  const dx = (e.clientX - dragStart.x) * scaleFactor;
  const dy = (e.clientY - dragStart.y) * scaleFactor;
  state.portraitView.offsetX = dragStart.offsetX + dx;
  state.portraitView.offsetY = dragStart.offsetY + dy;
  updatePreview();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
  canvas.addEventListener(ev, () => { dragging = false; })
);
function toCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    cx: (e.clientX - rect.left) * (CARD_W / rect.width),
    cy: (e.clientY - rect.top) * (CARD_H / rect.height),
  };
}

// ---------------- Save / Export / New ----------------
const saveStatus = document.getElementById('save-status');

document.getElementById('btn-save-card').addEventListener('click', async () => {
  const data = collectFormData();
  data.portraitImg = state.portraitImg;
  data.portraitView = state.portraitView;
  renderCard(canvas, data);
  const pngDataURL = canvas.toDataURL('image/png');

  const id = state.editingId || crypto.randomUUID();
  const record = {
    id,
    formData: { ...data, portraitImg: undefined },
    portraitDataURL: state.portraitOriginalDataURL,
    portraitView: state.portraitView,
    pngDataURL,
    createdAt: state.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await saveCard(record);
  state.editingId = id;
  saveStatus.textContent = `Saved “${data.name || 'Unnamed Character'}” to My Cards.`;
  setTimeout(() => { saveStatus.textContent = ''; }, 3500);
});

document.getElementById('btn-download-png').addEventListener('click', () => {
  const data = collectFormData();
  data.portraitImg = state.portraitImg;
  data.portraitView = state.portraitView;
  renderCard(canvas, data);
  const link = document.createElement('a');
  link.download = `${(data.name || 'pulp-alley-card').replace(/[^a-z0-9]+/gi, '-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.getElementById('btn-new-card').addEventListener('click', () => {
  state.editingId = null;
  state.createdAt = null;
  state.portraitImg = null;
  state.portraitOriginalDataURL = null;
  state.portraitView = { scale: 1, offsetX: 0, offsetY: 0 };
  state.abilities = [{ name: '', text: '' }];
  form.reset();
  document.getElementById('f-level').value = 4;
  portraitControls.style.display = 'none';
  renderAbilityRows();
  updateHealthPreview();
  updatePreview();
  saveStatus.textContent = 'Started a new card.';
  setTimeout(() => { saveStatus.textContent = ''; }, 2000);
});

// ---------------- Gallery ----------------
const galleryGrid = document.getElementById('gallery-grid');
const galleryEmpty = document.getElementById('gallery-empty');
const selectedCountEl = document.getElementById('selected-count');

async function refreshGallery() {
  const cards = await getAllCards();
  galleryEmpty.style.display = cards.length ? 'none' : 'block';
  galleryGrid.innerHTML = '';
  cards.forEach(record => {
    const el = document.createElement('div');
    el.className = 'gallery-card' + (state.selected.has(record.id) ? ' selected' : '');
    el.innerHTML = `
      <img src="${record.pngDataURL}" alt="${escapeAttr(record.formData?.name || '')}">
      <div class="gc-name">${escapeHtml(record.formData?.name || 'Unnamed')}</div>
      <div class="gc-actions">
        <button data-act="edit" title="Edit">✎</button>
        <button data-act="delete" title="Delete">🗑</button>
      </div>
      <div class="gc-check">${state.selected.has(record.id) ? '✓' : ''}</div>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      toggleSelect(record.id);
    });
    el.querySelector('[data-act="edit"]').addEventListener('click', () => loadCardIntoForm(record));
    el.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      if (confirm(`Delete “${record.formData?.name || 'this card'}”?`)) {
        await deleteCard(record.id);
        state.selected.delete(record.id);
        refreshGallery();
      }
    });
    galleryGrid.appendChild(el);
  });
  updateSelectedCount();
}

function toggleSelect(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    if (state.selected.size >= 9) {
      alert('You can select up to 9 cards for the A4 print sheet.');
      return;
    }
    state.selected.add(id);
  }
  refreshGallery();
}

function updateSelectedCount() {
  selectedCountEl.textContent = `${state.selected.size} / 9 selected`;
}

async function loadCardIntoForm(record) {
  const d = record.formData;
  document.getElementById('f-cardType').value = d.cardType;
  document.getElementById('f-accentColor').value = d.accentColor;
  document.getElementById('f-theme').value = d.theme || 'light';
  document.getElementById('f-name').value = d.name;
  document.getElementById('f-level').value = d.level;
  document.querySelectorAll('.stat-row').forEach(row => {
    const key = row.dataset.stat;
    const s = d.stats?.[key];
    if (s) {
      row.querySelector('input[type="number"]').value = s.n;
      row.querySelector('select').value = s.d;
    }
  });
  const startDie = d.health?.sequence?.[0] || 'd10';
  document.getElementById('f-healthStart').value = startDie;
  document.getElementById('f-healthAsterisk').checked = !!d.health?.asterisk;
  updateHealthPreview();
  document.getElementById('f-quote').value = d.quote || '';
  document.getElementById('f-footer').value = d.footerText || '';

  state.abilities = d.abilities?.length ? d.abilities.map(a => ({ ...a })) : [{ name: '', text: '' }];
  renderAbilityRows();

  state.editingId = record.id;
  state.createdAt = record.createdAt;
  state.portraitView = record.portraitView || { scale: 1, offsetX: 0, offsetY: 0 };
  zoomSlider.value = state.portraitView.scale || 1;
  if (record.portraitDataURL) {
    state.portraitImg = await loadImage(record.portraitDataURL);
    state.portraitOriginalDataURL = record.portraitDataURL;
    portraitControls.style.display = 'flex';
  } else {
    state.portraitImg = null;
    state.portraitOriginalDataURL = null;
    portraitControls.style.display = 'none';
  }

  updatePreview();
  activateTab('designer');
}

// ---------------- Print sheet ----------------
const sheetCanvas = document.getElementById('sheet-canvas');

async function refreshPrintSheet() {
  const cards = await getAllCards();
  const selectedIds = [...state.selected];
  const records = selectedIds.map(id => cards.find(c => c.id === id)).filter(Boolean);
  const images = await Promise.all(records.map(r => loadImage(r.pngDataURL)));
  const slots = new Array(9).fill(null);
  images.forEach((img, i) => { slots[i] = img; });
  renderRosterSheet(sheetCanvas, slots);
}

document.getElementById('print-download-png').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'pulp-alley-roster-a4.png';
  link.href = sheetCanvas.toDataURL('image/png');
  link.click();
});

document.getElementById('print-download-pdf').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const imgData = sheetCanvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
  doc.save('pulp-alley-roster-a4.pdf');
});

document.getElementById('print-browser').addEventListener('click', () => {
  window.print();
});

// ---------------- Init ----------------
document.fonts.ready.then(updatePreview);
updatePreview();
