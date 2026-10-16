/* Almacenamiento local (IndexedDB) para el modo offline del POS.
 *
 * Tres almacenes:
 *  - "catalog": copia del catálogo de productos (para vender sin internet).
 *  - "meta":    pares clave/valor (clientes, empresa, sucursal, etc.).
 *  - "pending": cola de ventas hechas offline, pendientes de sincronizar.
 */
const DB_NAME = "ferre-offline";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("catalog")) db.createObjectStore("catalog", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "offline_uuid" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out?._result !== undefined ? out._result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Catálogo -------------------------------------------------------------
export async function saveCatalog(products) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("catalog", "readwrite");
    const s = t.objectStore("catalog");
    s.clear();
    (products || []).forEach((p) => s.put(p));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function getCatalog() {
  const db = await openDB();
  return reqToPromise(db.transaction("catalog", "readonly").objectStore("catalog").getAll());
}

// ---- Meta (clave/valor) ---------------------------------------------------
export async function setMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("meta", "readwrite");
    t.objectStore("meta").put({ key, value });
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function getMeta(key) {
  const db = await openDB();
  const row = await reqToPromise(db.transaction("meta", "readonly").objectStore("meta").get(key));
  return row ? row.value : null;
}

// ---- Cola de ventas pendientes --------------------------------------------
export async function addPending(sale) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("pending", "readwrite");
    t.objectStore("pending").put(sale);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function getPending() {
  const db = await openDB();
  const rows = await reqToPromise(db.transaction("pending", "readonly").objectStore("pending").getAll());
  return (rows || []).sort((a, b) => (a.created_ms || 0) - (b.created_ms || 0));
}

export async function removePending(uuid) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("pending", "readwrite");
    t.objectStore("pending").delete(uuid);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function countPending() {
  const rows = await getPending();
  return rows.length;
}
