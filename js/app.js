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
  updateNonUniqueVisibility(e.target.value);
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

// Non-Unique — marks a saved card as a repeatable "type" (e.g. Rebel
// Commando, Scout Trooper) rather than a single named individual, so the
// League Roster's colleague picker allows more than one copy — the same
// exception Gang cards already get automatically. Hidden for Gang itself,
// since a Gang can already be added more than once without this flag.
const nonUniqueRowEl = document.getElementById('non-unique-row');
const nonUniqueHintEl = document.getElementById('non-unique-hint');
function updateNonUniqueVisibility(cardType) {
  const show = cardType !== 'Gang';
  nonUniqueRowEl.style.display = show ? 'flex' : 'none';
  nonUniqueHintEl.style.display = show ? 'block' : 'none';
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
updateNonUniqueVisibility(document.getElementById('f-cardType').value);

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
    // "affiliation" is an optional sub-group within a Theme (e.g. "Rebel"
    // within the "Star Wars" Theme) — same free-text/filter-only pattern as
    // collection above, never rendered on the card itself.
    affiliation: document.getElementById('f-affiliation').value.trim(),
    // "nonUnique" flags a card as a repeatable type (e.g. Rebel Commando)
    // rather than a single named individual, so the League Roster picker
    // lets it be added more than once — the same exception Gang already
    // gets automatically. Never rendered on the card itself.
    nonUnique: document.getElementById('f-non-unique').checked,
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
  // A blank Name silently saved as "Unnamed Character" before, with no
  // warning — easy way for half-finished/junk cards to pile up unnoticed
  // in My Cards. Now it's a confirm, not a hard block, since a genuinely
  // nameless character (a mook, a placeholder) is still a valid thing to
  // save on purpose.
  if (!data.name.trim() && !confirm('This card has no Name — save it anyway as "Unnamed Character"?')) {
    return;
  }
  data.portraitImg = state.portraitImg;
  data.portraitView = state.portraitView;
  renderCard(canvas, data);
  const pngDataURL = canvas.toDataURL('image/png');

  // Store only the portrait pixels that are ever actually shown (exactly
  // what's framed by the current zoom/pan), not the full original upload —
  // the biggest single driver of backup size as more cards pile up. This
  // uses the same cover-fit math the render above just used, so it's a
  // pixel-for-pixel match of what's on the card; it's also a one-way crop,
  // so the portrait view resets to "no further pan/zoom range needed" and
  // the in-session state is updated to match what just got saved.
  let portraitDataURL = state.portraitOriginalDataURL;
  let portraitView = state.portraitView;
  if (state.portraitImg) {
    portraitDataURL = renderPortraitCrop(state.portraitImg, state.portraitView);
    portraitView = { scale: 1, offsetX: 0, offsetY: 0 };
    state.portraitOriginalDataURL = portraitDataURL;
    state.portraitImg = await loadImage(portraitDataURL);
    state.portraitView = portraitView;
    zoomSlider.value = 1;
  }

  const id = state.editingId || crypto.randomUUID();
  const record = {
    id,
    formData: { ...data, portraitImg: undefined },
    portraitDataURL,
    portraitView,
    pngDataURL,
    createdAt: state.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await saveCard(record);
  state.editingId = id;
  // Refreshes the Theme and Affiliation autocomplete lists right away if
  // this card introduced a brand-new Theme/Affiliation, so it's available
  // for the very next card without needing a trip through My Cards first.
  getAllCards().then(cards => { refreshThemeOptions(cards); refreshAffiliationOptions(cards); });
  refreshBackupBanner();
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
  updateNonUniqueVisibility(document.getElementById('f-cardType').value);
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
  // form.reset() above clears the Theme field back to blank but, like any
  // programmatic change, doesn't fire its 'input' listener — re-scope the
  // Affiliation autocomplete explicitly so a brand-new card goes back to
  // suggesting every Affiliation in use (no Theme yet to narrow it down).
  getAllCards().then(refreshAffiliationOptions);
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
const backupThemeFilterSelect = document.getElementById('backup-theme-filter');

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
// doesn't silently reset the user back to "All Themes"). The My Cards
// gallery's filter additionally gets a "No Theme" option (sentinel value
// "__none__") so cards with a blank Theme can be found — the picker/backup
// filters don't need it, since neither has been asked for it.
function refreshThemeOptions(cards) {
  const names = distinctCollections(cards);
  collectionOptionsList.innerHTML = names.map(n => `<option value="${escapeAttr(n)}"></option>`).join('');
  [galleryThemeFilterSelect, colleagueThemeFilterSelect, backupThemeFilterSelect].forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    const noThemeOption = sel === galleryThemeFilterSelect ? '<option value="__none__">No Theme</option>' : '';
    sel.innerHTML = '<option value="">All Themes</option>' + noThemeOption + names.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');
    const currentStillValid = current === '__none__' ? sel === galleryThemeFilterSelect : names.includes(current);
    sel.value = currentStillValid ? current : '';
  });
}

// ---------------- Affiliations (optional sub-group within a Theme) ----------------
// Same free-text, filter-only pattern as Themes above — e.g. "Rebel",
// "Empire", "Mercenaries" as Affiliations within a "Star Wars" Theme — kept
// as a second, independent field rather than folded into the Theme name so
// the Theme filter alone still means "everything from this Theme, any
// Affiliation" and Rename Theme still renames the whole Theme in one go.
// Like Theme, this is purely for organizing/filtering here on the site —
// it's never drawn on the rendered/printed card.
//
// Unlike Theme, Affiliation suggestions are scoped to a Theme: an
// Affiliation name can be reused across unrelated Themes (e.g.
// "Protagonist"/"Antagonist" under both "Die Hard" and some other movie),
// so offering every Affiliation ever used everywhere would suggest
// "Rebel"/"Empire"/"Mercenaries" while typing a "Die Hard" card. Instead,
// each surface below only offers Affiliations with an existing connection
// to whatever Theme is currently in play there: the Designer's own Theme
// field for its autocomplete, and each filter dropdown's paired Theme
// filter for My Cards / the colleague picker. No Theme selected yet (a
// blank Designer Theme field, or "All Themes") falls back to every
// Affiliation in use, since there's no Theme yet to scope by.
const affiliationInput = document.getElementById('f-affiliation');
const affiliationOptionsList = document.getElementById('affiliation-options');

function distinctAffiliations(cards) {
  const set = new Set();
  cards.forEach(c => {
    const name = (c.formData?.affiliation || '').trim();
    if (name) set.add(name);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Affiliations already used together with a given Theme value. themeFilter
// follows the same convention as the Theme filter dropdowns: '' (or
// falsy) means no Theme to scope by (every card), '__none__' means cards
// with no Theme at all, and anything else is an exact Theme match.
function affiliationsForTheme(cards, themeFilter) {
  const scoped = !themeFilter
    ? cards
    : themeFilter === '__none__'
      ? cards.filter(c => !(c.formData?.collection || '').trim())
      : cards.filter(c => (c.formData?.collection || '') === themeFilter);
  return distinctAffiliations(scoped);
}

// Repopulates the Designer's Affiliation autocomplete plus both Affiliation
// filter dropdowns (My Cards, League Roster's colleague picker), each
// scoped to its own Theme context (see above), preserving each dropdown's
// current selection where it's still valid under the new scope. My Cards
// additionally gets a "No Affiliation" option (sentinel "__none__"), same
// as the Theme filter does.
function refreshAffiliationOptions(cards) {
  const designerNames = affiliationsForTheme(cards, collectionInput.value.trim());
  affiliationOptionsList.innerHTML = designerNames.map(n => `<option value="${escapeAttr(n)}"></option>`).join('');

  [galleryAffiliationFilterSelect, colleagueAffiliationFilterSelect].forEach(sel => {
    if (!sel) return;
    const isGalleryFilter = sel === galleryAffiliationFilterSelect;
    const pairedThemeFilter = (isGalleryFilter ? galleryThemeFilterSelect : colleagueThemeFilterSelect).value;
    const names = affiliationsForTheme(cards, pairedThemeFilter);
    const current = sel.value;
    const noAffiliationOption = isGalleryFilter ? '<option value="__none__">No Affiliation</option>' : '';
    sel.innerHTML = '<option value="">All Affiliations</option>' + noAffiliationOption + names.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');
    const currentStillValid = current === '__none__' ? isGalleryFilter : names.includes(current);
    sel.value = currentStillValid ? current : '';
  });
}

// Retyping/reselecting the Designer's own Theme field immediately re-scopes
// its Affiliation autocomplete to match — e.g. clearing "Star Wars" back to
// blank, or changing it to "Die Hard", updates the suggestions right away
// rather than waiting for the next save.
collectionInput.addEventListener('input', () => { getAllCards().then(refreshAffiliationOptions); });

// ---------------- Gallery ----------------
const galleryGrid = document.getElementById('gallery-grid');
const galleryEmpty = document.getElementById('gallery-empty');
const galleryNoMatch = document.getElementById('gallery-no-match');
const selectedCountEl = document.getElementById('selected-count');
const selectAllBtn = document.getElementById('select-all-btn');
const gallerySearchInput = document.getElementById('gallery-search');
const galleryThemeFilterSelect = document.getElementById('gallery-theme-filter');
const galleryAffiliationFilterSelect = document.getElementById('gallery-affiliation-filter');
const galleryTypeFilterSelect = document.getElementById('gallery-type-filter');
const gallerySortSelect = document.getElementById('gallery-sort');
const btnRenameTheme = document.getElementById('btn-rename-theme');
const themeRenameStatus = document.getElementById('theme-rename-status');
const btnRenameAffiliation = document.getElementById('btn-rename-affiliation');
const affiliationRenameStatus = document.getElementById('affiliation-rename-status');

// Tracks the cards currently shown in the gallery (same order as
// rendered, i.e. after search/Theme/Type filtering and sorting), so Select
// All can pick "the first 9" consistently with what's on screen without a
// redundant extra fetch from IndexedDB.
let latestGalleryCards = [];

gallerySearchInput.addEventListener('input', refreshGallery);
galleryThemeFilterSelect.addEventListener('change', () => { refreshGallery(); updateRenameThemeButtonState(); });
galleryAffiliationFilterSelect.addEventListener('change', () => { refreshGallery(); updateRenameAffiliationButtonState(); });
galleryTypeFilterSelect.addEventListener('change', refreshGallery);
gallerySortSelect.addEventListener('change', refreshGallery);

// "Rename Theme" only makes sense once a specific Theme is picked in the
// filter above — not on "All Themes" or "No Theme", neither of which name
// an actual Theme to rename.
function updateRenameThemeButtonState() {
  const theme = galleryThemeFilterSelect.value;
  const isRealTheme = !!theme && theme !== '__none__';
  btnRenameTheme.disabled = !isRealTheme;
  btnRenameTheme.title = isRealTheme
    ? `Rename the "${theme}" Theme on every card that uses it`
    : 'Pick a Theme above first';
}

// Renames a Theme in bulk: every saved card currently in the selected
// Theme gets its formData.collection updated and re-saved (id, art, and
// every other field untouched — and updatedAt is deliberately left alone,
// so a bulk rename doesn't reshuffle "Sort: Latest"). Typing the name of
// an existing different Theme merges the two, which is called out in the
// confirmation message so it's never a silent surprise.
btnRenameTheme.addEventListener('click', async () => {
  const oldTheme = galleryThemeFilterSelect.value;
  if (!oldTheme || oldTheme === '__none__') return;

  const input = window.prompt(
    `Rename the "${oldTheme}" Theme to:\n\n(Updates every card currently in this Theme. Nothing else about those cards changes.)`,
    oldTheme
  );
  if (input === null) return; // cancelled
  const newTheme = input.trim();
  if (!newTheme) { alert("Theme name can't be blank."); return; }
  if (newTheme === oldTheme) return; // no actual change

  const allCards = await getAllCards();
  const affected = allCards.filter(c => (c.formData?.collection || '') === oldTheme);
  const mergingIntoExisting = allCards.some(c => !affected.includes(c) && (c.formData?.collection || '') === newTheme);
  for (const record of affected) {
    record.formData.collection = newTheme;
    await saveCard(record);
  }

  await refreshGallery(); // rebuilds the Theme dropdown so newTheme is now a valid option
  galleryThemeFilterSelect.value = newTheme;
  await refreshGallery(); // re-filters the grid to the renamed Theme
  updateRenameThemeButtonState();

  const count = affected.length;
  themeRenameStatus.textContent = `Renamed "${oldTheme}" to "${newTheme}" on ${count} card${count === 1 ? '' : 's'}` +
    (mergingIntoExisting ? ` (merged into the existing "${newTheme}" Theme).` : '.');
  setTimeout(() => { themeRenameStatus.textContent = ''; }, 5000);
});

updateRenameThemeButtonState();

// "Rename Affiliation" only makes sense once a specific Affiliation is
// picked in the filter above — same reasoning as Rename Theme.
function updateRenameAffiliationButtonState() {
  const affiliation = galleryAffiliationFilterSelect.value;
  const isRealAffiliation = !!affiliation && affiliation !== '__none__';
  btnRenameAffiliation.disabled = !isRealAffiliation;
  btnRenameAffiliation.title = isRealAffiliation
    ? `Rename the "${affiliation}" Affiliation on every card that uses it`
    : 'Pick an Affiliation above first';
}

// Renames an Affiliation in bulk, same mechanics as Rename Theme: every
// saved card currently carrying the selected Affiliation gets
// formData.affiliation updated and re-saved, updatedAt left alone.
// Renaming to an existing Affiliation's name merges the two.
btnRenameAffiliation.addEventListener('click', async () => {
  const oldAffiliation = galleryAffiliationFilterSelect.value;
  if (!oldAffiliation || oldAffiliation === '__none__') return;

  const input = window.prompt(
    `Rename the "${oldAffiliation}" Affiliation to:\n\n(Updates every card currently with this Affiliation. Nothing else about those cards changes.)`,
    oldAffiliation
  );
  if (input === null) return; // cancelled
  const newAffiliation = input.trim();
  if (!newAffiliation) { alert("Affiliation name can't be blank."); return; }
  if (newAffiliation === oldAffiliation) return; // no actual change

  const allCards = await getAllCards();
  const affected = allCards.filter(c => (c.formData?.affiliation || '') === oldAffiliation);
  const mergingIntoExisting = allCards.some(c => !affected.includes(c) && (c.formData?.affiliation || '') === newAffiliation);
  for (const record of affected) {
    record.formData.affiliation = newAffiliation;
    await saveCard(record);
  }

  await refreshGallery(); // rebuilds the Affiliation dropdown so newAffiliation is now a valid option
  galleryAffiliationFilterSelect.value = newAffiliation;
  await refreshGallery(); // re-filters the grid to the renamed Affiliation
  updateRenameAffiliationButtonState();

  const count = affected.length;
  affiliationRenameStatus.textContent = `Renamed "${oldAffiliation}" to "${newAffiliation}" on ${count} card${count === 1 ? '' : 's'}` +
    (mergingIntoExisting ? ` (merged into the existing "${newAffiliation}" Affiliation).` : '.');
  setTimeout(() => { affiliationRenameStatus.textContent = ''; }, 5000);
});

updateRenameAffiliationButtonState();

async function refreshGallery() {
  const allCards = await getAllCards();
  refreshThemeOptions(allCards);
  refreshAffiliationOptions(allCards);

  const searchText = gallerySearchInput.value.trim().toLowerCase();
  const themeFilter = galleryThemeFilterSelect.value;
  const affiliationFilter = galleryAffiliationFilterSelect.value;
  const typeFilter = galleryTypeFilterSelect.value;
  const cards = allCards.filter(c => {
    const matchesSearch = !searchText || (c.formData?.name || '').toLowerCase().includes(searchText);
    const matchesTheme = !themeFilter
      || (themeFilter === '__none__' ? !(c.formData?.collection || '').trim() : (c.formData?.collection || '') === themeFilter);
    const matchesAffiliation = !affiliationFilter
      || (affiliationFilter === '__none__' ? !(c.formData?.affiliation || '').trim() : (c.formData?.affiliation || '') === affiliationFilter);
    const matchesType = !typeFilter || (c.formData?.cardType || '') === typeFilter;
    return matchesSearch && matchesTheme && matchesAffiliation && matchesType;
  });

  // "Name" (the default) sorts A-Z, case-insensitively; "Latest" sorts by
  // most-recently-saved first. getAllCards() already returns latest-first,
  // but sorting explicitly here doesn't depend on that staying true.
  if (gallerySortSelect.value === 'latest') {
    cards.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } else {
    cards.sort((a, b) => (a.formData?.name || '').localeCompare(b.formData?.name || '', undefined, { sensitivity: 'base' }));
  }

  latestGalleryCards = cards;
  const filtering = !!(searchText || themeFilter || affiliationFilter || typeFilter);
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
      if (confirm(`Delete “${record.formData?.name || 'this card'}”?\n\nIt'll sit in Recently Deleted (top bar) for 30 days in case you change your mind.`)) {
        await trashCard(record.id);
        state.selected.delete(record.id);
        refreshGallery();
        refreshTrashBadge();
        refreshBackupBanner();
      }
    });
    galleryGrid.appendChild(el);
  });
  updateSelectedCount();
}

// No cap on how many cards can be selected — the Print Sheet fits 9 per
// physical A4 page (that's a paper-size constant, not a UI limit) and
// spills onto as many additional pages as needed (see renderPrintPages()).
function toggleSelect(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  refreshGallery();
}

function updateSelectedCount() {
  selectedCountEl.textContent = `${state.selected.size} selected`;
  // A single toggle button: nothing selected -> "Select All" selects
  // everything currently shown; anything selected (all or partial) ->
  // "Deselect All" clears it, so pressing it a second time always gets you
  // back to zero.
  selectAllBtn.textContent = state.selected.size > 0 ? 'Deselect All' : 'Select All';
}

selectAllBtn.addEventListener('click', () => {
  if (state.selected.size > 0) {
    state.selected.clear();
  } else {
    latestGalleryCards.forEach(c => state.selected.add(c.id));
  }
  refreshGallery();
});

async function loadCardIntoForm(record) {
  const d = record.formData;
  document.getElementById('f-cardType').value = d.cardType;
  document.getElementById('f-accentColor').value = d.accentColor;
  document.getElementById('f-theme').value = d.theme || 'ivory';
  document.getElementById('f-collection').value = d.collection || '';
  document.getElementById('f-affiliation').value = d.affiliation || '';
  document.getElementById('f-non-unique').checked = !!d.nonUnique;
  // Setting .value programmatically (unlike typing) doesn't fire the
  // Theme field's 'input' listener above, so the Affiliation autocomplete
  // needs an explicit re-scope here to match whatever Theme this card has.
  refreshAffiliationOptions(await getAllCards());
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
  updateNonUniqueVisibility(d.cardType);
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
// One 3x3 grid (renderRosterSheet, js/roster.js) is a single physical A4
// page — 9 cards is a paper-size fact, not a UI cap. More than 9 selected
// cards now spill onto additional pages instead of being blocked at 9.
const sheetStage = document.getElementById('sheet-stage');
const printSheetHeading = document.getElementById('print-sheet-heading');
const printDownloadPngBtn = document.getElementById('print-download-png');
// Repopulated by refreshPrintSheet() on every visit to this tab; read by
// the Download PNG/PDF handlers below so they don't need to re-render.
let sheetPageCanvases = [];

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function refreshPrintSheet() {
  const cards = await getAllCards();
  const selectedIds = [...state.selected];
  const records = selectedIds.map(id => cards.find(c => c.id === id)).filter(Boolean);
  const images = await Promise.all(records.map(r => loadImage(r.pngDataURL)));

  // Always render at least one (possibly empty) page, matching the
  // previous single-canvas behavior when nothing's selected yet.
  const pages = images.length ? chunkArray(images, 9) : [[]];

  sheetStage.innerHTML = '';
  sheetPageCanvases = pages.map((pageImages, i) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'sheet-page-canvas';
    const slots = new Array(9).fill(null);
    pageImages.forEach((img, j) => { slots[j] = img; });
    renderRosterSheet(canvas, slots);
    sheetStage.appendChild(canvas);
    if (pages.length > 1) {
      const label = document.createElement('div');
      label.className = 'sheet-page-label';
      label.textContent = `Page ${i + 1} of ${pages.length}`;
      sheetStage.appendChild(label);
    }
    return canvas;
  });

  printSheetHeading.textContent = pages.length > 1
    ? `Print Sheet — A4 (${images.length} cards, ${pages.length} pages)`
    : 'Print Sheet — A4';

  // A PNG can't hold multiple pages the way a PDF can, and firing off
  // several downloads at once from one click is exactly the pattern
  // Chrome's "multiple automatic downloads" guard blocks (silently, past
  // the first) — so rather than a fragile multi-download or a bundled zip,
  // PNG export is single-page-only. Use Download PDF for more than one page.
  printDownloadPngBtn.disabled = pages.length > 1;
  printDownloadPngBtn.title = pages.length > 1
    ? 'PNG export is single-page only — use Download PDF for more than one page'
    : '';
}

document.getElementById('print-download-png').addEventListener('click', () => {
  if (sheetPageCanvases.length !== 1) return; // guarded by disabling the button above
  const link = document.createElement('a');
  link.download = 'pulp-alley-roster-a4.png';
  link.href = sheetPageCanvases[0].toDataURL('image/png');
  link.click();
});

document.getElementById('print-download-pdf').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  sheetPageCanvases.forEach((canvas, i) => {
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
  });
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
// Filled from PERKS.length rather than hardcoded in index.html, so this
// count can never again silently go stale as perksData.js grows.
document.getElementById('perk-count-hint').textContent = PERKS.length;
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
  refreshBackupBanner();
});

document.getElementById('roster-delete').addEventListener('click', async () => {
  if (!rosterState.editingId) return;
  if (!confirm(`Delete “${rosterState.name || 'this roster'}”?\n\nIt'll sit in Recently Deleted (top bar) for 30 days in case you change your mind.`)) return;
  await trashRoster(rosterState.editingId);
  resetRosterState();
  await refreshRosterTab();
  refreshTrashBadge();
  refreshBackupBanner();
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
const colleagueAffiliationFilterSelect = document.getElementById('colleague-affiliation-filter');

document.getElementById('open-colleague-picker').addEventListener('click', async () => {
  colleaguePickerModal.classList.remove('hidden');
  colleagueSearchInput.value = '';
  colleagueThemeFilterSelect.value = '';
  colleagueAffiliationFilterSelect.value = '';
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
colleagueAffiliationFilterSelect.addEventListener('change', renderColleaguePicker);

async function renderColleaguePicker() {
  const cards = await getAllCards();
  refreshThemeOptions(cards);
  refreshAffiliationOptions(cards);
  // Gangs (p. 21) represent a generic group of similar mooks rather than a
  // single unique named character, so — unlike every other Card Type — a
  // league can field more than one copy of the same saved Gang card (e.g.
  // two "Rebel Commando" gangs), each still costing its own 2 roster slots.
  // A card can also opt into the same behaviour by checking "Non-Unique" in
  // the Card Designer (e.g. a generic Rebel Commando or Scout Trooper Ally/
  // Follower, as opposed to a named individual) — isRepeatable covers both
  // cases. Everything else stays one-copy-only: once added, it drops out of
  // this picker like before.
  const addedCounts = {};
  rosterState.members.forEach(m => { addedCounts[m.cardId] = (addedCounts[m.cardId] || 0) + 1; });
  const searchText = colleagueSearchInput.value.trim().toLowerCase();
  const themeFilter = colleagueThemeFilterSelect.value;
  const affiliationFilter = colleagueAffiliationFilterSelect.value;
  const isRepeatable = (c) => c.formData?.cardType === 'Gang' || !!c.formData?.nonUnique;
  const available = cards.filter(c => {
    if (!isRepeatable(c) && addedCounts[c.id]) return false;
    if (searchText && !(c.formData?.name || '').toLowerCase().includes(searchText)) return false;
    if (themeFilter && (c.formData?.collection || '') !== themeFilter) return false;
    if (affiliationFilter && (c.formData?.affiliation || '') !== affiliationFilter) return false;
    return true;
  });
  if (!available.length) {
    const allAdded = cards.length && cards.every(c => !isRepeatable(c) && addedCounts[c.id]);
    colleaguePickerList.innerHTML = allAdded
      ? '<div class="library-empty">Every saved card is already on this roster (or you haven’t saved any yet in the Card Designer).</div>'
      : '<div class="library-empty">No cards match your search/Theme/Affiliation filter.</div>';
    return;
  }
  colleaguePickerList.innerHTML = available.map(c => {
    const repeatable = isRepeatable(c);
    const count = addedCounts[c.id] || 0;
    const slots = slotCostForType(c.formData?.cardType);
    return `
    <div class="library-item">
      <img class="library-item-thumb" src="${c.pngDataURL}" alt="">
      <div class="library-item-body">
        <span class="library-item-name">${escapeHtml(c.formData?.name || 'Unnamed')}</span><span class="library-item-level">${escapeHtml(c.formData?.cardType || 'Custom')}</span>
        <div class="library-item-text">${slots} roster slot${slots === 1 ? '' : 's'}${repeatable && count ? ` · ${count} already on this roster` : ''}</div>
      </div>
      <button type="button" class="library-add-btn" data-id="${escapeAttr(c.id)}" title="${repeatable ? 'Add another copy of this card to the roster' : 'Add to roster'}">+</button>
    </div>
  `;
  }).join('');

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

// Turns a Theme name into a safe filename fragment ("Star Wars" -> "star-wars").
function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---------------- Backup reminder banner ----------------
// Everything lives only in this browser's IndexedDB — there's no server
// copy. Export Backup is the only way out, but nothing used to prompt for
// it, so a cleared browser profile or a reinstall could silently wipe an
// entire card collection with no warning. This tracks when Export Backup
// was last actually used (localStorage — a single small timestamp, not
// worth a whole IndexedDB store for) and shows a dismissible banner once
// enough has changed since then to matter.
const LAST_BACKUP_KEY = 'pulp-alley-last-backup-at';
const BACKUP_NAG_THRESHOLD = 5;
const backupBanner = document.getElementById('backup-reminder-banner');
const backupBannerText = document.getElementById('backup-reminder-text');
let backupBannerDismissed = false; // this session only; re-evaluated on next load

function getLastBackupAt() {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  return raw ? +raw : 0;
}
function setLastBackupAt(ts) {
  try { localStorage.setItem(LAST_BACKUP_KEY, String(ts)); } catch { /* private-browsing etc. — banner just won't persist across reloads */ }
}

async function refreshBackupBanner() {
  if (backupBannerDismissed) { backupBanner.classList.add('hidden'); return; }
  const lastBackupAt = getLastBackupAt();
  const [cards, rosters] = await Promise.all([getAllCards(), getAllRosters()]);
  const changedCount = [...cards, ...rosters].filter(r => (r.updatedAt || 0) > lastBackupAt).length;
  if (changedCount < BACKUP_NAG_THRESHOLD) { backupBanner.classList.add('hidden'); return; }
  backupBannerText.textContent = lastBackupAt
    ? `${changedCount} cards/rosters changed since your last backup — everything only lives in this browser.`
    : `${changedCount} cards/rosters saved and no backup taken yet — everything only lives in this browser.`;
  backupBanner.classList.remove('hidden');
}

document.getElementById('backup-reminder-export').addEventListener('click', () => {
  document.getElementById('btn-export-backup').click();
});
document.getElementById('backup-reminder-dismiss').addEventListener('click', () => {
  backupBannerDismissed = true;
  backupBanner.classList.add('hidden');
});

document.getElementById('btn-export-backup').addEventListener('click', async () => {
  const themeFilter = backupThemeFilterSelect.value;
  const data = await exportAllData(themeFilter || undefined);
  if (!data.cards.length && !data.rosters.length) {
    alert(themeFilter
      ? `No cards found in the “${themeFilter}” Theme yet.`
      : 'Nothing saved yet — build and save a card or roster first.');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = localDateStamp(new Date(data.exportedAt));
  const themeSuffix = themeFilter ? `-${slugify(themeFilter)}` : '';
  const link = document.createElement('a');
  link.download = `pulp-alley-backup${themeSuffix}-${stamp}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  // A Theme-filtered export only covers part of the library (and drops
  // rosters entirely — see exportAllData in db.js), so it doesn't really
  // count as "backed up everything." Only a full export resets the clock.
  if (!themeFilter) {
    setLastBackupAt(data.exportedAt);
    refreshBackupBanner();
  }
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
    refreshBackupBanner();
    saveStatus.textContent = `Imported ${result.cardsImported} card(s) and ${result.rostersImported} roster(s).`;
    setTimeout(() => { saveStatus.textContent = ''; }, 4000);
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
});

// ---------------- Recently Deleted (undo for card/roster delete) ----------------
// Deleting a card or roster (My Cards / League Roster) now moves it to the
// trash store (trashCard()/trashRoster() in db.js) instead of hard-deleting
// it outright, so it can be restored here for up to TRASH_RETENTION_DAYS.
const trashModal = document.getElementById('trash-modal');
const trashListEl = document.getElementById('trash-list');
const trashCountBadge = document.getElementById('trash-count-badge');

function formatDaysAgo(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// Keeps the top-bar button's "(N)" badge current — called after every
// delete/restore/delete-forever/purge, not just when the modal is open, so
// the badge is accurate even if the user never opens it.
async function refreshTrashBadge() {
  const trash = await getAllTrash();
  trashCountBadge.textContent = trash.length ? `(${trash.length})` : '';
  return trash;
}

async function refreshTrashModal() {
  const trash = await refreshTrashBadge();
  if (!trash.length) {
    trashListEl.innerHTML = '<div class="library-empty">Nothing in Recently Deleted.</div>';
    return;
  }
  trashListEl.innerHTML = trash.map(entry => {
    const isCard = entry.kind === 'card';
    const name = isCard ? (entry.record.formData?.name || 'Unnamed') : (entry.record.name || 'Untitled Roster');
    const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - Math.floor((Date.now() - entry.deletedAt) / 86400000));
    const thumb = isCard
      ? `<img class="library-item-thumb" src="${entry.record.pngDataURL}" alt="">`
      : `<div class="library-item-thumb trash-roster-icon">🗂️</div>`;
    return `
      <div class="library-item" data-trash-id="${escapeAttr(entry.id)}">
        ${thumb}
        <div class="library-item-body">
          <span class="library-item-name">${escapeHtml(name)}</span><span class="library-item-level">${isCard ? 'Card' : 'Roster'}</span>
          <div class="library-item-text">Deleted ${formatDaysAgo(entry.deletedAt)} — ${daysLeft > 0 ? `auto-removes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'auto-removing soon'}</div>
        </div>
        <div class="library-item-actions">
          <button type="button" class="btn-secondary" data-trash-act="restore">Restore</button>
          <button type="button" class="btn-danger" data-trash-act="delete-forever">Delete Forever</button>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('btn-recently-deleted').addEventListener('click', async () => {
  await refreshTrashModal();
  trashModal.classList.remove('hidden');
});
document.getElementById('close-trash-modal').addEventListener('click', () => trashModal.classList.add('hidden'));
trashModal.addEventListener('click', (e) => { if (e.target === trashModal) trashModal.classList.add('hidden'); });

trashListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-trash-act]');
  if (!btn) return;
  const row = btn.closest('[data-trash-id]');
  const trashId = row.dataset.trashId;

  if (btn.dataset.trashAct === 'restore') {
    const kind = await restoreFromTrash(trashId);
    if (kind === 'card') { await refreshGallery(); getAllCards().then(refreshThemeOptions); }
    else if (kind === 'roster') { await refreshRosterTab(); }
    await refreshTrashModal();
    refreshBackupBanner();
  } else if (btn.dataset.trashAct === 'delete-forever') {
    const label = row.querySelector('.library-item-name').textContent;
    if (confirm(`Permanently delete “${label}”? This can't be undone.`)) {
      await removeFromTrash(trashId);
      await refreshTrashModal();
    }
  }
});

// ---------------- Quick Reference (Save as PDF) ----------------
// Draws its own two-page PDF from scratch with jsPDF (same library/
// approach as downloadRosterPDF above) rather than rasterizing the
// on-screen .qr-sheet markup — that keeps text crisp at any zoom and,
// more importantly, lets the content be hand-fit to exactly two pages, so
// "Save as PDF" always produces the same two-page file that prints on two
// sheets of A4 (page 1: turn sequence, health, and the core fight/shoot
// rules; page 2: Dodging, Modifiers, Splitting Dice, Cover, Bursts &
// Stealth — Core Rules p. 57-73). The on-screen tab and this function both
// transcribe the same source rules (Core Rules, Terms & Flow v1.2, and the
// official Action Sequence reference) independently — see the .qr-sheet
// markup in index.html for the on-screen version — so a future rules
// correction needs updating in both places, the same tradeoff already made
// between renderRosterPrintSheet/downloadRosterPDF/buildRosterPlainText
// above. jsPDF's built-in Helvetica font only supports WinAnsi encoding —
// arrows, the U+2212 minus sign, and >=/<= silently render as garbage
// instead of throwing — so every string drawn here sticks to ASCII (->,
// plain hyphen "-", "at least"/"over") even though the on-screen HTML
// version is free to use →/≥/− since browsers don't have that limitation.
function downloadQuickReferencePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297;
  const marginX = 14, marginTop = 18, marginBottom = 10, colGap = 8;
  const contentW = pageW - marginX * 2;
  const colW = (contentW - colGap) / 2;
  const colX = [marginX, marginX + colW + colGap];
  let y = [marginTop, marginTop];

  function mmPerLine(pt) { return pt * 1.15 / 72 * 25.4; }
  function ensureRoom(col, h) {
    // Content on each page is hand-fit to fit that page; this is a safety
    // net only (keeps drawing rather than throwing if a future edit runs
    // long) and intentionally does not add a page on its own — the two
    // pages this function draws are a deliberate, fixed split (see above),
    // not overflow-driven pagination.
    if (y[col] + h > pageH - marginBottom) return;
  }

  function pageHeader(sub) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PULP ALLEY — QUICK REFERENCE', marginX, marginTop - 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(sub, pageW - marginX, marginTop - 6, { align: 'right' });
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(marginX, marginTop - 3, pageW - marginX, marginTop - 3);
    doc.setLineWidth(0.2);
    doc.setTextColor(0, 0, 0);
  }

  function heading(col, text) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    ensureRoom(col, mmPerLine(9.5) + 3);
    doc.setTextColor(0, 0, 0);
    doc.text(text.toUpperCase(), colX[col], y[col]);
    y[col] += mmPerLine(9.5) - 1.5;
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.2);
    doc.line(colX[col], y[col], colX[col] + colW, y[col]);
    y[col] += 2.6;
  }

  function list(col, items, ordered) {
    doc.setTextColor(0, 0, 0);
    items.forEach((item, i) => {
      const isObj = typeof item === 'object';
      const text = isObj ? item.text : item;
      const marker = ordered ? `${i + 1}.` : '•';
      const markerW = ordered ? 5 : 3.5;
      const textX = colX[col] + markerW;
      const wrapW = colW - markerW;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(text, wrapW);
      const lh = mmPerLine(8);
      ensureRoom(col, lines.length * lh);
      doc.text(marker, colX[col], y[col]);
      doc.text(lines, textX, y[col]);
      y[col] += lines.length * lh + 0.6;
      if (isObj && item.sub) {
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        item.sub.forEach(sub => {
          const subLines = doc.splitTextToSize(`– ${sub}`, wrapW - 4);
          const slh = mmPerLine(7);
          ensureRoom(col, subLines.length * slh);
          doc.text(subLines, textX + 4, y[col]);
          y[col] += subLines.length * slh;
        });
        doc.setTextColor(0, 0, 0);
        y[col] += 0.6;
      }
    });
    y[col] += 2;
  }

  function callout(col, text, compact) {
    doc.setFont('helvetica', compact ? 'normal' : 'bold');
    doc.setFontSize(compact ? 7.3 : 8.5);
    const lines = doc.splitTextToSize(text, colW - 6);
    const lh = mmPerLine(compact ? 7.3 : 8.5);
    const boxH = lines.length * lh + 4.5;
    ensureRoom(col, boxH + 4.5);
    doc.setDrawColor(20, 160, 145);
    doc.setLineWidth(0.3);
    doc.setFillColor(230, 250, 247);
    doc.roundedRect(colX[col], y[col], colW, boxH, 1.5, 1.5, 'FD');
    doc.setTextColor(10, 90, 80);
    doc.text(lines, colX[col] + 3, y[col] + lh - 0.5);
    y[col] += boxH + 4.5;
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.2);
  }

  function note(col, text) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.3);
    doc.setTextColor(110, 110, 110);
    const lines = doc.splitTextToSize(text, colW);
    const lh = mmPerLine(7.3);
    ensureRoom(col, lines.length * lh);
    doc.text(lines, colX[col], y[col]);
    y[col] += lines.length * lh + 3.5;
    doc.setTextColor(0, 0, 0);
  }

  pageHeader('Page 1 of 2 — Turns, Health & Combat Basics');

  // ---- Column A: your turn — activation, movement, staying alive ----
  callout(0, 'Success is a 4+ on any die.');
  heading(0, 'Director');
  list(0, [
    'Decides which player Activates next.',
    'Changes if a player wins a combat — inflicts an Injury while suffering none — or collects a Plot Point.',
  ]);
  heading(0, 'Key Terms');
  list(0, [
    'Ready — a figure that hasn’t Activated yet.',
    'Activation — a Ready figure is selected to act.',
    'Active Player — whoever’s figure is currently Activated.',
    'Actions — Shoot, Brawl, or a Special Action (an Action ability, or a Challenge). Movement is NOT an Action.',
  ]);
  heading(0, 'Action Sequence — Direct & Act');
  list(0, [
    'Direct. The Director picks any player with a Ready figure — including themselves — to Activate one.',
    'Fortune Effects. Give other players a chance to play Fortune cards.',
    'Automatic Effects. Resolve anything that triggers on Activation — perilous areas, horror, and so on.',
    'Fight On. Already in contact with an enemy? You must fight immediately.',
    { text: 'Move. Up to 12".', sub: [
      'Move more than 6" and you forfeit any Special Action this Activation.',
      'May move past other figures, keeping 1" clearance.',
    ] },
    'Attack or Action. Moved into contact with an enemy? You must fight. Otherwise, if unengaged, you may Shoot or perform an Action.',
    'End of Activation. After a fight or an Action resolves, the Activation is over.',
  ], true);
  note(0, 'Repeat Direct & Act until no Ready figures remain — that ends the Turn.');

  heading(0, 'Health & Recovery');
  list(0, [
    'Health Status ladder: d10 -> d8 -> d6 -> Down -> Out.',
    'Any failed Health roll (however many) means Injured — drop one step on the ladder.',
    'In Cover: one failed Health roll may be rerolled.',
    'Down — can’t be targeted, ignored for movement.',
    'Recovery (end of Turn): each figure with Injuries rolls 1d6 — a 4+ improves Health one step (Down -> d6 -> d8 -> d10). Failed while Down = the figure is Out. Recovered from Down: may move 1" to Disengage.',
  ]);
  heading(0, 'Engagement & Dodge');
  list(0, [
    'Figures stay Engaged after a Brawl — across Turns — until one Disengages or either is Down.',
    'Disengage: choose Dodge and take no Hits this round -> move 1" away (from just that figure, if Engaged by several).',
    'Dodge is unaffected by multiple fights, but is affected by Fortune Cards or Injuries.',
  ]);

  // ---- Column B: resolving a fight — blocking, shooting, brawling, cards ----
  heading(1, 'Blocking Hits (Shooting & Brawling)');
  list(1, [
    'Shoot/Brawl back: the Active Player may block the non-Active player’s successful Hits, one-for-one, if their Hit die is >= the non-Active player’s Hit die.',
    'Dodge: the Non-Active Player may block the Active Player’s Hits, one-for-one, if the Dodge die is >= the Hit die.',
  ]);
  heading(1, 'Dice Modifiers, at a Glance');
  list(1, [
    'Moved more than 6" this Activation: -1 die to Shoot.',
    'Within 6" of the target: +1 die to Shoot.',
    'Each fight already resolved this Turn: -1 die to Shoot/Brawl (Veterans/Moxie ignore this, respectively).',
  ]);
  heading(1, 'Shooting Sequence');
  list(1, [
    'Must shoot the Nearest Unengaged Target (if only enemies are Engaged, you may shoot one of them).',
    { text: 'Determine Shoot Dice/Type — or choose Dodge instead.', sub: [
      '-1 die if you moved more than 6".',
      '+1 die if within 6".',
      '-1 die per fight already resolved this Turn (excluding Veterans).',
    ] },
    { text: 'Target chooses Shoot Back or Dodge.', sub: [
      'Shoot Back: +1 die within 6", -1 die per fight this Turn (excluding Veterans).',
      'Dodge: determine Dodge Dice/Type.',
    ] },
    'Block Hits one-for-one (see Blocking Hits, above).',
    'Roll a Health check for every unblocked Hit.',
  ], true);

  heading(1, 'Brawling Sequence');
  list(1, [
    'Rush toward the Nearest Target (Engaged targets may be ignored).',
    'Rushed more than 3"? Target may use Shoot dice; otherwise only Brawl or Dodge.',
    'Determine Brawl Dice/Type — -1 die per fight already this Turn (excluding Moxie).',
    'Target chooses Shoot, Brawl, or Dodge — same -1 die per fight this Turn (excluding Moxie).',
    'Block Hits one-for-one (see Blocking Hits, above).',
    'Chose Dodge and took no Hits this round? May Disengage 1".',
    'Roll a Health check for every unblocked Hit.',
    'Figures remain Engaged after the fight until Disengage or Down.',
  ], true);

  heading(1, 'Fortune Cards — Peril & Challenge');
  list(1, [
    'Peril: pass the card’s listed tests with the stated attribute, or use Dodge. Passed: no effect (Dodge still ends the Activation). Failed: take Hits equal to the card’s X value; Activation ends.',
    'Challenge: pass the listed tests with the stated attribute. Passed: complete. Failed: incomplete — remaining points carry over to next Turn.',
  ]);
  heading(1, 'Competitive Rolls');
  list(1, [
    'Each side rolls the required attribute and dice. Most successes wins; ties go to the defender.',
  ]);
  callout(1, 'At a glance: Success = 4+  ·  Movement isn’t an Action  ·  one Action ends your Activation  ·  Health ladder d10 -> d8 -> d6 -> Down -> Out  ·  Director changes on a clean combat win or a Plot Point.', true);

  // ---- Page 2: Dodging, Modifiers, Splitting Dice, Cover, Bursts & Stealth ----
  // Same hand-fit-to-one-page approach as page 1 above, just a second page —
  // still a single call to doc.save() below produces one PDF file with both
  // pages, same as the existing multi-page Print Sheet/Roster PDFs.
  doc.addPage();
  y = [marginTop, marginTop];
  pageHeader('Page 2 of 2 — Dodging, Modifiers, Splitting Dice, Cover, Bursts & Stealth');

  // ---- Column A: Dodging, Disengage, Modifiers, Defensive Fire, Splitting Dice ----
  heading(0, 'Dodging');
  list(0, [
    'Dodge can be used instead of Brawl or Shoot in any fight.',
    'Dodging a Peril: roll Dodge instead of the peril’s normal attribute. Pass: no Hits, Activation ends. Fail: take Hits equal to the challenge number, Activation ends.',
    'The attacker can Dodge too — a harrying attack or suppressive fire.',
  ]);

  heading(0, 'Disengage');
  list(0, [
    'Choosing Dodge and taking no Hits lets you move 1" away (Disengage) — also available when you Recover from Down.',
    'You must end at least 1" from every enemy. If that’s not possible, you can’t Disengage.',
    'Can’t move through another figure or a barrier while disengaging.',
    'Moving into a perilous or difficult area while disengaging doesn’t trigger a peril.',
    'Both sides disengaging from each other at once: the active character moves first.',
  ]);

  heading(0, 'Basic Modifiers');
  list(0, [
    'Close Range (target within 6"): +1 Shoot — always applies to Defensive Fire too.',
    'Long Range (target over 24" away): -1 Shoot.',
    'Multiple Fights: -1 Brawl and -1 Shoot per fight this character already resolved this Turn, regardless of which skill was used (Veterans/Moxie ignore this for Shoot/Brawl respectively).',
    'Moving Fast: -1 Shoot if you moved over 6" and shoot in the same Activation.',
  ]);

  heading(0, 'Defensive Fire');
  list(0, [
    'Rushed by an attacker who moved over 3"? You may use Shoot instead of just Brawl or Dodge.',
    'Defensive Fire always gets the Close Range +1, even if the attacker rushed from beyond 6".',
    'Not available if you’re already Engaged with another enemy.',
  ]);

  heading(0, 'Splitting Dice — Multiple Enemies');
  list(0, [
    'Rushing into, or activating already in contact with, more than one enemy: split your Brawl dice, at least 1 die per enemy, and resolve each fight in the order you choose.',
    'Shooting more than one target: split your Shoot dice the same way, starting with the nearest enemy — only that first target gets the Close Range bonus.',
    'Splitting your dice counts as ONE fight for the Multiple Fights penalty, however many targets you split against.',
    'Injured partway through resolving the split fights? The injury applies immediately and may drop your dice-type — or knock you down — before the rest resolve. Dodging and avoiding all Hits in a split fight lets you Disengage, cancelling any fights left.',
  ]);

  // ---- Column B: Cover, Shooting Engaged Characters, Bursts, Stealth ----
  heading(1, 'Cover Save');
  list(1, [
    'You’re in Cover if you’re in contact with terrain between you and the shooter — or on higher ground at least 3" above them.',
    'In Cover, you may re-roll 1 (only 1) failed Health die per Shootout.',
    'An obscuring area (smoke, foliage) also puts you in Cover if it fully crosses the line-of-sight to you — even without being in contact with it.',
  ]);

  heading(1, 'Shooting Engaged Characters');
  list(1, [
    'No unengaged enemy to target? You may shoot into a group of engaged characters — but never a group that includes a friendly.',
    'Resolved as an unopposed attack: apply your modifiers, roll, and assign each success as a Hit to a random character in the group. The target doesn’t roll.',
  ]);

  heading(1, 'Bursts');
  list(1, [
    'Placing a burst is an action and a special attack (not a fight) — needs an ability such as Burst Fire or Long Burst.',
    'Can’t place a burst’s edge within 1" of a friendly, or of an enemy Engaged with a friendly, or through a wall/barrier.',
    'Resolving: anyone in contact with the template draws one peril challenge immediately, then the burst is removed.',
    'Hold Fire: if nobody’s in contact when it’s placed, the burst stays in play as a trap — the first figure (friend or foe) to touch it triggers the peril, then it’s removed. It doesn’t block line-of-sight and isn’t otherwise perilous ground.',
    'A burst is also removed the instant its owner is injured or enters a fight; otherwise all bursts clear at the end of the Turn.',
  ]);

  heading(1, 'Stealth — Hide & Sneak');
  list(1, [
    'Hide (an action) only works while you’re out of every enemy’s line-of-sight — you become Hidden.',
    'Hidden figures don’t block line-of-sight or movement, and can’t be rushed, attacked, or targeted.',
    'Sneak: move up to 3" this Activation and stay Hidden. Move farther, take any action, or get spotted, and Hidden ends.',
  ]);

  heading(1, 'Spotting');
  list(1, [
    'Automatic opposed check whenever an enemy activates or moves within 12" of a Hidden figure who’d otherwise be in their line-of-sight — the searcher rolls Cunning, the Hidden figure rolls Finesse to stay hidden.',
    'Can’t re-roll a spotting check against the same figure more than once per Activation.',
  ]);

  heading(1, 'Ambush');
  list(1, [
    'A Hidden figure attacking (Shoot or Brawl) rolls a spotting check against the target first.',
    'Win it: the attack is unopposed. Knock the target Down/Out and you remain Hidden — otherwise you’re spotted.',
    'Lose it: you’re spotted immediately, and the attack resolves as a normal fight.',
  ]);

  callout(1, 'At a glance: Dodge always beats no roll at all  ·  Disengage needs 1" clear of every enemy  ·  Close Range +1 / Long Range -1 Shoot  ·  a burst resolves once, on contact  ·  Hidden can’t be targeted until spotted.', true);

  doc.save('pulp-alley-quick-reference.pdf');
}

document.getElementById('btn-qr-save-pdf').addEventListener('click', downloadQuickReferencePDF);

// ---------------- Init ----------------
document.fonts.ready.then(updatePreview);
updatePreview();
// Populate the Designer's Theme and Affiliation autocomplete (and both
// filter dropdowns for each) from whatever's already saved, so they're
// ready immediately rather than waiting for the user to first open My
// Cards or the roster's colleague picker.
getAllCards().then(cards => { refreshThemeOptions(cards); refreshAffiliationOptions(cards); });
// Sweep anything older than TRASH_RETENTION_DAYS out of Recently Deleted
// once per app load, then reflect whatever's left in the top-bar badge.
purgeOldTrash().then(refreshTrashBadge);
refreshBackupBanner();
