// db.js — tiny IndexedDB wrapper for saved cards + league rosters
const DB_NAME = 'pulp-alley-cards';
const DB_VERSION = 2;
const STORE = 'cards';
const ROSTER_STORE = 'rosters';

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

// ---------------- Backup (export / import) ----------------
// Everything lives in this browser's IndexedDB only (see README "Data &
// privacy") — there's no account or server sync. This is the escape hatch:
// bundle every saved card and roster (portrait images and card art are
// already embedded as data URLs on each record, so they come along for
// free) into one JSON file the user can download, then load back in later
// or on a different browser/device.
const BACKUP_APP_ID = 'pulp-alley-card-maker';
const BACKUP_SCHEMA_VERSION = 1;

async function exportAllData() {
  const [cards, rosters] = await Promise.all([getAllCards(), getAllRosters()]);
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
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
