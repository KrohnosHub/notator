// ── Google-Drive-Ablage (Hauptablage der Bibliothek) ───────────────
// Gesänge liegen als .notator-Dateien in Drive (Liturgie / Notator). Die
// IndexedDB-Bibliothek dient nur noch als Offline-Kopie/Zwischenspeicher:
// Einträge mit pending=true sind lokal neuer als in Drive und werden beim
// nächsten Öffnen der Bibliothek (mit Anmeldung) automatisch hochgeladen.
// Anmeldung: Google Identity Services (OAuth-Token-Client, nur im Browser,
// kein Server). Bereich "drive", weil der Zielordner nicht von Notator
// selbst angelegt wurde (mit "drive.file" wäre er unsichtbar).
const NOTATOR_GDRIVE_FOLDER_ID = '144wHwMFQUFhNxcpun6CO9fXtewhFcLe3';
const NOTATOR_GOOGLE_CLIENT_ID = '689606502893-na74rng5bet9477m4pkuvpmdvtcl7aug.apps.googleusercontent.com';
const GD_SCOPE = 'https://www.googleapis.com/auth/drive';
const GD_TOKEN_KEY = 'notatorGdToken';
// Token (gültig ca. 1 h) in localStorage, damit er Tab-/App-Wechsel (z. B. Link aus
// dem Schola-Planer) überlebt; sessionStorage nur als Ausweichlösung.
const GD_HINT_KEY = 'notatorGdHint';

function gdClientId() {
  let ls = '';
  try { ls = localStorage.getItem('notatorGoogleClientId') || ''; } catch (e) {}
  return (NOTATOR_GOOGLE_CLIENT_ID || ls || '').trim();
}
function gdConfigured() { return !!gdClientId(); }

/* gd-core:begin – NICHT HIER BEARBEITEN: Quelle shared/gd-core.js, übernehmen mit python3 tools/gd-core-sync.py */
/* gd-core v1 – gemeinsamer Google-Drive-Kern für Notator und Schola-Planer.
   QUELLE: KrohnosHub/notator, shared/gd-core.js. Nur dort bearbeiten, dann:
     Notator:      python3 tools/gd-core-sync.py        (schreibt den Block in index.html)
     Schola-Planer: src/gd-core.js durch diese Datei ersetzen, python3 build.py
   Beide Apps laufen auf krohnoshub.github.io und teilen Token und Konto-Hinweis
   (gleiche Schlüssel im localStorage): eine Anmeldung gilt für beide.
   Meldungstexte nicht ändern, ohne die Apps zu prüfen: dort wird auf
   «abgelaufen», «Nicht bei Google» und «Drive-Fehler <Status>» geprüft. */
function gdCoreCreate(o) {
  const TK = o.tokenKey, HK = o.hintKey;
  let client = null, clientId = '', gis = null, pending = null;
  const read = () => {
    for (const st of ['localStorage', 'sessionStorage']) {
      try { const t = JSON.parse(window[st].getItem(TK) || 'null'); if (t && t.token) return t; } catch (e) {}
    }
    return null;
  };
  // Gültiger Token (noch mind. 1 Min.) oder null
  const cached = () => { const t = read(); return t && t.exp > Date.now() + 60000 ? t.token : null; };
  // Restlaufzeit in ms (-1: kein Token)
  const expiresIn = () => { const t = read(); return t ? t.exp - Date.now() : -1; };
  const hint = () => { try { return localStorage.getItem(HK) || ''; } catch (e) { return ''; } };
  const clear = () => { for (const st of ['localStorage', 'sessionStorage']) { try { window[st].removeItem(TK); } catch (e) {} } };
  function store(token, expiresInSec) {
    const v = JSON.stringify({ token, exp: Date.now() + (expiresInSec || 3600) * 1000 });
    try { localStorage.setItem(TK, v); } catch (e) { try { sessionStorage.setItem(TK, v); } catch (e2) {} }
    // Konto merken: beim nächsten Mal ohne Kontoauswahl (und evtl. still) anmelden
    try { localStorage.setItem(HK, localStorage.getItem(HK) || '1'); } catch (e) {}
    fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && j.user && j.user.emailAddress) { try { localStorage.setItem(HK, j.user.emailAddress); } catch (e) {} } })
      .catch(() => {});
  }
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gis) return gis;
    gis = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gis = null; reject(new Error('Google-Anmeldung nicht erreichbar (offline?)')); };
      document.head.appendChild(s);
    });
    return gis;
  }
  // interactive: darf ein Google-Fenster öffnen (nur aus einer Nutzeraktion heraus).
  // opts.silent: ohne Kontoauswahl/Rückfrage (prompt 'none', kurze Wartezeit).
  // opts.force: gespeicherten Token nicht verwenden, sondern erneuern – der alte
  //   bleibt bis zum Erfolg gespeichert (andere Tabs/Apps sehen nie «abgemeldet»).
  function token(interactive, opts) {
    opts = opts || {};
    if (!opts.force) { const c = cached(); if (c) return Promise.resolve(c); }
    if (!interactive) return Promise.reject(new Error('Nicht bei Google angemeldet'));
    const cid = String(o.clientId() || '').trim();
    if (!cid) return Promise.reject(new Error('Google Drive ist noch nicht eingerichtet (Client-ID fehlt)'));
    if (pending) return pending; // laufende Anmeldung teilen
    const p = loadGis().then(() => new Promise((resolve, reject) => {
      if (!client || clientId !== cid) {
        const cfg = { client_id: cid, scope: o.scope, callback: () => {} };
        const h = hint(); if (h.indexOf('@') > 0) cfg.hint = h;
        client = google.accounts.oauth2.initTokenClient(cfg); clientId = cid;
      }
      client.callback = r => {
        if (r.error) { reject(new Error('Google-Anmeldung: ' + r.error)); return; }
        store(r.access_token, r.expires_in); resolve(r.access_token);
      };
      client.error_callback = e => reject(new Error('Google-Anmeldung abgebrochen' + (e && e.type ? ' (' + e.type + ')' : '')));
      client.requestAccessToken({ prompt: opts.silent ? 'none' : '' });
      setTimeout(() => reject(new Error('Google-Anmeldung: keine Antwort (Popup blockiert?)')), opts.silent ? 12000 : 90000);
    }));
    pending = p;
    const done = () => { if (pending === p) pending = null; };
    p.then(done, done);
    return p;
  }
  // fetch mit Token; 401 → Token löschen, sonst Fehler mit Status und Textanfang
  function api(url, opts, interactive) {
    return token(interactive).then(t => {
      const op = Object.assign({}, opts || {});
      op.headers = Object.assign({}, op.headers || {}, { Authorization: 'Bearer ' + t });
      return fetch(url, op).then(r => {
        if (r.status === 401) { clear(); throw new Error('Google-Anmeldung abgelaufen – bitte neu anmelden'); }
        if (!r.ok) return r.text().then(tx => { throw new Error('Drive-Fehler ' + r.status + ': ' + tx.slice(0, 160)); });
        return r;
      });
    });
  }
  // Nach geänderter Client-ID: Google-Client neu aufbauen
  const reset = () => { client = null; clientId = ''; };
  return { cached, expiresIn, hint, clear, store, loadGis, token, fetch: api, reset };
}
/* gd-core:end */
const GD = gdCoreCreate({ clientId: gdClientId, scope: GD_SCOPE, tokenKey: GD_TOKEN_KEY, hintKey: GD_HINT_KEY });

function gdLoadGis() { return GD.loadGis(); }
function gdCachedToken() { return GD.cached(); }
function gdHasToken() { return !!GD.cached(); }
function gdClearToken() { GD.clear(); }
function gdStoreToken(token, expiresIn) { GD.store(token, expiresIn); }
function gdTokenExpiresIn() { return GD.expiresIn(); }
// interactive=true: darf ein Google-Anmeldefenster öffnen (nur aus einem
// Klick heraus aufrufen, sonst blockiert der Browser das Popup).
function gdGetToken(interactive) { return GD.token(interactive); }
function gdFetch(url, opts, interactive) { return GD.fetch(url, opts, interactive); }

// Ohne Klick versuchen (nur wenn schon früher verbunden): liefert Token oder null
function gdTrySilent() {
  const c = GD.cached(); if (c) return Promise.resolve(c);
  if (!GD.hint() || !gdConfigured()) return Promise.resolve(null);
  return Promise.race([GD.token(true).catch(() => null), new Promise(r => setTimeout(() => r(null), 6000))]);
}

// Automatische Anmeldung (Nutzerwunsch 2026-10-16): War Notator schon einmal
// mit Google Drive verbunden, wird der Zugang ohne eigenen Klick erneuert –
// beim Start sofort, falls der gespeicherte Zugang noch gilt, sonst bei der
// ersten Berührung/dem ersten Klick irgendwo in der App (Browser erlauben das
// kurze Google-Fenster nur nach einer Nutzeraktion; es schliesst sich von
// selbst, ohne Kontoauswahl). Läuft der Zugang (ca. 1 h) bald ab, wird er bei
// der nächsten Aktion ebenso still erneuert.
let _gdAutoBusy = false;
function gdAutoConnectInit() {
  if (!GD.hint() || !gdConfigured()) return; // noch nie verbunden: erst über die Bibliothek anmelden
  GD.loadGis().catch(() => {}); // Google-Skript schon laden, damit die Erneuerung im Klick sofort geht
  const onAct = () => {
    if (_gdAutoBusy || !navigator.onLine) return;
    if (GD.expiresIn() > 10 * 60000) return; // noch mind. 10 Min. gültig
    if (!(window.google && google.accounts && google.accounts.oauth2)) { GD.loadGis().catch(() => {}); return; }
    _gdAutoBusy = true;
    // force: erneuern, ohne den alten Token vorher zu löschen (Schola-Planer im anderen Tab bleibt angemeldet)
    GD.token(true, { force: true }).then(() => { gregGst('Mit Google Drive verbunden.'); })
      .catch(() => {}) // alter Zugang gilt evtl. noch
      .finally(() => { _gdAutoBusy = false; });
  };
  document.addEventListener('pointerdown', onAct, true);
}
setTimeout(() => { try { gdAutoConnectInit(); } catch (e) {} }, 800);

function gdList(interactive) {
  const q = encodeURIComponent("'" + NOTATOR_GDRIVE_FOLDER_ID + "' in parents and trashed = false and name contains '.notator'");
  return gdFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&orderBy=modifiedTime desc&pageSize=1000&fields=files(id,name,modifiedTime,appProperties)', {}, interactive)
    .then(r => r.json()).then(j => (j.files || []).filter(f => /\.notator$/i.test(f.name)));
}

function gdDownload(id, interactive) {
  return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media', {}, interactive).then(r => r.json());
}

// Legt an (id leer) oder überschreibt (id gesetzt); liefert die Datei-ID.
function gdUpload(name, stateObj, id, interactive, untrash) {
  const meta = id ? { name } : { name, parents: [NOTATOR_GDRIVE_FOLDER_ID], mimeType: 'application/json' };
  if (id && untrash) meta.trashed = false; // explizites Speichern eines gelöschten Stücks holt es aus dem Papierkorb
  if (stateObj && stateObj.meta && typeof ntMetaToAppProps === 'function') meta.appProperties = ntMetaToAppProps(stateObj.meta);
  const boundary = 'notator' + Date.now();
  const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(stateObj, null, 2) + '\r\n--' + boundary + '--';
  const url = 'https://www.googleapis.com/upload/drive/v3/files' + (id ? '/' + encodeURIComponent(id) : '') + '?uploadType=multipart&fields=id,name,modifiedTime';
  return gdFetch(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }, interactive)
    .then(r => r.json()).then(j => j.id);
}

function gdRename(id, name, interactive) {
  return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }, interactive);
}
// "Löschen" = in den Drive-Papierkorb (dort 30 Tage wiederherstellbar)
function gdUntrash(id, interactive) {
  return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: false }) }, interactive);
}
// Status einer Drive-Datei: 'ok' | 'trashed' | 'gone' (gelöscht/kein Zugriff) | 'unknown'
function gdFileStatus(id) {
  return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,trashed', {}, false)
    .then(r => r.json()).then(j => j && j.trashed ? 'trashed' : 'ok')
    .catch(err => /\b(404|403)\b/.test(err.message || '') ? 'gone' : 'unknown');
}
// Markierung «gelöscht» für das gerade offene Stück (Titel rot + 🗑)
function ntTrashMarkTitles() {
  const on = !!window._ntTrashedOpen;
  ['greg-mobile-title', 'cl-vb-title'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const base = el.textContent.replace(/^🗑 (gelöscht · )?/, '');
    el.textContent = on ? '🗑 gelöscht · ' + base : base;
    el.style.color = on ? '#ff6b6b' : '#c0d890';
    el.style.fontWeight = on ? '600' : '';
    if (on) el.title = 'Dieses Stück liegt im Google-Drive-Papierkorb. Speichern holt es zurück.';
  });
  const t = document.getElementById('greg-title');
  if (t) { t.style.color = on ? '#ff6b6b' : '#c0d890'; t.title = on ? 'Stück liegt im Drive-Papierkorb' : ''; }
}
function ntSetTrashedOpen(on) { window._ntTrashedOpen = !!on; ntTrashMarkTitles(); }
function ntTrashedWarn(file, rec) {
  showModal('🗑 Gelöschtes Stück', '«' + gdTitleFromName(file.name || '') + '» liegt im Google-Drive-Papierkorb (gelöscht). Der Link ist vermutlich veraltet. Du siehst die gelöschte Fassung – sie erscheint nicht in der Bibliothek.', [
    { label: '↺ Wiederherstellen (aus Papierkorb holen)', fn: () => { closeModal(); gdUntrash(file.id, true).then(() => {
        ntSetTrashedOpen(false); if (rec) { rec.driveGone = false; gregLibPut(rec).catch(() => {}); }
        gregGst('Wiederhergestellt – das Stück ist wieder in der Bibliothek.'); }).catch(err => gregGst('Wiederherstellen fehlgeschlagen: ' + err.message)); } },
    { label: '📂 Bibliothek öffnen', fn: () => { closeModal(); gregLibShowModal(); } },
    { label: 'Trotzdem ansehen', fn: closeModal }
  ]);
}
function gdTrash(id, interactive) {
  return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }, interactive);
}

function gdFileName(title) {
  return (String(title || 'Unbenanntes Stück').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'Unbenanntes Stück') + '.notator';
}
function gdTitleFromName(name) { return String(name || '').replace(/\.notator$/i, ''); }

function gdSetupDialog() {
  const cur = gdClientId();
  const v = prompt('Google-Client-ID für Notator eingeben (aus der Google Cloud Console, endet auf .apps.googleusercontent.com).\nWird nur in diesem Browser gespeichert.', cur);
  if (v === null) return;
  try { localStorage.setItem('notatorGoogleClientId', v.trim()); } catch (e) {}
  GD.reset();
  gdClearToken();
  gregLibShowModal();
}

function gregLibAll() {
  return gregLibTx('readonly').then(function(store) {
    return new Promise(function(resolve, reject) {
      const out = [];
      const req = store.openCursor();
      req.onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) { out.push(cursor.value); cursor.continue(); }
        else resolve(out);
      };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
}

function gregLibList() {
  return gregLibAll().then(function(all) {
    const out = all.map(function(v) { return { id: v.id, title: v.title, savedAt: v.savedAt, updatedAt: v.updatedAt, driveId: v.driveId || null, pending: !!v.pending, driveGone: !!v.driveGone, meta: (v.state && v.state.meta) || null }; });
    out.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return out;
  });
}

function gregLibFindByDriveId(driveId) {
  return gregLibAll().then(function(all) { return all.find(function(r) { return r.driveId === driveId; }) || null; });
}

// Lädt einen lokalen Eintrag nach Drive hoch (neu oder Überschreiben) und
// markiert ihn als synchron. interactive: darf das Anmeldefenster öffnen.
function gregLibPushToDrive(rec, interactive) {
  const doUpload = function(targetId) {
    return gdUpload(gdFileName(rec.title), rec.state, targetId, interactive, !!rec._untrash).then(function(newId) {
      if (rec._untrash) { delete rec._untrash; rec.driveGone = false; if (gregLibCurrentId === rec.id) ntSetTrashedOpen(false); }
      rec.driveId = newId; rec.pending = false;
      return gregLibPut(rec).then(function() { return rec; });
    });
  };
  if (rec.driveId) return doUpload(rec.driveId);
  // Neu: gleichnamige Datei im Drive-Ordner? -> überschreiben nur nach Rückfrage
  return gdList(interactive).then(function(files) {
    const same = files.find(function(f) { return f.name.toLowerCase() === gdFileName(rec.title).toLowerCase(); });
    if (same) {
      if (confirm('In Google Drive gibt es bereits "' + same.name + '". Überschreiben?\n(Abbrechen = als neue Datei mit Zusatz speichern)')) return doUpload(same.id);
      rec.title = rec.title + ' (' + new Date().toLocaleDateString('de-CH') + ')';
    }
    return doUpload(null);
  });
}

// Speichert das aktuell offene Stück: zuerst lokal (Offline-Kopie), dann in
// Google Drive. Wurde es schon aus der Bibliothek geladen bzw. dorthin
// gespeichert (gregLibCurrentId), wird derselbe Eintrag/dieselbe Datei
// aktualisiert.
// Gibt ein Promise zurück: true, sobald lokal in der Bibliothek gespeichert
// (Drive-Upload läuft im Hintergrund weiter), false bei Abbruch/Fehler.
function gregLibSaveCurrent() {
  let _done; const done = new Promise(r => { _done = r; });
  const state = gregBuildStateObject();
  // Neue Stücke gleich einordnen (nur leere Felder)
  try {
    const c = ntAutoClassify(state.title || '', ntCurrentIncipit(), (typeof gregHdrExtra !== 'undefined' ? gregHdrExtra : '') + '\n' + ((state.sections || []).map(x => x.hdrExtra || '').join('\n')));
    const m = ntMetaNorm(state.meta);
    if (!m.season && c.season) m.season = c.season;
    if (!m.genre && c.genre) m.genre = c.genre;
    if (m.season === c.season) c.tags.forEach(t => { if (m.tags.indexOf(t) < 0) m.tags.push(t); });
    state.meta = m; gregMeta = Object.assign({}, m);
  } catch (e) {}
  const now = Date.now();
  const finish = function(base) {
    const record = Object.assign({}, base || {}, { updatedAt: now, state: state, pending: true });
    if (window._ntTrashedOpen && record.driveId) record._untrash = true;
    if (!record.savedAt) record.savedAt = now;
    gregLibPut(record).then(function(newId) {
      record.id = newId;
      gregLibCurrentId = newId;
      ntMarkClean(state);
      _done(true);
      if (!gdConfigured()) {
        gregGst('In Bibliothek gespeichert (nur lokal – Google Drive noch nicht eingerichtet): "' + record.title + '"');
        if (document.getElementById('modal-bg').classList.contains('open')) gregLibShowModal();
        return;
      }
      gregGst('Speichere "' + record.title + '" in Google Drive …');
      gregLibPushToDrive(record, true).then(function() {
        gregGst('In Google Drive gespeichert: "' + gdFileName(record.title) + '"');
        if (document.getElementById('modal-bg').classList.contains('open')) gregLibShowModal();
      }).catch(function(err) {
        gregGst('Lokal gespeichert, Drive-Upload fehlgeschlagen (' + err.message + ') – wird beim nächsten Öffnen der Bibliothek nachgeholt.');
        if (document.getElementById('modal-bg').classList.contains('open')) gregLibShowModal();
      });
    }).catch(function(err) { gregGst('Bibliothek-Speicherfehler: ' + err.message); _done(false); });
  };
  if (gregLibCurrentId != null) {
    gregLibGet(gregLibCurrentId).then(function(existing) {
      if (existing) { finish(existing); return; }
      const t = prompt('Titel für die Bibliothek:', ntPieceTitle(state));
      if (t === null) { _done(false); return; }
      finish({ title: t.trim() || 'Unbenanntes Stück' });
    }).catch(function() { _done(false); });
  } else {
    const title = prompt('Titel für die Bibliothek:', ntPieceTitle(state));
    if (title === null) { _done(false); return done; } // abgebrochen
    finish({ title: title.trim() || 'Unbenanntes Stück' });
  }
  return done;
}

// «Speichern unter»: als NEUER Bibliothekseintrag / neue Drive-Datei; das Original bleibt
// unverändert. Danach arbeitet man in der neuen Datei weiter.
function gregLibSaveAs() {
  const cur = gregLibCurrentId;
  const p = cur != null ? gregLibGet(cur).catch(() => null) : Promise.resolve(null);
  return p.then(rec => {
    const base = (rec && rec.title) || ((document.getElementById('greg-title') || {}).value || '').trim() || 'Unbenanntes Stück';
    const t = prompt('Speichern unter – neuer Name:', base + ' (Kopie)');
    if (t === null || !t.trim()) return false;
    return gregLibSaveAsName(t.trim());
  });
}
function gregLibSaveAsName(name) {
  const cur = gregLibCurrentId;
  const p = cur != null ? gregLibGet(cur).catch(() => null) : Promise.resolve(null);
  return p.then(rec => {
    if (rec && name.toLowerCase() === String(rec.title || '').toLowerCase()) { gregGst('Gleicher Name wie das Original – dafür «Speichern» verwenden.'); return false; }
    const origPrompt = window.prompt;
    window.prompt = () => name; // gregLibSaveCurrent fragt bei neuem Eintrag nach dem Titel
    gregLibCurrentId = null;
    let res;
    try { res = gregLibSaveCurrent(); } finally { window.prompt = origPrompt; }
    return Promise.resolve(res).then(ok => {
      if (!ok) { gregLibCurrentId = cur; return false; }
      if (typeof ntSetTrashedOpen === 'function') ntSetTrashedOpen(false);
      gregGst('Gespeichert unter «' + name + '» – du arbeitest jetzt in dieser Datei; das Original ist unverändert.');
      return true;
    });
  });
}

// «Neu»: leeres Stück (alle Abschnitte, Orgel-Standard). Ungespeicherte
// Änderungen: Rückfrage, auf Wunsch zuerst in die Bibliothek sichern.
function ntNewPiece() {
  const go = () => {
    if (window._ntTab !== 'greg') switchTab('greg');
    gregCollapseSections(); window._gregPageW = null; gregClear();
    if (typeof gregMeta !== 'undefined') gregMeta = {};
    if (typeof clState !== 'undefined') { clState = {}; clNormalizeState(); clUndoReset(); }
    gregLibCurrentId = null; ntSetTrashedOpen(false);
    try { if (location.hash) history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    ntMarkClean();
    gregGst('Neues, leeres Stück');
  };
  if (window._ntMappeBusy || !ntIsDirty()) { go(); return; }
  showModal('⚠️ Ungespeicherte Änderungen', 'Das offene Stück hat Änderungen, die noch nicht gespeichert sind. Vor dem neuen Stück in der Bibliothek sichern?', [
    { label: '💾 Speichern und neu', fn: () => { closeModal(); gregLibSaveCurrent().then(ok => { if (ok) go(); else gregGst('Nicht gespeichert – neues Stück abgebrochen.'); }); } },
    { label: 'Ohne Speichern neu', fn: () => { closeModal(); go(); } },
    { label: 'Abbrechen', fn: () => closeModal() }
  ]);
}

function gregLibApplyRecord(rec, sourceLabel, trashed) {
  gregPush(); // Undo zurück zum vorherigen Stand erlauben
  gregApplyLoadedState(rec.state);
  window._ntTrashedOpen = !!(trashed || rec.driveGone);
  gregLibCurrentId = rec.id;
  gregRefreshList();
  closeModal();
  if (typeof gregMobileSetEditMode === 'function' && gregIsMobileViewport()) gregMobileSetEditMode(false); // Handy: frisch geladenes Stück erst in der Ansicht zeigen
  gregGst('Geladen (' + sourceLabel + '): "' + rec.title + '"');
  ntTrashMarkTitles();
  setTimeout(ntGpOffer, 900);
  ntMarkClean();
  gregScheduleAutosave();
}

function gregLibLoadEntry(id, _ok) {
  if (!_ok && ntIsDirty()) { ntConfirmDiscard().then(ok => { if (ok) gregLibLoadEntry(id, true); }); return; }
  gregLibGet(id).then(function(rec) {
    if (!rec) { gregGst('Eintrag nicht gefunden (evtl. gelöscht).'); return; }
    gregLibApplyRecord(rec, rec.pending ? 'lokale Kopie, noch nicht in Drive' : 'lokale Kopie');
  }).catch(function(err) { gregGst('Ladefehler: ' + err.message); });
}

// Öffnet eine Drive-Datei; aktualisiert/erstellt dabei die lokale Kopie.
// Hat die lokale Kopie ungespeicherte (pending) Änderungen, wird nachgefragt.
function gregLibLoadDrive(file, onFail, _ok) {
  if (!_ok && ntIsDirty()) { return ntConfirmDiscard().then(ok => { if (ok) return gregLibLoadDrive(file, onFail, true); }); }
  gregGst('Lade "' + file.name + '" aus Google Drive …');
  return Promise.all([gdDownload(file.id, true), gregLibFindByDriveId(file.id), gdFileStatus(file.id)]).then(function(res) {
    const state = res[0], local = res[1], trashed = res[2] === 'trashed';
    if (!state || !state.entries && !state.sections) throw new Error('keine gültige Notator-Datei');
    if (local && local.pending && !confirm('Die lokale Kopie von "' + local.title + '" enthält Änderungen, die noch nicht in Drive sind.\nOK = Drive-Version laden (lokale Änderungen verwerfen), Abbrechen = lokale Version laden.')) {
      gregLibApplyRecord(local, 'lokale Kopie'); return;
    }
    if (file.appProperties) state.meta = Object.assign(ntMetaFromAppProps(file.appProperties), { txt: (state.meta && state.meta.txt) || file.appProperties.txt || '' });
    const rec = Object.assign({}, local || {}, { title: gdTitleFromName(file.name), state: state, driveId: file.id, pending: false, updatedAt: Date.parse(file.modifiedTime) || Date.now(), driveGone: trashed });
    if (!rec.savedAt) rec.savedAt = rec.updatedAt;
    return gregLibPut(rec).then(function(id) { rec.id = id; gregLibApplyRecord(rec, trashed ? 'Google Drive – Papierkorb' : 'Google Drive', trashed);
      if (trashed) ntTrashedWarn(file, rec); });
  }).catch(function(err) { gregGst('Drive-Ladefehler: ' + err.message); if (onFail) onFail(err); });
}

function gregLibRenameEntry(id, currentTitle) {
  const title = prompt('Neuer Titel:', currentTitle);
  if (title === null || !title.trim()) return;
  gregLibGet(id).then(function(rec) {
    if (!rec) return;
    rec.title = title.trim();
    rec.updatedAt = Date.now();
    return gregLibPut(rec).then(function() {
      if (rec.driveId && gdConfigured()) return gdRename(rec.driveId, gdFileName(rec.title), true);
    });
  }).then(function() { gregLibShowModal(); }).catch(function(err) { gregGst('Fehler: ' + err.message); gregLibShowModal(); });
}

function gregLibRenameDrive(file) {
  const title = prompt('Neuer Titel:', gdTitleFromName(file.name));
  if (title === null || !title.trim()) return;
  gdRename(file.id, gdFileName(title), true).then(function() {
    return gregLibFindByDriveId(file.id).then(function(local) { if (local) { local.title = title.trim(); return gregLibPut(local); } });
  }).then(function() { gregLibShowModal(); }).catch(function(err) { gregGst('Fehler: ' + err.message); });
}

function gregLibDeleteEntryConfirm(id, title) {
  if (!confirm('Lokale Kopie von "' + title + '" löschen?')) return;
  gregLibDeleteEntry(id).then(function() {
    if (gregLibCurrentId === id) gregLibCurrentId = null;
    gregLibShowModal();
  }).catch(function(err) { gregGst('Löschfehler: ' + err.message); });
}

function gregLibDeleteDrive(file) {
  if (!confirm('"' + file.name + '" in Google Drive löschen?\n(Die Datei kommt in den Drive-Papierkorb und ist dort 30 Tage wiederherstellbar.)')) return;
  gdTrash(file.id, true).then(function() {
    return gregLibFindByDriveId(file.id).then(function(local) {
      if (local) { if (gregLibCurrentId === local.id) gregLibCurrentId = null; return gregLibDeleteEntry(local.id); }
    });
  }).then(function() { gregLibShowModal(); }).catch(function(err) { gregGst('Löschfehler: ' + err.message); });
}

// Alle lokal geänderten (pending) Einträge nach Drive hochladen
function gregLibSyncPending(interactive) {
  return gregLibAll().then(function(all) {
    const pend = all.filter(function(r) { return (r.pending || !r.driveId) && r.state; }); // inkl. ältere, rein lokale Einträge (vor Drive-Anbindung)
    let ok = 0;
    return pend.reduce(function(p, rec) {
      return p.then(function() { return gregLibPushToDrive(rec, interactive).then(function() { ok++; }).catch(function() {}); });
    }, Promise.resolve()).then(function() { return { total: pend.length, ok: ok }; });
  });
}

function gregLibExportAll() {
  gregLibAll().then(function(all) {
    if (!all.length) { gregGst('Bibliothek ist leer — nichts zu exportieren.'); return; }
    const payload = { notatorLibraryExport: true, exportedAt: new Date().toISOString(), pieces: all };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = 'notator-bibliothek_' + stamp + '.json'; a.click();
    URL.revokeObjectURL(url);
    gregGst(all.length + ' Stück(e) exportiert.');
  }).catch(function(err) { gregGst('Exportfehler: ' + err.message); });
}

function gregLibImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      const pieces = Array.isArray(data.pieces) ? data.pieces : (Array.isArray(data) ? data : null);
      if (!pieces) throw new Error('Kein erkennbares Bibliotheks-Export-Format');
      let imported = 0;
      const importNext = function(idx) {
        if (idx >= pieces.length) {
          input.value = '';
          gregGst(imported + ' Stück(e) importiert.');
          gregLibShowModal();
          return;
        }
        const p = pieces[idx];
        if (p && p.state) {
          // id weglassen -> autoIncrement vergibt eine neue, kollisionsfreie id;
          // bestehende Bibliothekseinträge bleiben dadurch unangetastet.
          gregLibPut({ title: p.title || 'Unbenanntes Stück', savedAt: p.savedAt || Date.now(), updatedAt: p.updatedAt || Date.now(), state: p.state, pending: true })
            .then(function() { imported++; importNext(idx + 1); })
            .catch(function() { importNext(idx + 1); });
        } else {
          importNext(idx + 1);
        }
      };
      importNext(0);
    } catch (err) {
      gregGst('Importfehler: "' + file.name + '" ist keine gültige Bibliotheks-Exportdatei. (' + err.message + ')');
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function gregLibFormatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('de-CH') + ' ' + d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

