import { renderCard, healthSequenceFrom, getPortraitBox, TYPE_PRESETS, CARD_W, CARD_H } from './cardRenderer.js';
import { saveCard, deleteCard, getAllCards, getCard, saveRoster, deleteRoster, getAllRosters, getRoster } from './db.js';
import { renderRosterSheet, loadImage } from './roster.js';
import { ABILITIES, LEVEL_ORDER, searchAbilities } from './abilitiesData.js';
import { PERKS, SLOT_ORDER, searchPerks } from './perksData.js';
import { BASE_ROSTER_SLOTS, slotCostForType } from './rosterRules.js';

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
  if (tab === 'roster') refreshRosterTab();
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

// Adds an ability to the card: reuses a single trailing empty row if one
// exists (so browsing the library into a fresh card doesn't leave a blank
// row above what you just added), otherwise appends a new row.
function addAbilityToCard(ability) {
  const alreadyOnCard = state.abilities.some(a => a.name.trim().toLowerCase() === ability.name.toLowerCase());
  if (alreadyOnCard) return false;
  const last = state.abilities[state.abilities.length - 1];
  const lastIsEmpty = last && !last.name.trim() && !last.text.trim();
  if (lastIsEmpty) {
    state.abilities[state.abilities.length - 1] = { name: ability.name, text: ability.text };
  } else {
    state.abilities.push({ name: ability.name, text: ability.text });
  }
  renderAbilityRows();
  updatePreview();
  return true;
}

function escapeHtml(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// ---------------- Ability Library modal ----------------
const libraryModal = document.getElementById('ability-library-modal');
const libraryList = document.getElementById('library-list');
const librarySearch = document.getElementById('library-search');
const levelFilterBar = document.getElementById('level-filter');
let libraryLevel = 'all';

document.getElementById('open-ability-library').addEventListener('click', () => {
  libraryModal.classList.remove('hidden');
  renderLibraryList();
  librarySearch.focus();
});
document.getElementById('close-ability-library').addEventListener('click', closeLibrary);
libraryModal.addEventListener('click', (e) => {
  if (e.target === libraryModal) closeLibrary();
});
function closeLibrary() {
  libraryModal.classList.add('hidden');
}

// Generic: Escape closes whichever modal is currently open.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
});

levelFilterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.level-btn');
  if (!btn) return;
  libraryLevel = btn.dataset.level;
  levelFilterBar.querySelectorAll('.level-btn').forEach(b => b.classList.toggle('active', b === btn));
  renderLibraryList();
});
librarySearch.addEventListener('input', renderLibraryList);

function renderLibraryList() {
  const q = librarySearch.value.trim().toLowerCase();
  const levels = libraryLevel === 'all' ? LEVEL_ORDER : [libraryLevel === 'Epic' ? 'Epic' : +libraryLevel];

  let html = '';
  let anyResults = false;
  for (const lvl of levels) {
    let items = ABILITIES.filter(a => a.level === lvl);
    if (q) {
      items = items.filter(a => a.name.toLowerCase().includes(q) || a.text.toLowerCase().includes(q));
    }
    if (!items.length) continue;
    anyResults = true;
    html += `<div class="library-level-heading">${lvl === 'Epic' ? 'Epic abilities' : 'Level ' + lvl + ' abilities'}</div>`;
    html += items.map(a => `
      <div class="library-item">
        <div class="library-item-body">
          <span class="library-item-name">${escapeHtml(a.name)}</span><span class="library-item-level">${lvl === 'Epic' ? 'Epic' : 'Lvl ' + lvl}</span>
          <div class="library-item-text">${escapeHtml(a.text)}</div>
        </div>
        <button type="button" class="library-add-btn" data-name="${escapeAttr(a.name)}" title="Add to card">+</button>
      </div>
    `).join('');
  }
  libraryList.innerHTML = anyResults ? html : '<div class="library-empty">No abilities match your search.</div>';

  libraryList.querySelectorAll('.library-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ability = ABILITIES.find(a => a.name === btn.dataset.name);
      if (!ability) return;
      const added = addAbilityToCard(ability);
      btn.textContent = added ? '✓' : '•';
      btn.title = added ? 'Added to card' : 'Already on this card';
      btn.classList.add('added');
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = '+';
        btn.title = 'Add to card';
        btn.classList.remove('added');
        btn.disabled = false;
      }, 900);
    });
  });
}

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
    abilityFontSize: +document.getElementById('f-abilityFontSize').value,
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
  document.getElementById('f-abilityFontSize').value = d.abilityFontSize || 33;
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

// ---------------- League Roster ----------------
const rosterState = {
  editingId: null,
  createdAt: null,
  name: '',
  members: [], // snapshots: {cardId, name, cardType, pngDataURL, slots}
  perks: [],   // {name, slots}
};

const rosterNameInput = document.getElementById('roster-name');
const rosterPicker = document.getElementById('roster-picker');
const rosterMembersEl = document.getElementById('roster-members');
const rosterMembersEmpty = document.getElementById('roster-members-empty');
const rosterPerksEl = document.getElementById('roster-perks');
const rosterPerksEmpty = document.getElementById('roster-perks-empty');
const rosterWarningsEl = document.getElementById('roster-warnings');
const slotMeterFill = document.getElementById('slot-meter-fill');
const slotMeterLabel = document.getElementById('slot-meter-label');

async function refreshRosterTab() {
  const rosters = await getAllRosters();
  rosterPicker.innerHTML = '<option value="">＋ New roster…</option>' +
    rosters.map(r => `<option value="${escapeAttr(r.id)}">${escapeHtml(r.name || 'Untitled League')}</option>`).join('');
  rosterPicker.value = rosterState.editingId || '';
  renderRosterWorkspace();
}

rosterNameInput.addEventListener('input', () => { rosterState.name = rosterNameInput.value; });

rosterPicker.addEventListener('change', async () => {
  const id = rosterPicker.value;
  if (!id) {
    resetRosterState();
    renderRosterWorkspace();
    return;
  }
  const record = await getRoster(id);
  if (!record) return;
  rosterState.editingId = record.id;
  rosterState.createdAt = record.createdAt;
  rosterState.name = record.name || '';
  rosterState.members = record.members || [];
  rosterState.perks = record.perks || [];
  renderRosterWorkspace();
});

function resetRosterState() {
  rosterState.editingId = null;
  rosterState.createdAt = null;
  rosterState.name = '';
  rosterState.members = [];
  rosterState.perks = [];
}

document.getElementById('roster-save').addEventListener('click', async () => {
  const id = rosterState.editingId || crypto.randomUUID();
  const record = {
    id,
    name: rosterState.name || 'Untitled League',
    members: rosterState.members,
    perks: rosterState.perks,
    createdAt: rosterState.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await saveRoster(record);
  rosterState.editingId = id;
  rosterState.createdAt = record.createdAt;
  await refreshRosterTab();
});

document.getElementById('roster-delete').addEventListener('click', async () => {
  if (!rosterState.editingId) return;
  if (!confirm(`Delete “${rosterState.name || 'this roster'}”?`)) return;
  await deleteRoster(rosterState.editingId);
  resetRosterState();
  await refreshRosterTab();
});

function computeRosterSlots() {
  const memberSlots = rosterState.members.reduce((sum, m) => sum + (m.slots || 0), 0);
  const perkSlots = rosterState.perks.reduce((sum, p) => sum + (p.slots || 0), 0);
  return { memberSlots, perkSlots, used: memberSlots + perkSlots, remaining: BASE_ROSTER_SLOTS - memberSlots - perkSlots };
}

function renderRosterWorkspace() {
  rosterNameInput.value = rosterState.name || '';

  // Members
  rosterMembersEl.innerHTML = '';
  rosterMembersEmpty.style.display = rosterState.members.length ? 'none' : 'block';
  rosterState.members.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'roster-row';
    row.innerHTML = `
      ${m.pngDataURL ? `<img class="roster-row-thumb" src="${m.pngDataURL}" alt="">` : ''}
      <div class="roster-row-body">
        <div class="roster-row-name">${escapeHtml(m.name || 'Unnamed')}</div>
        <div class="roster-row-meta">${escapeHtml(m.cardType || 'Custom')}</div>
      </div>
      <div class="roster-row-slots">${m.slots} slot${m.slots === 1 ? '' : 's'}</div>
      <button type="button" class="roster-row-remove" data-idx="${i}" title="Remove">✕</button>
    `;
    rosterMembersEl.appendChild(row);
  });
  rosterMembersEl.querySelectorAll('.roster-row-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      rosterState.members.splice(+btn.dataset.idx, 1);
      renderRosterWorkspace();
    });
  });

  // Perks
  rosterPerksEl.innerHTML = '';
  rosterPerksEmpty.style.display = rosterState.perks.length ? 'none' : 'block';
  rosterState.perks.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'roster-row';
    row.innerHTML = `
      <div class="roster-row-body">
        <div class="roster-row-name">${escapeHtml(p.name)}</div>
      </div>
      <div class="roster-row-slots">${p.slots} slot${p.slots === 1 ? '' : 's'}</div>
      <button type="button" class="roster-row-remove" data-idx="${i}" title="Remove">✕</button>
    `;
    rosterPerksEl.appendChild(row);
  });
  rosterPerksEl.querySelectorAll('.roster-row-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      rosterState.perks.splice(+btn.dataset.idx, 1);
      renderRosterWorkspace();
    });
  });

  // Slot meter
  const { used, remaining } = computeRosterSlots();
  const pct = Math.min(100, (used / BASE_ROSTER_SLOTS) * 100);
  slotMeterFill.style.width = pct + '%';
  slotMeterFill.classList.toggle('over', remaining < 0);
  slotMeterLabel.textContent = remaining < 0
    ? `${used} / ${BASE_ROSTER_SLOTS} slots used — over by ${-remaining}`
    : `${used} / ${BASE_ROSTER_SLOTS} slots used (${remaining} remaining)`;

  // Warnings (soft — informational, not blocking)
  const warnings = [];
  const leaderCount = rosterState.members.filter(m => m.cardType === 'Leader').length;
  const sidekickCount = rosterState.members.filter(m => m.cardType === 'Sidekick').length;
  const hasCompanyOfHeroes = rosterState.perks.some(p => p.name === 'Company of Heroes');
  const hasLeagueOfLegends = rosterState.perks.some(p => p.name === 'League of Legends');
  const hasMastermind = rosterState.perks.some(p => p.name === 'Mastermind');
  if (leaderCount > 1 && !hasLeagueOfLegends) {
    warnings.push('More than 1 Leader on this roster — a league normally includes only one (p. 8).');
  }
  if (leaderCount === 0 && !hasMastermind && !hasLeagueOfLegends) {
    warnings.push('No Leader on this roster — every league needs one (p. 8), unless using Mastermind or League of Legends.');
  }
  if (sidekickCount > 1 && !hasCompanyOfHeroes && !hasLeagueOfLegends) {
    warnings.push('More than 1 Sidekick on this roster — normally only 1 is allowed unless you’ve added the Company of Heroes perk.');
  }
  if (remaining < 0) {
    warnings.push(`This roster is over its slot budget by ${-remaining} slot${-remaining === 1 ? '' : 's'}.`);
  }
  rosterWarningsEl.innerHTML = warnings.map(w => `<div class="roster-warning">⚠ ${escapeHtml(w)}</div>`).join('');
}

// ---- Add-colleague picker ----
const colleaguePickerModal = document.getElementById('colleague-picker-modal');
const colleaguePickerList = document.getElementById('colleague-picker-list');

document.getElementById('open-colleague-picker').addEventListener('click', async () => {
  colleaguePickerModal.classList.remove('hidden');
  await renderColleaguePicker();
});
document.getElementById('close-colleague-picker').addEventListener('click', () => {
  colleaguePickerModal.classList.add('hidden');
});
colleaguePickerModal.addEventListener('click', (e) => {
  if (e.target === colleaguePickerModal) colleaguePickerModal.classList.add('hidden');
});

async function renderColleaguePicker() {
  const cards = await getAllCards();
  const addedIds = new Set(rosterState.members.map(m => m.cardId));
  const available = cards.filter(c => !addedIds.has(c.id));
  if (!available.length) {
    colleaguePickerList.innerHTML = '<div class="library-empty">Every saved card is already on this roster (or you haven’t saved any yet in the Card Designer).</div>';
    return;
  }
  colleaguePickerList.innerHTML = available.map(c => `
    <div class="library-item">
      <img class="library-item-thumb" src="${c.pngDataURL}" alt="">
      <div class="library-item-body">
        <span class="library-item-name">${escapeHtml(c.formData?.name || 'Unnamed')}</span><span class="library-item-level">${escapeHtml(c.formData?.cardType || 'Custom')}</span>
        <div class="library-item-text">${slotCostForType(c.formData?.cardType)} roster slot${slotCostForType(c.formData?.cardType) === 1 ? '' : 's'}</div>
      </div>
      <button type="button" class="library-add-btn" data-id="${escapeAttr(c.id)}" title="Add to roster">+</button>
    </div>
  `).join('');

  colleaguePickerList.querySelectorAll('.library-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = available.find(c => c.id === btn.dataset.id);
      if (!card) return;
      rosterState.members.push({
        cardId: card.id,
        name: card.formData?.name || 'Unnamed',
        cardType: card.formData?.cardType || 'Custom',
        pngDataURL: card.pngDataURL,
        slots: slotCostForType(card.formData?.cardType),
      });
      renderRosterWorkspace();
      renderColleaguePicker();
    });
  });
}

// ---- Perk library ----
const perkLibraryModal = document.getElementById('perk-library-modal');
const perkLibraryList = document.getElementById('perk-library-list');
const perkSearch = document.getElementById('perk-search');
const perkSlotFilterBar = document.getElementById('perk-slot-filter');
let perkSlotFilter = 'all';

document.getElementById('open-perk-library').addEventListener('click', () => {
  perkLibraryModal.classList.remove('hidden');
  renderPerkLibrary();
  perkSearch.focus();
});
document.getElementById('close-perk-library').addEventListener('click', () => {
  perkLibraryModal.classList.add('hidden');
});
perkLibraryModal.addEventListener('click', (e) => {
  if (e.target === perkLibraryModal) perkLibraryModal.classList.add('hidden');
});
perkSlotFilterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.level-btn');
  if (!btn) return;
  perkSlotFilter = btn.dataset.slots;
  perkSlotFilterBar.querySelectorAll('.level-btn').forEach(b => b.classList.toggle('active', b === btn));
  renderPerkLibrary();
});
perkSearch.addEventListener('input', renderPerkLibrary);

function renderPerkLibrary() {
  const q = perkSearch.value.trim().toLowerCase();
  const slotLevels = perkSlotFilter === 'all' ? SLOT_ORDER : [+perkSlotFilter];

  let html = '';
  let anyResults = false;
  for (const slots of slotLevels) {
    let items = PERKS.filter(p => p.slots === slots);
    if (q) items = items.filter(p => p.name.toLowerCase().includes(q) || p.text.toLowerCase().includes(q));
    if (!items.length) continue;
    anyResults = true;
    html += `<div class="library-level-heading">${slots} slot${slots === 1 ? '' : 's'}</div>`;
    html += items.map(p => `
      <div class="library-item">
        <div class="library-item-body">
          <span class="library-item-name">${escapeHtml(p.name)}</span><span class="library-item-level">${p.slots} slot${p.slots === 1 ? '' : 's'}</span>
          <div class="library-item-text">${escapeHtml(p.text)}</div>
        </div>
        <button type="button" class="library-add-btn" data-name="${escapeAttr(p.name)}" title="Add to roster">+</button>
      </div>
    `).join('');
  }
  perkLibraryList.innerHTML = anyResults ? html : '<div class="library-empty">No perks match your search.</div>';

  perkLibraryList.querySelectorAll('.library-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const perk = PERKS.find(p => p.name === btn.dataset.name);
      if (!perk) return;
      const already = rosterState.perks.some(p => p.name === perk.name);
      if (already) {
        btn.textContent = '•';
        btn.title = 'Already on this roster';
      } else {
        rosterState.perks.push({ name: perk.name, slots: perk.slots });
        renderRosterWorkspace();
        btn.textContent = '✓';
        btn.title = 'Added to roster';
      }
      btn.classList.add('added');
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = '+';
        btn.title = 'Add to roster';
        btn.classList.remove('added');
        btn.disabled = false;
      }, 900);
    });
  });
}

// ---------------- Init ----------------
document.fonts.ready.then(updatePreview);
updatePreview();
