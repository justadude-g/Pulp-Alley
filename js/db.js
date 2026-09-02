// db.js — tiny IndexedDB wrapper for saved cards + league rosters
const DB_NAME = 'pulp-alley-cards';
const DB_VERSION = 3;
const STORE = 'cards';
const ROSTER_STORE = 'rosters';
const TRASH_STORE = 'trash';
const TRASH_RETENTION_DAYS = 30;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(ROSTER_STORE)) {
        const rosterStore = db.createObjectStore(ROSTER_STORE, { keyPath: 'id' });
        rosterStore.createIndex('updatedAt', 'updatedAt');
      }
      // Holds deleted cards/rosters for TRASH_RETENTION_DAYS before they're
      // gone for good — see trashCard()/trashRoster() below. Keyed by
      // "<kind>:<originalId>" rather than the original record's own id, so
      // a card and a roster (separate id spaces) can never collide here.
      if (!db.objectStoreNames.contains(TRASH_STORE)) {
        const trashStore = db.createObjectStore(TRASH_STORE, { keyPath: 'id' });
        trashStore.createIndex('deletedAt', 'deletedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveCard(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllCards() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- Rosters ----------------
async function saveRoster(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, 'readwrite');
    tx.objectStore(ROSTER_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteRoster(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, 'readwrite');
    tx.objectStore(ROSTER_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllRosters() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, 'readonly');
    const req = tx.objectStore(ROSTER_STORE).getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getRoster(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, 'readonly');
    const req = tx.objectStore(ROSTER_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- Trash (undo-able delete) ----------------
// Deleting a card or roster used to be immediate and permanent — one
// confirm() dialog, then it's gone, with no recovery short of an old
// Export Backup (if one even exists). trashCard()/trashRoster() move the
// full record here instead of hard-deleting it, so it can be restored;
// purgeOldTrash() (called once at startup — see app.js init) sweeps out
// anything older than TRASH_RETENTION_DAYS for good, so the trash doesn't
// grow forever.
async function moveToTrash(kind, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRASH_STORE, 'readwrite');
    tx.objectStore(TRASH_STORE).put({
      id: `${kind}:${record.id}`,
      kind,
      recordId: record.id,
      deletedAt: Date.now(),
      record,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function trashCard(id) {
  const record = await getCard(id);
  if (!record) return false;
  await moveToTrash('card', record);
  await deleteCard(id);
  return true;
}

async function trashRoster(id) {
  const record = await getRoster(id);
  if (!record) return false;
  await moveToTrash('roster', record);
  await deleteRoster(id);
  return true;
}

async function getAllTrash() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRASH_STORE, 'readonly');
    const req = tx.objectStore(TRASH_STORE).getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function removeFromTrash(trashId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRASH_STORE, 'readwrite');
    tx.objectStore(TRASH_STORE).delete(trashId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Puts a trashed card/roster back in its original store (overwriting
// anything since re-saved under the same id) and removes it from the
// trash. Returns the restored record's kind ('card'|'roster') so the
// caller knows which view to refresh, or null if the trash entry was
// already gone (e.g. two tabs open, already restored/purged elsewhere).
async function restoreFromTrash(trashId) {
  const db = await openDB();
  const entry = await new Promise((resolve, reject) => {
    const tx = db.transaction(TRASH_STORE, 'readonly');
    const req = tx.objectStore(TRASH_STORE).get(trashId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!entry) return null;
  if (entry.kind === 'card') await saveCard(entry.record);
  else await saveRoster(entry.record);
  await removeFromTrash(trashId);
  return entry.kind;
}

// Permanently drops anything that's been sitting in the trash for more
// than TRASH_RETENTION_DAYS. Meant to run once per app load (a "roughly
// once a session" sweep is plenty — no need for a live timer). Returns how
// many entries were purged, for an optional status message.
async function purgeOldTrash() {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const all = await getAllTrash();
  const stale = all.filter(t => (t.deletedAt || 0) < cutoff);
  for (const t of stale) await removeFromTrash(t.id);
  return stale.length;
}

// ---------------- Backup (export / import) ----------------
// Everything lives in this browser's IndexedDB only (see README "Data &
// privacy") — there's no account or server sync. This is the escape hatch:
// bundle every saved card and roster (portrait images and card art are
// already embedded as data URLs on each record, so they come along for
// free) into one JSON file the user can download, then load back in later
// or on a different browser/device.
const BACKUP_APP_ID = 'pulp-alley-card-maker';
const BACKUP_SCHEMA_VERSION = 1;

// themeFilter, when given, limits the export to cards whose Theme
// (formData.collection) matches exactly, and drops rosters from the export
// entirely — a roster can mix colleagues from several Themes, so there's no
// single Theme a roster itself belongs to, and silently including every
// roster in a "Star Wars only" export would defeat the point of filtering
// (keeping a themed export small and self-contained). Leaving themeFilter
// unset exports everything, unchanged from before this option existed.
async function exportAllData(themeFilter) {
  const [allCards, allRosters] = await Promise.all([getAllCards(), getAllRosters()]);
  const cards = themeFilter
    ? allCards.filter(c => (c.formData?.collection || '') === themeFilter)
    : allCards;
  const rosters = themeFilter ? [] : allRosters;
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    themeFilter: themeFilter || null,
    cards,
    rosters,
  };
}

// Restores cards/rosters from a previously exported backup object. Existing
// records are matched by id: anything in the backup overwrites the local
// copy with the same id, but nothing already saved locally is deleted —
// this is a merge, not a wipe-and-replace.
async function importAllData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.cards) || !Array.isArray(data.rosters)) {
    throw new Error('This file doesn’t look like a Pulp Alley Card Maker backup.');
  }
  let cardsImported = 0;
  let rostersImported = 0;
  for (const card of data.cards) {
    if (!card || !card.id) continue;
    await saveCard(card);
    cardsImported++;
  }
  for (const roster of data.rosters) {
    if (!roster || !roster.id) continue;
    await saveRoster(roster);
    rostersImported++;
  }
  return { cardsImported, rostersImported };
}
