// app.js — loaded as a plain (non-module) script, after cardRenderer.js,
// db.js, roster.js, abilitiesData.js, perksData.js, and rosterRules.js in
// index.html. Those files declare their exports as ordinary top-level
// const/function — as plain scripts they share one global scope, so no
// import statements are needed here. (This app intentionally avoids
// type="module" scripts: browsers block cross-file module loading under
// file://, which broke opening index.html by double-clicking it instead of
// running a local server. Plain scripts work either way.)

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
    // baseName is set when an ability is picked from autocomplete or the
    // library (see applySuggestion/addAbilityToCard) and preserved when the
    // player edits the visible name — i.e. editing `name` alone is a
    // rename, not a replacement. Rules checks (duplicates, level cap,
    // no-dice/no-action) key off baseName so a renamed ability still counts
    // as its official self.
    const isOfficial = a.baseName && a.baseName.trim();
    const renamed = isOfficial && a.baseName !== a.name;
    row.innerHTML = `
      <div class="ability-name-wrap">
        <input type="text" placeholder="Ability name (e.g. Marksman)" value="${escapeAttr(a.name)}" data-idx="${i}" data-field="name" autocomplete="off">
        ${renamed ? `<div class="ability-rename-note">Originally: <strong>${escapeHtml(a.baseName)}</strong> · <a href="#" class="ability-reset-name" data-idx="${i}">reset</a></div>` : ''}
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
      const idx = +el.dataset.idx;
      // delay so a click on a suggestion registers before the list is removed
      setTimeout(() => {
        closeSuggestions(el);
        // Update just this row's "Originally: X · reset" note once the
        // player finishes typing a rename. Deliberately NOT a full
        // renderAbilityRows() — a delayed full re-render here can yank out
        // from under the player (or a fast-typing test) whatever other
        // ability row/field they've since moved on to editing.
        refreshRenameNote(idx);
      }, 150);
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
  abilitiesList.querySelectorAll('.ability-reset-name').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = +link.dataset.idx;
      state.abilities[idx].name = state.abilities[idx].baseName;
      renderAbilityRows();
      updatePreview();
    });
  });
}
// Incrementally updates a single ability row's "Originally: X · reset" note
// in place, without rebuilding the abilities list. Used from the blur
// handler above so a delayed update can't detach elements the player has
// since moved on to editing in another row.
function refreshRenameNote(idx) {
  const input = abilitiesList.querySelector(`input[data-field="name"][data-idx="${idx}"]`);
  if (!input) return;
  const wrap = input.closest('.ability-name-wrap');
  if (!wrap) return;
  const existingNote = wrap.querySelector('.ability-rename-note');
  const a = state.abilities[idx];
  const renamed = a && a.baseName && a.baseName.trim() && a.baseName !== a.name;
  if (!renamed) {
    if (existingNote) existingNote.remove();
    return;
  }
  if (existingNote) {
    existingNote.querySelector('strong').textContent = a.baseName;
    return;
  }
  const note = document.createElement('div');
  note.className = 'ability-rename-note';
  note.innerHTML = `Originally: <strong>${escapeHtml(a.baseName)}</strong> · <a href="#" class="ability-reset-name" data-idx="${idx}">reset</a>`;
  wrap.appendChild(note);
  note.querySelector('.ability-reset-name').addEventListener('click', (e) => {
    e.preventDefault();
    state.abilities[idx].name = state.abilities[idx].baseName;
    renderAbilityRows();
    updatePreview();
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
  const cardType = document.getElementById('f-cardType').value;
  const results = searchAbilities(inputEl.value, 8, cardType);
  if (!results.length) return;

  const box = document.createElement('div');
  box.className = 'ability-suggestions';
  box.innerHTML = results.map((a, i) => `
    <div class="sugg-item" data-i="${i}">
      <div>
        <span class="sugg-name">${escapeHtml(a.name)}</span>
        <span class="sugg-text">${escapeHtml(a.text)}</span>
      </div>
      <span class="sugg-level">${a.level === 'Epic' ? 'Epic' : a.level === 'Gang' ? 'Gang' : 'Lvl ' + a.level}</span>
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
  state.abilities[idx].baseName = ability.name;
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
  // Key the duplicate check off baseName (falling back to the visible name)
  // so an ability that's been renamed on the card still blocks adding the
  // same official ability again — renaming doesn't launder a duplicate.
  const alreadyOnCard = state.abilities.some(a => (a.baseName || a.name).trim().toLowerCase() === ability.name.toLowerCase());
  if (alreadyOnCard) return false;
  const last = state.abilities[state.abilities.length - 1];
  const lastIsEmpty = last && !last.name.trim() && !last.text.trim();
  if (lastIsEmpty) {
    state.abilities[state.abilities.length - 1] = { name: ability.name, text: ability.text, baseName: ability.name };
  } else {
    state.abilities.push({ name: ability.name, text: ability.text, baseName: ability.name });
  }
  renderAbilityRows();
  updatePreview();
  return true;
}

function escapeHtml(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// Formats a Date as YYYY-MM-DD using the browser's own local timezone.
// date.toISOString() (used for the export backup filename until this fix)
// always reports UTC regardless of the computer's clock/timezone, so
// anyone west of UTC (all of North America, for instance) could get a
// filename dated a day ahead of their actual local date once past ~5-8pm.
// Reading the local getters (getFullYear/getMonth/getDate) instead makes
// the filename match whatever date it actually is where the user is.
function localDateStamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------- Ability Library modal ----------------
const libraryModal = document.getElementById('ability-library-modal');
const libraryList = document.getElementById('library-list');
const librarySearch = document.getElementById('library-search');
const levelFilterBar = document.getElementById('level-filter');
let libraryLevel = 'all';

function libraryLevelButtonsHtml(order) {
  return '<button type="button" class="level-btn active" data-level="all">All</button>' +
    order.map(l => `<button type="button" class="level-btn" data-level="${l}">${l === 'Epic' ? 'Epic' : l === 'Gang' ? 'Gang-only' : 'Level ' + l}</button>`).join('');
}

document.getElementById('open-ability-library').addEventListener('click', () => {
  const cardType = document.getElementById('f-cardType').value;
  levelFilterBar.innerHTML = libraryLevelButtonsHtml(cardType === 'Gang' ? GANG_LEVEL_ORDER : LEVEL_ORDER);
  libraryLevel = 'all';
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
  const cardType = document.getElementById('f-cardType').value;
  const isGang = cardType === 'Gang';
  const pool = abilitiesForCardType(cardType);
  const order = isGang ? GANG_LEVEL_ORDER : LEVEL_ORDER;
  const q = librarySearch.value.trim().toLowerCase();
  const levels = libraryLevel === 'all' ? order : [libraryLevel === 'Epic' ? 'Epic' : libraryLevel === 'Gang' ? 'Gang' : +libraryLevel];
  // Level Restriction (p. 9): an ability's level can't exceed the
  // character's level. Abilities above the current Card Type's cap aren't
  // blocked here — just visually flagged, matching the app's soft-warning
  // (not hard-block) approach to rules everywhere else.
  const maxAbilityLevel = TYPE_PRESETS[cardType]?.maxAbilityLevel;

  let html = '';
  let anyResults = false;
  for (const lvl of levels) {
    let items = pool.filter(a => a.level === lvl);
    if (q) {
      items = items.filter(a => a.name.toLowerCase().includes(q) || a.text.toLowerCase().includes(q));
    }
    if (!items.length) continue;
    anyResults = true;
    html += `<div class="library-level-heading">${lvl === 'Epic' ? 'Epic abilities' : lvl === 'Gang' ? 'Gang-only abilities' : 'Level ' + lvl + ' abilities'}</div>`;
    html += items.map(a => {
      const overCap = maxAbilityLevel !== undefined && abilityLevelRank(a.level) > maxAbilityLevel;
      return `
      <div class="library-item${overCap ? ' library-item-overcap' : ''}">
        <div class="library-item-body">
          <span class="library-item-name">${escapeHtml(a.name)}</span><span class="library-item-level">${lvl === 'Epic' ? 'Epic' : lvl === 'Gang' ? 'Gang' : 'Lvl ' + lvl}</span>
          ${overCap ? `<span class="library-item-overcap-tag">Above ${cardType} cap</span>` : ''}
          ${a.npcOnly ? `<span class="library-item-npc-tag">NPC only</span>` : ''}
          <div class="library-item-text">${escapeHtml(a.text)}</div>
        </div>
        <button type="button" class="library-add-btn" data-name="${escapeAttr(a.name)}" title="Add to card">+</button>
      </div>
    `;
    }).join('');
  }
  libraryList.innerHTML = anyResults ? html : (isGang
    ? '<div class="library-empty">No matching abilities. Gangs can only take the 6 Gang-only abilities plus a specific subset of Level 1–2 abilities (p. 22).</div>'
    : '<div class="library-empty">No abilities match your search.</div>');

  libraryList.querySelectorAll('.library-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ability = pool.find(a => a.name === btn.dataset.name);
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

// ---------------- Ability rules warnings ----------------
// Core Rules p. 9 "Abilities Rules and Restrictions": No Duplicates, Level
// Restriction, No-Dice, No-Action — plus the p. 8-9 ability-count table for
// Leader/Sidekick/Ally/Follower. These are all soft, informational warnings
// (same philosophy as the League Roster warnings) — nothing here blocks the
// player from doing it anyway, since homebrew exceptions are common.
const abilityWarningsEl = document.getElementById('ability-warnings');

function computeAbilityWarnings(cardType, abilities) {
  const warnings = [];
  const named = abilities.filter(a => a.name && a.name.trim());
  if (!named.length) return warnings;

  const preset = TYPE_PRESETS[cardType];

  if (preset && preset.maxAbilities !== undefined && named.length > preset.maxAbilities) {
    warnings.push(`${cardType}s normally have at most ${preset.maxAbilities} abilit${preset.maxAbilities === 1 ? 'y' : 'ies'} (p. 9) — this card has ${named.length}.`);
  }

  // Duplicates are keyed by baseName (falling back to the visible name) so
  // renaming an ability doesn't hide that it's still the same official
  // ability underneath.
  const seen = new Map(); // key -> { count, display }
  const noDiceMap = new Map(); // skill -> [display names]
  const preventsActionsNames = [];

  named.forEach(a => {
    const baseName = (a.baseName || a.name).trim();
    const key = baseName.toLowerCase();
    const entry = seen.get(key) || { count: 0, display: baseName };
    entry.count++;
    seen.set(key, entry);

    const found = findAbilityByName(baseName);
    if (!found) return;

    if (preset && preset.maxAbilityLevel !== undefined) {
      const rank = abilityLevelRank(found.level);
      if (rank > preset.maxAbilityLevel) {
        const levelLabel = found.level === 'Epic' ? 'an Epic' : `a Level ${found.level}`;
        warnings.push(`“${a.name}” is ${levelLabel} ability — above the Level ${preset.maxAbilityLevel} cap for a ${cardType} (p. 9, Level Restriction).`);
      }
    }

    if (found.noDiceSkills?.length) {
      found.noDiceSkills.forEach(skill => {
        if (!noDiceMap.has(skill)) noDiceMap.set(skill, []);
        noDiceMap.get(skill).push(a.name);
      });
    }
    if (found.preventsActions) {
      preventsActionsNames.push(a.name);
    }
  });

  seen.forEach(entry => {
    if (entry.count > 1) {
      warnings.push(`“${entry.display}” appears more than once — a character can't take the same ability twice (p. 9, No Duplicates).`);
    }
  });

  noDiceMap.forEach((names, skill) => {
    if (names.length > 1) {
      warnings.push(`${names.join(' + ')} both reduce ${skill} to no-dice — only one ability may do that to the same skill (p. 9, No-Dice).`);
    }
  });

  if (preventsActionsNames.length > 1) {
    warnings.push(`${preventsActionsNames.join(' + ')} each prevent taking actions — only one such ability is allowed (p. 9, No-Action).`);
  }

  return warnings;
}

function renderAbilityWarnings() {
  const cardType = document.getElementById('f-cardType').value;
  const warnings = computeAbilityWarnings(cardType, state.abilities);
  abilityWarningsEl.innerHTML = warnings.map(w => `<div class="roster-warning">⚠ ${escapeHtml(w)}</div>`).join('');
}

function updateSkillDiceHint() {
  const cardType = document.getElementById('f-cardType').value;
  const preset = TYPE_PRESETS[cardType];
  document.getElementById('skill-dice-hint').textContent = (preset && preset.skillDiceHint) || '';
}

// ---------------- Form wiring ----------------
const form = document.getElementById('card-form');
form.addEventListener('input', updatePreview);
form.addEventListener('change', updatePreview);

// Accent Color's default depends on both Card Type (TYPE_PRESETS in
// cardRenderer.js — each corresponds to a Gamegenic Prime Sleeves color)
// and Card Background: the Classical (parchment) themes override every
// Card Type's colorful default to plain black instead, since a bright
// modern accent clashes with the aged-parchment look. Used by both the
// Card Type and Card Background change handlers below so switching either
// one keeps Accent Color in sync — it's still a normal, editable color
// picker afterward, same as every other auto-filled field in this app.
function defaultAccentForCardType(cardType, theme) {
  if (theme === 'classical' || theme === 'classicalNoSkull') return '#000000';
  const preset = TYPE_PRESETS[cardType];
  return preset ? preset.accent : '#000000';
}

document.getElementById('f-theme').addEventListener('change', (e) => {
  document.getElementById('f-accentColor').value = defaultAccentForCardType(
    document.getElementById('f-cardType').value, e.target.value
  );
  updatePreview();
});

document.getElementById('f-cardType').addEventListener('change', (e) => {
  const preset = TYPE_PRESETS[e.target.value];
  if (preset) {
    document.getElementById('f-accentColor').value = defaultAccentForCardType(
      e.target.value, document.getElementById('f-theme').value
    );
    // Leader/Sidekick/Ally/Follower have a rules-fixed Level and starting
    // Health die (Core Rules p. 8-9); Gang is fixed at Level 2 (p. 21).
    // Villain/Creature/Custom aren't part of that table, so preset.level
    // is left undefined for them and nothing here overrides a hand-picked
    // value. The fields stay normal, editable inputs after auto-fill in
    // case of a homebrew exception.
    if (preset.level !== undefined) document.getElementById('f-level').value = preset.level;
    if (preset.healthStart !== undefined) document.getElementById('f-healthStart').value = preset.healthStart;
    if (preset.healthAsterisk !== undefined) document.getElementById('f-healthAsterisk').checked = preset.healthAsterisk;
  }
  toggleGangFields(e.target.value === 'Gang');
  if (e.target.value === 'Gang') applyGangStatsFromModels();
  // Stats auto-fill to match the new Card Type too — same p.9 budget the
  // Reset Stats button applies, just automatic now so Stats keep pace with
  // Level/Health/Accent Color instead of needing an extra click. Still a
  // normal, editable grid afterward for a homebrew exception; no-op for
  // Villain/Creature/Custom (no rulebook default) since Gang is already
  // handled above.
  applyDefaultStatsForType(e.target.value);
  updateResetStatsVisibility(e.target.value);
  updateNpcHintVisibility(e.target.value);
  updateHealthPreview();
  updatePreview();
});

// ---------------- Gang fields ----------------
const gangFieldset = document.getElementById('gang-fieldset');
const standardHealthFields = document.getElementById('standard-health-fields');
const gangHealthFields = document.getElementById('gang-health-fields');
const gangModelsInput = document.getElementById('f-gangModels');

function toggleGangFields(isGang) {
  gangFieldset.style.display = isGang ? 'block' : 'none';
  standardHealthFields.style.display = isGang ? 'none' : 'block';
  gangHealthFields.style.display = isGang ? 'block' : 'none';
}

function setStatRow(key, n, d) {
  const row = document.querySelector(`.stat-row[data-stat="${key}"]`);
  if (!row) return;
  row.querySelector('input[type="number"]').value = n;
  row.querySelector('select').value = d;
}

// Auto-fills the six stat rows from the rulebook's gang formula (p. 21):
// Brawl/Shoot/Might roll 1d6 per 2 models (rounded up); Dodge/Cunning/
// Finesse are always a flat 1d6. Fields stay normal, editable inputs
// afterward so a perk or homebrew rule can still override the numbers.
function applyGangStatsFromModels() {
  const models = Math.max(1, +gangModelsInput.value || 5);
  const combatDice = Math.ceil(models / 2);
  setStatRow('brawl', combatDice, 6);
  setStatRow('shoot', combatDice, 6);
  setStatRow('might', combatDice, 6);
  setStatRow('dodge', 1, 6);
  setStatRow('cunning', 1, 6);
  setStatRow('finesse', 1, 6);
}

gangModelsInput.addEventListener('input', () => {
  applyGangStatsFromModels();
  updateHealthPreview();
  updatePreview();
});

// ---- Reset Stats to Card Type ----
// Leader/Sidekick/Ally/Follower each have a defaultStats block in
// TYPE_PRESETS (cardRenderer.js) — a valid, rules-legal starting dice
// allocation for that Card Type. The rulebook fixes the total budget
// (skillDiceHint) but leaves which specific skills get the higher tier up
// to the player, so this is a deliberate, explicit action (a button, not
// an auto-fill-on-change) — it won't silently clobber hand-edited stats
// just because you tweaked the Card Type for an unrelated reason. Gang
// isn't included here since it already has its own model-based stat
// auto-fill (applyGangStatsFromModels); Villain/Creature/Custom have no
// rulebook default at all.
const statGridActions = document.querySelector('.stat-grid-actions');
const resetStatsBtn = document.getElementById('reset-stats');

function updateResetStatsVisibility(cardType) {
  const hasDefaults = !!TYPE_PRESETS[cardType]?.defaultStats;
  statGridActions.style.display = hasDefaults ? 'flex' : 'none';
}

// Non-Player Characters (advanced supplement) reference note — Villain and
// Creature are this app's closest match to "NPC" among the Card Types, so
// the note (and the "NPC only" abilities it points to) surfaces for those.
// It's read-only reference text, not a card field: the rulebook's
// Passive/Alert behavior is something you play out on the table, not
// something a printed card needs to record.
const npcHintEl = document.getElementById('npc-hint');
function updateNpcHintVisibility(cardType) {
  npcHintEl.style.display = (cardType === 'Villain' || cardType === 'Creature') ? 'block' : 'none';
}

// Shared by both the Card Type auto-fill (above) and the Reset Stats
// button below, so there's exactly one place that knows how to apply a
// Card Type's default stat allocation.
function applyDefaultStatsForType(cardType) {
  const defaults = TYPE_PRESETS[cardType]?.defaultStats;
  if (!defaults) return false;
  Object.entries(defaults).forEach(([key, { n, d }]) => setStatRow(key, n, d));
  return true;
}

resetStatsBtn.addEventListener('click', () => {
  const cardType = document.getElementById('f-cardType').value;
  if (!applyDefaultStatsForType(cardType)) return;
  updatePreview();
});
updateResetStatsVisibility(document.getElementById('f-cardType').value);
updateNpcHintVisibility(document.getElementById('f-cardType').value);

document.getElementById('f-healthStart').addEventListener('change', updateHealthPreview);
document.getElementById('f-healthAsterisk').addEventListener('change', updateHealthPreview);

function gangModelSequence() {
  const models = Math.max(3, +gangModelsInput.value || 5);
  const seq = [];
  for (let m = models; m >= 3; m--) seq.push(String(m));
  return seq;
}

function updateHealthPreview() {
  if (document.getElementById('f-cardType').value === 'Gang') {
    document.getElementById('health-preview').textContent =
      'Track: ' + gangModelSequence().join(' → ') + ' → Out (knocked out at ≤2 models)';
    return;
  }
  const seq = healthSequenceFrom(document.getElementById('f-healthStart').value);
  const asterisk = document.getElementById('f-healthAsterisk').checked;
  const seqDisplay = asterisk ? [seq[0] + '*', ...seq.slice(1)] : seq;
  document.getElementById('health-preview').textContent = asterisk
    ? 'Track: ' + seqDisplay.join(' → ') + ' → Out (knocked out on a failed Health check — no Down state)'
    : 'Track: ' + seqDisplay.join(' → ') + ' → Down → Out';
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

function collectHealth() {
  if (document.getElementById('f-cardType').value === 'Gang') {
    return { sequence: gangModelSequence(), asterisk: false, isGang: true };
  }
  return {
    sequence: healthSequenceFrom(document.getElementById('f-healthStart').value),
    asterisk: document.getElementById('f-healthAsterisk').checked,
  };
}

function collectFormData() {
  return {
    cardType: document.getElementById('f-cardType').value,
    accentColor: document.getElementById('f-accentColor').value,
    theme: document.getElementById('f-theme').value,
    // "collection" is this card's user-defined Theme/category (e.g. "Star
    // Wars", "Die Hard") — named differently from the "theme" field above
    // (Card Background: ivory/classical/etc.) to avoid confusing the two
    // completely separate concepts in code, even though both are labelled
    // "Theme" somewhere in the UI... only this one actually is.
    collection: document.getElementById('f-collection').value.trim(),
    abilityFontSize: +document.getElementById('f-abilityFontSize').value,
    name: document.getElementById('f-name').value,
    level: +document.getElementById('f-level').value,
    stats: collectStats(),
    abilities: state.abilities,
    quote: document.getElementById('f-quote').value.trim(),
    health: collectHealth(),
    portraitFrame: document.getElementById('f-portrait-frame').checked,
  };
}

function updatePreview() {
  const data = collectFormData();
  data.portraitImg = state.portraitImg;
  data.portraitView = state.portraitView;
  renderCard(canvas, data);
  updateSkillDiceHint();
  renderAbilityWarnings();
}

// ---------------- Portrait upload / zoom / drag ----------------
const fileInput = document.getElementById('f-portrait');
const portraitControls = document.getElementById('portrait-controls');
const zoomSlider = document.getElementById('f-zoom');
const previewPanel = document.getElementById('preview-panel');
const portraitFrameCheckbox = document.getElementById('f-portrait-frame');

// Lives in the preview panel outside <form id="card-form"> (like f-portrait
// itself), so it needs its own listener rather than relying on the form's
// delegated input/change -> updatePreview wiring.
portraitFrameCheckbox.addEventListener('change', updatePreview);

// Shared by both the file-picker input and drag-and-drop below, so a
// dropped file goes through exactly the same resize/load/state pipeline
// as one chosen with "Choose File".
async function setPortraitFromFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  const dataURL = await resizeImageFile(file, 1200);
  const img = await loadImage(dataURL);
  state.portraitImg = img;
  state.portraitOriginalDataURL = dataURL;
  state.portraitView = { scale: 1, offsetX: 0, offsetY: 0 };
  zoomSlider.value = 1;
  portraitControls.style.display = 'flex';
  updatePreview();
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await setPortraitFromFile(file);
});

// Drag-and-drop an image file from the OS straight onto the card preview.
// Without preventDefault() on dragenter/dragover/drop, the browser's
// default behavior takes over a dropped file and navigates the tab to its
// file:// URL instead of letting the app handle it — that's the bug this
// fixes (dropping an image used to open it as its own page instead of
// setting it as the portrait). dragCounter tracks nested enter/leave pairs
// so the highlight doesn't flicker as the drag crosses child elements.
let dragCounter = 0;
previewPanel.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  previewPanel.classList.add('drag-over');
});
previewPanel.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
previewPanel.addEventListener('dragleave', () => {
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) previewPanel.classList.remove('drag-over');
});
previewPanel.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  previewPanel.classList.remove('drag-over');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) await setPortraitFromFile(file);
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
        // Preserve transparency for formats that support it (PNG/WebP/GIF)
        // by re-encoding as PNG — JPEG has no alpha channel, so exporting a
        // transparent portrait as JPEG used to flatten the transparent
        // areas to solid black. A source file with no alpha to begin with
        // (JPEG) stays JPEG, since that's smaller and there's nothing to
        // preserve.
        const supportsAlpha = /png|webp|gif/i.test(file.type);
        resolve(supportsAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9));
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
  // Refreshes the Theme autocomplete right away if this card introduced a
  // brand-new Theme name, so it's available for the very next card without
  // needing a trip through My Cards first.
  getAllCards().then(refreshThemeOptions);
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
  toggleGangFields(false);
  // form.reset() puts Card Type back to its first <option> (Leader) but,
  // unlike actually picking Leader from the dropdown, doesn't fire the
  // 'change' handler that auto-fills Stats — apply the same defaults here
  // so a brand new card starts from Leader's real p.9 allocation instead
  // of the form's static placeholder numbers.
  applyDefaultStatsForType(document.getElementById('f-cardType').value);
  updateResetStatsVisibility(document.getElementById('f-cardType').value);
  updateNpcHintVisibility(document.getElementById('f-cardType').value);
  // f-portrait (and f-portrait-frame) now live in the preview panel,
  // outside <form id="card-form"> (see index.html), so form.reset() above
  // doesn't touch them — reset explicitly instead. Image Frame defaults
  // off, same as a genuinely new, never-saved card.
  fileInput.value = '';
  portraitFrameCheckbox.checked = false;
  portraitControls.style.display = 'none';
  renderAbilityRows();
  updateHealthPreview();
  updatePreview();
  saveStatus.textContent = 'Started a new card.';
  setTimeout(() => { saveStatus.textContent = ''; }, 2000);
});

// Duplicate: for making variations of a character (different Level,
// different Abilities, a recolored gang lieutenant, etc.) without
// retyping everything. Unlike New Card, this deliberately leaves every
// field — Stats, Abilities, Quote, Theme, Card Background, portrait art
// and its pan/zoom framing — exactly as currently shown; the only two
// things that change are clearing state.editingId/createdAt (so Save
// writes a brand-new record instead of overwriting the card this was
// copied from) and appending " (copy)" to the name so the two are easy
// to tell apart in My Cards until renamed. Nothing is saved to My Cards
// by this action itself — it just stages the duplicate in the form for
// editing, same as loading any other card would.
document.getElementById('btn-duplicate-card').addEventListener('click', () => {
  const nameField = document.getElementById('f-name');
  const currentName = nameField.value.trim();
  state.editingId = null;
  state.createdAt = null;
  nameField.value = currentName ? `${currentName} (copy)` : '(copy)';
  updatePreview();
  saveStatus.textContent = `Duplicated “${currentName || 'Unnamed Character'}” — edit the copy, then Save to keep both.`;
  setTimeout(() => { saveStatus.textContent = ''; }, 4000);
});

// ---------------- Themes (user-defined card collections) ----------------
// A card's "collection" is the free-text Theme the user typed in the
// Designer (e.g. "Die Hard", "Star Wars") — kept under this name internally
// so it's never confused with the pre-existing "theme" field, which is the
// Card Background (ivory/classical/etc.). Both the Designer's autocomplete
// list and the two Theme filter dropdowns (My Cards, League Roster's
// colleague picker) are derived from whatever collections currently exist
// across all saved cards, so a brand-new Theme name typed on any card shows
// up everywhere else automatically — there's no separate place to manage
// the list of Themes.
const collectionInput = document.getElementById('f-collection');
const collectionOptionsList = document.getElementById('collection-options');

function distinctCollections(cards) {
  const set = new Set();
  cards.forEach(c => {
    const name = (c.formData?.collection || '').trim();
    if (name) set.add(name);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Repopulates the Designer's Theme autocomplete plus both Theme filter
// dropdowns from the current set of saved cards, preserving whatever each
// filter dropdown currently has selected (so refreshing the list mid-filter
// doesn't silently reset the user back to "All Themes").
function refreshThemeOptions(cards) {
  const names = distinctCollections(cards);
  collectionOptionsList.innerHTML = names.map(n => `<option value="${escapeAttr(n)}"></option>`).join('');
  [galleryThemeFilterSelect, colleagueThemeFilterSelect].forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All Themes</option>' + names.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');
    sel.value = names.includes(current) ? current : '';
  });
}

// ---------------- Gallery ----------------
const galleryGrid = document.getElementById('gallery-grid');
const galleryEmpty = document.getElementById('gallery-empty');
const galleryNoMatch = document.getElementById('gallery-no-match');
const selectedCountEl = document.getElementById('selected-count');
const selectAllBtn = document.getElementById('select-all-btn');
const gallerySearchInput = document.getElementById('gallery-search');
const galleryThemeFilterSelect = document.getElementById('gallery-theme-filter');

// Tracks the cards currently shown in the gallery (same order as
// rendered, i.e. after search/Theme filtering), so Select All can pick
// "the first 9" consistently with what's on screen without a redundant
// extra fetch from IndexedDB.
let latestGalleryCards = [];

gallerySearchInput.addEventListener('input', refreshGallery);
galleryThemeFilterSelect.addEventListener('change', refreshGallery);

async function refreshGallery() {
  const allCards = await getAllCards();
  refreshThemeOptions(allCards);

  const searchText = gallerySearchInput.value.trim().toLowerCase();
  const themeFilter = galleryThemeFilterSelect.value;
  const cards = allCards.filter(c => {
    const matchesSearch = !searchText || (c.formData?.name || '').toLowerCase().includes(searchText);
    const matchesTheme = !themeFilter || (c.formData?.collection || '') === themeFilter;
    return matchesSearch && matchesTheme;
  });

  latestGalleryCards = cards;
  const filtering = !!(searchText || themeFilter);
  galleryEmpty.style.display = (!allCards.length && !filtering) ? 'block' : 'none';
  galleryNoMatch.style.display = (allCards.length && filtering && !cards.length) ? 'block' : 'none';
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
  // A single toggle button: nothing selected -> "Select All" selects up to
  // 9; anything selected (all or partial) -> "Deselect All" clears it, so
  // pressing it a second time always gets you back to zero.
  selectAllBtn.textContent = state.selected.size > 0 ? 'Deselect All' : 'Select All';
}

selectAllBtn.addEventListener('click', () => {
  if (state.selected.size > 0) {
    state.selected.clear();
  } else {
    const ids = latestGalleryCards.map(c => c.id).slice(0, 9);
    ids.forEach(id => state.selected.add(id));
    if (latestGalleryCards.length > 9) {
      alert(`You have ${latestGalleryCards.length} saved cards — selected the first 9 for the A4 print sheet.`);
    }
  }
  refreshGallery();
});

async function loadCardIntoForm(record) {
  const d = record.formData;
  document.getElementById('f-cardType').value = d.cardType;
  document.getElementById('f-accentColor').value = d.accentColor;
  document.getElementById('f-theme').value = d.theme || 'ivory';
  document.getElementById('f-collection').value = d.collection || '';
  document.getElementById('f-portrait-frame').checked = !!d.portraitFrame;
  document.getElementById('f-abilityFontSize').value = d.abilityFontSize || 33;
  document.getElementById('f-name').value = d.name;
  // Level used to be a free-typed number (1-20); the field is now a 0-4
  // dropdown. Clamp anything saved before that change so an old card with,
  // say, level 7 still shows a valid, selected option instead of silently
  // landing on none.
  const clampedLevel = Math.max(0, Math.min(4, Math.round(Number(d.level)) || 0));
  document.getElementById('f-level').value = String(clampedLevel);
  document.querySelectorAll('.stat-row').forEach(row => {
    const key = row.dataset.stat;
    const s = d.stats?.[key];
    if (s) {
      row.querySelector('input[type="number"]').value = s.n;
      row.querySelector('select').value = s.d;
    }
  });
  const isGang = d.cardType === 'Gang';
  toggleGangFields(isGang);
  updateResetStatsVisibility(d.cardType);
  updateNpcHintVisibility(d.cardType);
  if (isGang) {
    const models = d.health?.sequence?.length ? +d.health.sequence[0] : 5;
    gangModelsInput.value = models || 5;
  } else {
    const startDie = d.health?.sequence?.[0] || 'd10';
    document.getElementById('f-healthStart').value = startDie;
    document.getElementById('f-healthAsterisk').checked = !!d.health?.asterisk;
  }
  updateHealthPreview();
  document.getElementById('f-quote').value = d.quote || '';

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
  members: [],    // snapshots: {cardId, name, cardType, pngDataURL, slots}
  perks: [],      // {name, slots}
  associates: [], // {name, abilities: [name1, name2]}
};

const rosterNameInput = document.getElementById('roster-name');
const rosterPicker = document.getElementById('roster-picker');
const rosterMembersEl = document.getElementById('roster-members');
const rosterMembersEmpty = document.getElementById('roster-members-empty');
const rosterPerksEl = document.getElementById('roster-perks');
const rosterPerksEmpty = document.getElementById('roster-perks-empty');
const rosterAssociatesEl = document.getElementById('roster-associates');
const rosterAssociatesEmpty = document.getElementById('roster-associates-empty');
const associateWarningsEl = document.getElementById('associate-warnings');
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
  rosterState.associates = record.associates || [];
  renderRosterWorkspace();
});

function resetRosterState() {
  rosterState.editingId = null;
  rosterState.createdAt = null;
  rosterState.name = '';
  rosterState.members = [];
  rosterState.perks = [];
  rosterState.associates = [];
}

document.getElementById('roster-save').addEventListener('click', async () => {
  const id = rosterState.editingId || crypto.randomUUID();
  const record = {
    id,
    name: rosterState.name || 'Untitled League',
    members: rosterState.members,
    perks: rosterState.perks,
    associates: rosterState.associates,
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
  const associateSlots = rosterState.associates.length * ASSOCIATE_SLOT_COST;
  const used = memberSlots + perkSlots + associateSlots;
  return { memberSlots, perkSlots, associateSlots, used, remaining: BASE_ROSTER_SLOTS - used };
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

  // Associates
  renderAssociates();

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
  // Errata: Dominion cannot be combined with these three perks.
  const hasDominion = rosterState.perks.some(p => p.name === 'Dominion');
  const DOMINION_INCOMPATIBLE_PERKS = ['Network of Supporters', 'Bastion of Science', 'Call to Arms'];
  const conflictingDominionPerks = hasDominion
    ? rosterState.perks.filter(p => DOMINION_INCOMPATIBLE_PERKS.includes(p.name)).map(p => p.name)
    : [];
  if (conflictingDominionPerks.length) {
    warnings.push(`Dominion is incompatible with ${conflictingDominionPerks.join(', ')} (errata) — remove one or the other.`);
  }
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

// ---- Associates (p. 27-28) ----
document.getElementById('add-associate').addEventListener('click', () => {
  rosterState.associates.push({ name: '', abilities: ['', ''] });
  renderRosterWorkspace();
});

function associateAbilityOptionsHtml(selected) {
  return ASSOCIATE_ABILITIES.map(a =>
    `<option value="${escapeAttr(a.name)}"${a.name === selected ? ' selected' : ''}>${escapeHtml(a.name)}</option>`
  ).join('');
}

function renderAssociates() {
  rosterAssociatesEl.innerHTML = '';
  rosterAssociatesEmpty.style.display = rosterState.associates.length ? 'none' : 'block';
  rosterState.associates.forEach((a, i) => {
    const item = document.createElement('div');
    item.className = 'associate-item';
    const ability0 = findAssociateAbilityByName(a.abilities[0]);
    const ability1 = findAssociateAbilityByName(a.abilities[1]);
    item.innerHTML = `
      <div class="associate-item-top">
        <input type="text" class="associate-name-input" placeholder="e.g. The Butler" value="${escapeAttr(a.name)}" data-idx="${i}">
        <span class="roster-row-slots">1 slot</span>
        <button type="button" class="roster-row-remove associate-remove" data-idx="${i}" title="Remove">✕</button>
      </div>
      <div class="associate-ability-row">
        <select class="associate-ability-select" data-idx="${i}" data-slot="0">
          <option value="">— Ability 1 —</option>
          ${associateAbilityOptionsHtml(a.abilities[0])}
        </select>
        ${ability0 ? `<p class="associate-ability-text">${escapeHtml(ability0.text)}</p>` : ''}
      </div>
      <div class="associate-ability-row">
        <select class="associate-ability-select" data-idx="${i}" data-slot="1">
          <option value="">— Ability 2 —</option>
          ${associateAbilityOptionsHtml(a.abilities[1])}
        </select>
        ${ability1 ? `<p class="associate-ability-text">${escapeHtml(ability1.text)}</p>` : ''}
      </div>
    `;
    rosterAssociatesEl.appendChild(item);
  });

  rosterAssociatesEl.querySelectorAll('.associate-name-input').forEach(el => {
    el.addEventListener('input', () => {
      rosterState.associates[+el.dataset.idx].name = el.value;
    });
  });
  rosterAssociatesEl.querySelectorAll('.associate-ability-select').forEach(el => {
    el.addEventListener('change', () => {
      rosterState.associates[+el.dataset.idx].abilities[+el.dataset.slot] = el.value;
      renderRosterWorkspace();
    });
  });
  rosterAssociatesEl.querySelectorAll('.associate-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      rosterState.associates.splice(+btn.dataset.idx, 1);
      renderRosterWorkspace();
    });
  });

  // Warnings (soft — informational, not blocking, matching every other
  // rules check in the app): the p. 27 starting cap, and the p. 27 "you
  // cannot take the same Associate Ability more than once per league"
  // rule (checked both within one Associate's own 2 picks and across
  // every Associate in the roster).
  const warnings = [];
  if (rosterState.associates.length > ASSOCIATE_LEAGUE_CAP) {
    warnings.push(`A league normally starts with at most ${ASSOCIATE_LEAGUE_CAP} Associates (p. 27) — this roster has ${rosterState.associates.length}. You can earn more as your Reputation grows.`);
  }
  const abilityUsage = new Map(); // ability name -> count across the whole roster
  rosterState.associates.forEach((assoc, i) => {
    const chosen = assoc.abilities.filter(Boolean);
    const label = assoc.name.trim() || `Associate ${i + 1}`;
    if (chosen.length === 2 && chosen[0] === chosen[1]) {
      warnings.push(`“${label}” has the same Associate Ability picked twice — Associates need 2 different abilities (p. 27).`);
    }
    chosen.forEach(name => abilityUsage.set(name, (abilityUsage.get(name) || 0) + 1));
  });
  abilityUsage.forEach((count, name) => {
    if (count > 1) {
      warnings.push(`“${name}” is used by more than one Associate — you can't take the same Associate Ability more than once per league (p. 27).`);
    }
  });
  associateWarningsEl.innerHTML = warnings.map(w => `<div class="roster-warning">⚠ ${escapeHtml(w)}</div>`).join('');
}

// ---- Roster Print Sheet (Print Roster / Download PDF) ----
// The on-screen Perks and Associates columns only show names and slot
// costs (that's fine for building the roster, but useless at the table).
// This builds a plain reference document with the full rules text of
// every perk and every Associate ability actually printed on it.
function buildRosterPrintData() {
  const { used, remaining, memberSlots, perkSlots, associateSlots } = computeRosterSlots();
  return {
    name: rosterState.name || 'Untitled League',
    used, remaining, total: BASE_ROSTER_SLOTS, memberSlots, perkSlots, associateSlots,
    members: rosterState.members.map(m => ({
      name: m.name || 'Unnamed',
      cardType: m.cardType || 'Custom',
      slots: m.slots || 0,
    })),
    perks: rosterState.perks.map(p => ({
      name: p.name,
      slots: p.slots,
      text: (PERKS.find(x => x.name === p.name) || {}).text || '',
    })),
    associates: rosterState.associates.map((a, i) => ({
      name: (a.name || '').trim() || `Associate ${i + 1}`,
      abilities: a.abilities.filter(Boolean).map(n => {
        const found = findAssociateAbilityByName(n);
        return { name: n, text: found ? found.text : '' };
      }),
    })),
  };
}

function rosterSlotSummaryText(data) {
  return `${data.used} / ${data.total} roster slots used` +
    (data.remaining < 0 ? ` — over by ${-data.remaining}` : ` (${data.remaining} remaining)`) +
    ` · Colleagues: ${data.memberSlots} · Perks: ${data.perkSlots} · Associates: ${data.associateSlots}`;
}

function renderRosterPrintSheet() {
  const data = buildRosterPrintData();

  document.getElementById('rps-name').textContent = data.name;
  document.getElementById('rps-summary').textContent = rosterSlotSummaryText(data);

  const colleaguesEl = document.getElementById('rps-colleagues');
  colleaguesEl.innerHTML = data.members.map(m => `
    <div class="rps-colleague-row">
      <span>${escapeHtml(m.name)} <span class="rps-block-meta">(${escapeHtml(m.cardType)})</span></span>
      <span>${m.slots} slot${m.slots === 1 ? '' : 's'}</span>
    </div>
  `).join('');
  document.getElementById('rps-colleagues-empty').style.display = data.members.length ? 'none' : 'block';

  const perksEl = document.getElementById('rps-perks');
  perksEl.innerHTML = data.perks.map(p => `
    <div class="rps-block">
      <div class="rps-block-name">${escapeHtml(p.name)} <span class="rps-block-meta">— ${p.slots} slot${p.slots === 1 ? '' : 's'}</span></div>
      ${p.text ? `<p class="rps-block-text">${escapeHtml(p.text)}</p>` : ''}
    </div>
  `).join('');
  document.getElementById('rps-perks-empty').style.display = data.perks.length ? 'none' : 'block';

  const associatesEl = document.getElementById('rps-associates');
  associatesEl.innerHTML = data.associates.map(a => `
    <div class="rps-associate-block">
      <div class="rps-associate-name">${escapeHtml(a.name)}</div>
      ${a.abilities.map(ab => `
        <div class="rps-block">
          <div class="rps-block-name">${escapeHtml(ab.name)}</div>
          ${ab.text ? `<p class="rps-block-text">${escapeHtml(ab.text)}</p>` : ''}
        </div>
      `).join('') || '<p class="rps-empty">No abilities picked yet.</p>'}
    </div>
  `).join('');
  document.getElementById('rps-associates-empty').style.display = data.associates.length ? 'none' : 'block';

  return data;
}

document.getElementById('roster-print-btn').addEventListener('click', () => {
  renderRosterPrintSheet();
  document.body.classList.add('printing-roster-sheet');
  window.print();
});
// Some browsers/environments never fire afterprint (e.g. the print dialog
// is cancelled in a way that doesn't trigger it) — belt-and-suspenders
// cleanup on focus return as well, so the class can't get stuck.
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-roster-sheet');
});

// Plain-text rendering of the same roster data, used as a fallback for
// Copy Roster when a rich copy isn't possible, and as the pre-filled text
// for the last-resort manual-copy prompt.
function buildRosterPlainText(data) {
  const lines = [];
  lines.push(data.name);
  lines.push(rosterSlotSummaryText(data));
  lines.push('');

  lines.push('COLLEAGUES');
  if (!data.members.length) {
    lines.push('No colleagues on this roster.');
  } else {
    data.members.forEach(m => lines.push(`${m.name} (${m.cardType}) — ${m.slots} slot${m.slots === 1 ? '' : 's'}`));
  }
  lines.push('');

  lines.push('PERKS');
  if (!data.perks.length) {
    lines.push('No perks on this roster.');
  } else {
    data.perks.forEach(p => {
      lines.push(`${p.name} — ${p.slots} slot${p.slots === 1 ? '' : 's'}`);
      if (p.text) lines.push(p.text);
      lines.push('');
    });
  }

  lines.push('ASSOCIATES');
  if (!data.associates.length) {
    lines.push('No Associates on this roster.');
  } else {
    data.associates.forEach(a => {
      lines.push(a.name);
      if (!a.abilities.length) {
        lines.push('No abilities picked yet.');
      } else {
        a.abilities.forEach(ab => {
          lines.push(ab.name);
          if (ab.text) lines.push(ab.text);
        });
      }
      lines.push('');
    });
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Copy Roster — for pasting the same info into Apple Notes or any other
// app, no printer needed. Three layers, each falling back to the next:
//   1. Select the actual rendered sheet and use the browser's own copy
//      command. This is what carries headings/bold into rich-text apps
//      (Apple Notes, Notion, Word) instead of dumping flat text, and it
//      works offline / from file:// where the async Clipboard API's
//      secure-context requirement can be unreliable.
//   2. navigator.clipboard.writeText() with the plain-text rendering, if
//      the selection-based copy didn't work.
//   3. A prompt() pre-filled with the plain text, so the user can always
//      manually select-all + copy even with no clipboard API at all.
document.getElementById('roster-copy-btn').addEventListener('click', async () => {
  const data = renderRosterPrintSheet();
  const btn = document.getElementById('roster-copy-btn');
  const originalLabel = btn.textContent;

  function flash(label) {
    btn.textContent = label;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalLabel;
      btn.disabled = false;
    }, 1400);
  }

  const sheet = document.getElementById('roster-print-sheet');
  document.body.classList.add('copying-roster-sheet');
  let copied = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(sheet);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copied = document.execCommand('copy');
    selection.removeAllRanges();
  } catch (err) {
    copied = false;
  }
  document.body.classList.remove('copying-roster-sheet');

  if (!copied) {
    try {
      await navigator.clipboard.writeText(buildRosterPlainText(data));
      copied = true;
    } catch (err) {
      copied = false;
    }
  }

  if (!copied) {
    window.prompt('Copy this roster (select all, then copy):', buildRosterPlainText(data));
    return;
  }

  flash('✓ Copied!');
});

document.getElementById('roster-download-pdf').addEventListener('click', () => {
  const data = renderRosterPrintSheet();
  downloadRosterPDF(data);
});

function downloadRosterPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginX = 18, marginTop = 20, marginBottom = 18, pageW = 210, pageH = 297;
  const contentW = pageW - marginX * 2;
  let y = marginTop;

  // jsPDF works in points internally for font size; converts to a mm line
  // height using its default 1.15 line-height factor so wrapped paragraphs
  // and manual page-break checks agree with what actually gets drawn.
  function mmPerLine(pt) { return pt * 1.15 / 72 * 25.4; }
  function ensureSpace(h) {
    if (y + h > pageH - marginBottom) { doc.addPage(); y = marginTop; }
  }
  function heading(text, size) {
    ensureSpace(mmPerLine(size) + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(text, marginX, y);
    y += mmPerLine(size) + 2;
  }
  function paragraph(text, size, opts) {
    opts = opts || {};
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, contentW);
    const lh = mmPerLine(size);
    ensureSpace(lines.length * lh + (opts.gap || 0));
    doc.text(lines, marginX, y);
    y += lines.length * lh + (opts.gap || 0);
  }
  function twoCol(left, right, size) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const lh = mmPerLine(size);
    ensureSpace(lh);
    doc.text(left, marginX, y);
    doc.text(right, pageW - marginX, y, { align: 'right' });
    y += lh;
  }

  heading(data.name, 18);
  paragraph(rosterSlotSummaryText(data), 10, { gap: 6 });

  heading('Colleagues', 13);
  if (!data.members.length) {
    paragraph('No colleagues on this roster.', 10, { gap: 4 });
  } else {
    data.members.forEach(m => {
      twoCol(`${m.name}  (${m.cardType})`, `${m.slots} slot${m.slots === 1 ? '' : 's'}`, 10.5);
    });
    y += 4;
  }

  heading('Perks', 13);
  if (!data.perks.length) {
    paragraph('No perks on this roster.', 10, { gap: 4 });
  } else {
    data.perks.forEach(p => {
      paragraph(`${p.name} — ${p.slots} slot${p.slots === 1 ? '' : 's'}`, 11, { bold: true, gap: 1 });
      if (p.text) paragraph(p.text, 10, { gap: 4 });
      else y += 4;
    });
  }

  heading('Associates', 13);
  if (!data.associates.length) {
    paragraph('No Associates on this roster.', 10, { gap: 4 });
  } else {
    data.associates.forEach(a => {
      paragraph(a.name, 12, { bold: true, gap: 2 });
      if (!a.abilities.length) {
        paragraph('No abilities picked yet.', 10, { gap: 4 });
      } else {
        a.abilities.forEach(ab => {
          paragraph(ab.name, 10.5, { bold: true, gap: 1 });
          if (ab.text) paragraph(ab.text, 10, { gap: 3 });
          else y += 3;
        });
      }
      y += 2;
    });
  }

  const safeName = (data.name || 'roster').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'roster';
  doc.save(`${safeName}-roster.pdf`);
}

// ---- Add-colleague picker ----
const colleaguePickerModal = document.getElementById('colleague-picker-modal');
const colleaguePickerList = document.getElementById('colleague-picker-list');
const colleagueSearchInput = document.getElementById('colleague-search');
const colleagueThemeFilterSelect = document.getElementById('colleague-theme-filter');

document.getElementById('open-colleague-picker').addEventListener('click', async () => {
  colleaguePickerModal.classList.remove('hidden');
  colleagueSearchInput.value = '';
  colleagueThemeFilterSelect.value = '';
  await renderColleaguePicker();
});
document.getElementById('close-colleague-picker').addEventListener('click', () => {
  colleaguePickerModal.classList.add('hidden');
});
colleaguePickerModal.addEventListener('click', (e) => {
  if (e.target === colleaguePickerModal) colleaguePickerModal.classList.add('hidden');
});
colleagueSearchInput.addEventListener('input', renderColleaguePicker);
colleagueThemeFilterSelect.addEventListener('change', renderColleaguePicker);

async function renderColleaguePicker() {
  const cards = await getAllCards();
  refreshThemeOptions(cards);
  const addedIds = new Set(rosterState.members.map(m => m.cardId));
  const searchText = colleagueSearchInput.value.trim().toLowerCase();
  const themeFilter = colleagueThemeFilterSelect.value;
  const available = cards.filter(c => {
    if (addedIds.has(c.id)) return false;
    if (searchText && !(c.formData?.name || '').toLowerCase().includes(searchText)) return false;
    if (themeFilter && (c.formData?.collection || '') !== themeFilter) return false;
    return true;
  });
  if (!available.length) {
    const allAdded = cards.length && cards.every(c => addedIds.has(c.id));
    colleaguePickerList.innerHTML = allAdded
      ? '<div class="library-empty">Every saved card is already on this roster (or you haven’t saved any yet in the Card Designer).</div>'
      : '<div class="library-empty">No cards match your search/Theme filter.</div>';
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

// ---------------- Backup (export / import) ----------------
// Everything is stored locally in this browser's IndexedDB (see README) —
// there's no account or sync. Export bundles every saved card and roster
// (portraits/card art included, since they're already embedded as data
// URLs on each record) into one JSON file; Import reads that file back in
// on this browser, a different browser, or a different device entirely.
const importBackupFile = document.getElementById('import-backup-file');

document.getElementById('btn-export-backup').addEventListener('click', async () => {
  const data = await exportAllData();
  if (!data.cards.length && !data.rosters.length) {
    alert('Nothing saved yet — build and save a card or roster first.');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = localDateStamp(new Date(data.exportedAt));
  const link = document.createElement('a');
  link.download = `pulp-alley-backup-${stamp}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import-backup').addEventListener('click', () => {
  importBackupFile.value = ''; // allow re-selecting the same file twice in a row
  importBackupFile.click();
});

importBackupFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('Could not read that file — it doesn’t look like valid JSON.');
    return;
  }
  const cardCount = Array.isArray(data?.cards) ? data.cards.length : 0;
  const rosterCount = Array.isArray(data?.rosters) ? data.rosters.length : 0;
  if (!cardCount && !rosterCount) {
    alert('This file doesn’t look like a Pulp Alley Card Maker backup.');
    return;
  }
  const proceed = confirm(
    `Import ${cardCount} card(s) and ${rosterCount} roster(s) from this backup?\n\n` +
    `Anything already saved here with a matching ID will be overwritten by the backup’s version. Nothing else is deleted.`
  );
  if (!proceed) return;
  try {
    const result = await importAllData(data);
    state.selected.clear();
    await refreshGallery();
    await refreshRosterTab();
    saveStatus.textContent = `Imported ${result.cardsImported} card(s) and ${result.rostersImported} roster(s).`;
    setTimeout(() => { saveStatus.textContent = ''; }, 4000);
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
});

// ---------------- Init ----------------
document.fonts.ready.then(updatePreview);
updatePreview();
// Populate the Designer's Theme autocomplete (and both Theme filter
// dropdowns) from whatever's already saved, so it's ready immediately
// rather than waiting for the user to first open My Cards or the roster's
// colleague picker.
getAllCards().then(refreshThemeOptions);
