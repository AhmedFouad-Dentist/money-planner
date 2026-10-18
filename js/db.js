// Minimal IndexedDB key/value store. Two records are kept:
//   meta  — unencrypted: salt, PIN attempt counter, language/theme for the lock screen
//   vault — the whole app state, encrypted with AES-GCM ({ iv, ct })

const DB_NAME = 'money-planner';
const STORE = 'kv';
let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const dbGet = (key) => tx('readonly', (s) => s.get(key));
export const dbSet = (key, value) => tx('readwrite', (s) => s.put(value, key));
// Writes several records in one transaction (all or nothing).
export const dbSetMany = (entries) =>
  tx('readwrite', (s) => {
    let last;
    for (const [k, v] of Object.entries(entries)) last = s.put(v, k);
    return last;
  });
export const dbClear = () => tx('readwrite', (s) => s.clear());

export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isPersisted() {
  try {
    return (await navigator.storage?.persisted?.()) ?? null;
  } catch {
    return null;
  }
}
