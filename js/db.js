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

export async function saveCard(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllCards() {
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

export async function getCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- Rosters ----------------
export async function saveRoster(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, 'readwrite');
    tx.objectStore(ROSTER_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRoster(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, 'readwrite');
    tx.objectStore(ROSTER_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllRosters() {
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

export async function getRoster(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROSTER_STORE, 'readonly');
    const req = tx.objectStore(ROSTER_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
