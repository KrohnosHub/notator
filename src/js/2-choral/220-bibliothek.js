// ── Bibliothek (In-Browser-Speicher via IndexedDB) ──────────────────
// Ergänzt gregSavePiece/gregLoadPiece (Datei-basiert, .notator-Download)
// um eine zweite, geräte-lokale Ablage direkt im Browser — wichtig für den
// GitHub-Pages-Betrieb, wo es kein lokales Dateisystem/keinen Server gibt.
// Liegt NUR in diesem einen Browser auf diesem einen Gerät (IndexedDB
// synchronisiert nicht zwischen Geräten/Browsern) — dafür gibt es
// Export/Import als JSON-Datei weiter unten.
const NOTATOR_LIB_DB_NAME = 'NotatorLibraryDB';
const NOTATOR_LIB_STORE = 'pieces';
let _gregLibDBPromise = null;

function gregLibOpenDB() {
  if (_gregLibDBPromise) return _gregLibDBPromise;
  _gregLibDBPromise = new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB wird von diesem Browser nicht unterstützt.')); return; }
    const req = indexedDB.open(NOTATOR_LIB_DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(NOTATOR_LIB_STORE)) {
        db.createObjectStore(NOTATOR_LIB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function(e) { reject(e.target.error || new Error('IndexedDB-Fehler')); };
  });
  return _gregLibDBPromise;
}

function gregLibTx(mode) {
  return gregLibOpenDB().then(function(db) {
    return db.transaction(NOTATOR_LIB_STORE, mode).objectStore(NOTATOR_LIB_STORE);
  });
}

function gregLibGet(id) {
  return gregLibTx('readonly').then(function(store) {
    return new Promise(function(resolve, reject) {
      const req = store.get(id);
      req.onsuccess = function(e) { resolve(e.target.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
}

function gregLibPut(record) {
  return gregLibTx('readwrite').then(function(store) {
    return new Promise(function(resolve, reject) {
      const req = store.put(record);
      req.onsuccess = function(e) { resolve(e.target.result); }; // returns the id
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
}

function gregLibDeleteEntry(id) {
  return gregLibTx('readwrite').then(function(store) {
    return new Promise(function(resolve, reject) {
      const req = store.delete(id);
      req.onsuccess = function() { resolve(); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
}

// Speichert das aktuell offene Stück in der Bibliothek. Wurde es zuvor
// schon aus der Bibliothek geladen bzw. dorthin gespeichert (gregLibCurrentId
// gesetzt), wird dieser Eintrag aktualisiert statt einen neuen anzulegen.
